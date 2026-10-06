import { describe, expect, it } from "vitest";
import { classifyAverage } from "./risk";

describe("classifyAverage — Tabela 1 da metodologia CGC", () => {
  it("Demandas/Relacionamentos: maior frequência = maior risco", () => {
    expect(classifyAverage(5, "negative")).toBe("alto");
    expect(classifyAverage(4, "negative")).toBe("alto");
    expect(classifyAverage(3, "negative")).toBe("moderado");
    expect(classifyAverage(2, "negative")).toBe("baixo");
    expect(classifyAverage(1, "negative")).toBe("baixo");
  });

  it("fatores de proteção: menor frequência = maior risco", () => {
    expect(classifyAverage(1, "positive")).toBe("alto");
    expect(classifyAverage(2, "positive")).toBe("alto");
    expect(classifyAverage(3, "positive")).toBe("moderado");
    expect(classifyAverage(4, "positive")).toBe("baixo");
    expect(classifyAverage(5, "positive")).toBe("baixo");
  });

  it("médias fracionadas fecham as lacunas de forma simétrica", () => {
    expect(classifyAverage(3.5, "negative")).toBe("alto");
    expect(classifyAverage(3.49, "negative")).toBe("moderado");
    expect(classifyAverage(2.5, "negative")).toBe("moderado");
    expect(classifyAverage(2.49, "negative")).toBe("baixo");
    // espelho nos positivos: 6 − 3,5 = 2,5 → moderado; 6 − 2,5 = 3,5 → alto
    expect(classifyAverage(2.5, "positive")).toBe("alto");
    expect(classifyAverage(2.51, "positive")).toBe("moderado");
    expect(classifyAverage(3.5, "positive")).toBe("moderado");
    expect(classifyAverage(3.51, "positive")).toBe("baixo");
  });
});
