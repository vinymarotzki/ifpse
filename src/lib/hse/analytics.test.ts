import { describe, expect, it } from "vitest";
import { analyze, type ResponseRow } from "./analytics";
import { ITEM_COUNT } from "./questionnaire";

/** Todas as afirmativas com a mesma nota, exceto overrides por item. */
function row(id: number, score: number, extra: Partial<ResponseRow> = {}, overrides: Record<number, number> = {}): ResponseRow {
  const answers: Record<number, number> = {};
  for (let item = 1; item <= ITEM_COUNT; item++) answers[item] = overrides[item] ?? score;
  return { messageId: id, setor: "CGC", idade: 30, respondidoEm: "2026-10-01", answers, ...extra };
}

describe("analyze", () => {
  it("sem respostas: tudo nulo e zerado", () => {
    const result = analyze([]);
    expect(result.totals.respondents).toBe(0);
    expect(result.totals.overallLevel).toBeNull();
    expect(result.factors.every((f) => f.level === null && f.average === null)).toBe(true);
  });

  it("todo mundo respondeu 5: negativos em Alto, positivos em Baixo", () => {
    const result = analyze([row(1, 5), row(2, 5)]);
    const byId = Object.fromEntries(result.factors.map((f) => [f.id, f]));
    expect(byId.demandas.level).toBe("alto");
    expect(byId.relacionamentos.level).toBe("alto");
    expect(byId.controle.level).toBe("baixo");
    expect(byId["apoio-chefia"].level).toBe("baixo");
    expect(byId.demandas.criticalPct).toBe(100); // 5 é crítico nos negativos
    expect(byId.controle.criticalPct).toBe(0); // 5 não é crítico nos positivos
    expect(result.totals.highFactors).toBe(2);
  });

  it("todo mundo respondeu 1: positivos em Alto com 100% de respostas críticas", () => {
    const result = analyze([row(1, 1)]);
    const controle = result.factors.find((f) => f.id === "controle")!;
    expect(controle.level).toBe("alto");
    expect(controle.criticalPct).toBe(100);
    expect(controle.riskIndex).toBe(5);
    expect(result.factors.find((f) => f.id === "demandas")!.level).toBe("baixo");
  });

  it("conta respostas críticas e distribuição por nota", () => {
    // Demandas (itens 1–8): 4 respostas 4 e 4 respostas 2 → 4 críticas de 8.
    const overrides: Record<number, number> = { 1: 4, 2: 4, 3: 4, 4: 4, 5: 2, 6: 2, 7: 2, 8: 2 };
    const demandas = analyze([row(1, 3, {}, overrides)]).factors[0];
    expect(demandas.criticalCount).toBe(4);
    expect(demandas.criticalPct).toBe(50);
    expect(demandas.distribution).toEqual([0, 4, 0, 4, 0]);
    expect(demandas.average).toBe(3);
    expect(demandas.level).toBe("moderado");
  });

  it("agrupa setores sem diferenciar caixa/acento e ordena pelos mais críticos", () => {
    const result = analyze([
      row(1, 5, { setor: "Administração" }),
      row(2, 5, { setor: "administracao" }),
      row(3, 3, { setor: "CIPA" }),
    ]);
    expect(result.sectors).toHaveLength(2);
    expect(result.sectors[0].respondents).toBe(2);
    expect(result.sectors[0].highCount).toBe(2);
    expect(result.sectors[1].setor).toBe("CIPA");
  });

  it("linha do tempo: diária em janela curta, mensal em janela longa", () => {
    const short = analyze([row(1, 3, { respondidoEm: "2026-10-01" }), row(2, 3, { respondidoEm: "2026-10-09" })]);
    expect(short.timeline.granularity).toBe("day");
    expect(short.timeline.points.map((p) => p.period)).toEqual(["2026-10-01", "2026-10-09"]);

    const long = analyze([row(1, 3, { respondidoEm: "2026-05-01" }), row(2, 3, { respondidoEm: "2026-10-09" })]);
    expect(long.timeline.granularity).toBe("month");
    expect(long.timeline.points.map((p) => p.period)).toEqual(["2026-05", "2026-10"]);
  });

  it("faixa etária ignora idade desconhecida mas a conta à parte", () => {
    const result = analyze([row(1, 3, { idade: 30 }), row(2, 3, { idade: null })]);
    expect(result.ages.find((a) => a.range === "25–34")!.count).toBe(1);
    expect(result.ages.find((a) => a.range === "Não informada")!.count).toBe(1);
  });

  it("média individual alimenta a distribuição de respondentes por nível", () => {
    const result = analyze([row(1, 5), row(2, 1), row(3, 3)]);
    expect(result.factors[0].respondentLevels).toEqual({ alto: 1, moderado: 1, baixo: 1 });
  });
});
