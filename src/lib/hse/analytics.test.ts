import { describe, expect, it } from "vitest";
import { analyze, type ResponseRow } from "./analytics";
import { QUESTIONNAIRES } from "./questionnaire";

const count = (id: string) => QUESTIONNAIRES.find((q) => q.id === id)!.items.length;

/** Todas as afirmativas com a mesma nota BRUTA, exceto overrides por número. */
function row(
  id: number,
  score: number,
  extra: Partial<ResponseRow> = {},
  overrides: Record<number, number> = {}
): ResponseRow {
  const questionnaire = extra.questionnaire ?? "hse35";
  const answers: Record<number, number> = {};
  for (let item = 1; item <= count(questionnaire); item++) answers[item] = overrides[item] ?? score;
  return { messageId: id, questionnaire, setor: "CGC", idade: 30, respondidoEm: "2026-10-01", answers, ...extra };
}

const byId = (rows: ResponseRow[]) => Object.fromEntries(analyze(rows).factors.map((f) => [f.id, f]));

describe("analyze", () => {
  it("sem respostas: tudo nulo e zerado", () => {
    const result = analyze([]);
    expect(result.totals.respondents).toBe(0);
    expect(result.totals.overallLevel).toBeNull();
    expect(result.factors.every((f) => f.level === null && f.riskIndex === null)).toBe(true);
  });

  describe("HSE 35", () => {
    it("todo mundo respondeu 5: negativos em Alto, positivos em Baixo", () => {
      const f = byId([row(1, 5), row(2, 5)]);
      expect(f.demandas.level).toBe("alto");
      expect(f.relacionamentos.level).toBe("alto");
      expect(f.controle.level).toBe("baixo");
      expect(f["apoio-chefia"].level).toBe("baixo");
      expect(f.demandas.criticalPct).toBe(100);
      expect(f.controle.criticalPct).toBe(0);
    });

    it("todo mundo respondeu 1: positivos em Alto com 100% de respostas críticas", () => {
      const f = byId([row(1, 1)]);
      expect(f.controle.level).toBe("alto");
      expect(f.controle.criticalPct).toBe(100);
      expect(f.controle.riskIndex).toBe(5);
      expect(f.demandas.level).toBe("baixo");
    });

    it("conta respostas críticas e a distribuição por nota de risco", () => {
      // Demandas (itens 1–8, negativas): quatro 4 (críticas) e quatro 2.
      const overrides = { 1: 4, 2: 4, 3: 4, 4: 4, 5: 2, 6: 2, 7: 2, 8: 2 };
      const demandas = byId([row(1, 3, {}, overrides)]).demandas;
      expect(demandas.criticalCount).toBe(4);
      expect(demandas.criticalPct).toBe(50);
      expect(demandas.distribution).toEqual([0, 4, 0, 4, 0]);
      expect(demandas.riskIndex).toBe(3);
      expect(demandas.level).toBe("moderado");
    });
  });

  describe("Escola 15 (afirmativas 2 e 4 negativas, as demais positivas)", () => {
    it("todo mundo respondeu 5 ('Sempre'): só as afirmativas negativas pesam", () => {
      const f = byId([row(1, 5, { questionnaire: "escola15" })]);
      // Demandas: itens 1 e 3 (positivos, risco 1) + item 2 (negativo, risco 5) = 7/3
      expect(f.demandas.riskIndex).toBe(2.33);
      expect(f.demandas.level).toBe("baixo");
      // Relacionamentos: item 4 (negativo, risco 5) + item 5 (positivo, risco 1) = 3
      expect(f.relacionamentos.riskIndex).toBe(3);
      expect(f.relacionamentos.level).toBe("moderado");
      expect(f.controle.level).toBe("baixo");
    });

    it("todo mundo respondeu 1 ('Nunca'): fatores de proteção em Alto", () => {
      const f = byId([row(1, 1, { questionnaire: "escola15" })]);
      expect(f.controle.level).toBe("alto");
      expect(f["apoio-chefia"].level).toBe("alto");
      expect(f["comunicacao-mudancas"].level).toBe("alto");
      expect(f.demandas.riskIndex).toBe(3.67); // (5 + 1 + 5) / 3
      expect(f.demandas.level).toBe("alto");
    });

    it("o mesmo texto de afirmativa agrega entre respondentes", () => {
      const items = analyze([row(1, 1, { questionnaire: "escola15" }), row(2, 5, { questionnaire: "escola15" })]).items;
      expect(items).toHaveLength(15);
      const colegas = items.find((i) => i.text.startsWith("Quando uma pessoa precisa de ajuda"))!;
      expect(colegas.count).toBe(2);
      expect(colegas.criticalCount).toBe(1); // só o "Nunca" (risco 5) é crítico
      expect(colegas.criticalPct).toBe(50);
    });
  });

  it("mistura os dois questionários nos mesmos fatores", () => {
    const result = analyze([row(1, 5), row(2, 5, { questionnaire: "escola15" })]);
    expect(result.totals.respondents).toBe(2);
    expect(result.totals.forms.map((f) => f.id).sort()).toEqual(["escola15", "hse35"]);
    expect(result.factors.find((f) => f.id === "controle")!.answerCount).toBe(6 + 2);
  });

  it("questionário desconhecido cai no HSE 35 sem lançar", () => {
    const legacy = { ...row(1, 3), questionnaire: "outro" };
    expect(() => analyze([legacy])).not.toThrow();
    expect(analyze([legacy]).totals.forms).toEqual([expect.objectContaining({ id: "hse35", respondents: 1 })]);
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
