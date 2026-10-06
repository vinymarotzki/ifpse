import { describe, expect, it } from "vitest";
import { classifyRiskIndex } from "./risk";
import { QUESTIONNAIRES, isCriticalRisk, riskScore } from "./questionnaire";

describe("classifyRiskIndex — Tabela 1 da metodologia CGC", () => {
  it("faixas inteiras do documento (índice = média das notas de risco)", () => {
    expect(classifyRiskIndex(5)).toBe("alto");
    expect(classifyRiskIndex(4)).toBe("alto");
    expect(classifyRiskIndex(3)).toBe("moderado");
    expect(classifyRiskIndex(2)).toBe("baixo");
    expect(classifyRiskIndex(1)).toBe("baixo");
  });

  it("médias fracionadas fecham as lacunas pelo inteiro mais próximo", () => {
    expect(classifyRiskIndex(3.5)).toBe("alto");
    expect(classifyRiskIndex(3.49)).toBe("moderado");
    expect(classifyRiskIndex(2.5)).toBe("moderado");
    expect(classifyRiskIndex(2.49)).toBe("baixo");
  });
});

describe("riskScore — sentido por afirmativa", () => {
  const hse = QUESTIONNAIRES.find((q) => q.id === "hse35")!;
  const escola = QUESTIONNAIRES.find((q) => q.id === "escola15")!;

  it("HSE 35: Demandas/Relacionamentos altos = pior; demais fatores, o inverso", () => {
    expect(riskScore(hse.items[1], 5)).toBe(5); // "Tenho prazos impossíveis de cumprir"
    expect(riskScore(hse.items[12], 5)).toBe(1); // "Posso decidir quando fazer uma pausa"
    expect(riskScore(hse.items[12], 1)).toBe(5);
  });

  it("Escola 15: só as afirmativas 2 e 4 são negativas", () => {
    const negativas = escola.items.filter((i) => i.highIsBad).map((i) => i.number);
    expect(negativas).toEqual([2, 4]);
    expect(riskScore(escola.items[0], 2)).toBe(4); // "…é compatível…?" Raramente = ruim
    expect(riskScore(escola.items[1], 2)).toBe(2); // "…dificultando…" Raramente = bom
  });

  it("resposta crítica = nota de risco 4–5", () => {
    expect([1, 2, 3].some(isCriticalRisk)).toBe(false);
    expect(isCriticalRisk(4)).toBe(true);
    expect(isCriticalRisk(5)).toBe(true);
  });

  it("os dois questionários cobrem os 7 fatores", () => {
    for (const q of QUESTIONNAIRES) expect(new Set(q.items.map((i) => i.factor)).size).toBe(7);
    expect(escola.items).toHaveLength(15);
    expect(hse.items).toHaveLength(35);
  });
});
