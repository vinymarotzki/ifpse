/**
 * Classificação de risco por fator (metodologia CGC, Tabela 1).
 *
 * O documento define faixas inteiras ("De 4 Até 5 = Alto, 3 = Moderado,
 * 1–2 = Baixo"), mas a média de um fator é contínua (ex.: 3,4). Para fechar as
 * lacunas entre as faixas, a média é normalizada num "índice de risco" 1–5 onde
 * MAIOR = PIOR em qualquer fator (negativo: a própria média; positivo: 6 − média)
 * e a faixa é a do inteiro mais próximo. Assim as duas tabelas do documento
 * ficam espelhadas e simétricas:
 *
 *   índice ≥ 3,5        → Alto      (negativo: média 4–5 | positivo: média 1–2)
 *   2,5 ≤ índice < 3,5  → Moderado  (média 3)
 *   índice < 2,5        → Baixo     (negativo: média 1–2 | positivo: média 4–5)
 *
 * Se a CGC preferir outro corte (ex.: Alto só a partir de 4,0), é só mudar
 * essas duas constantes.
 */

import type { FactorPolarity } from "./questionnaire";

export type RiskLevel = "alto" | "moderado" | "baixo";

export const RISK_HIGH_FROM = 3.5;
export const RISK_MODERATE_FROM = 2.5;

export const RISK_LABEL: Record<RiskLevel, string> = {
  alto: "Alto",
  moderado: "Moderado",
  baixo: "Baixo",
};

/** Maior = pior, em qualquer fator. Escala 1–5 (como a média das respostas). */
export function riskIndex(average: number, polarity: FactorPolarity): number {
  return polarity === "negative" ? average : 6 - average;
}

export function classifyAverage(average: number, polarity: FactorPolarity): RiskLevel {
  const index = riskIndex(average, polarity);
  if (index >= RISK_HIGH_FROM) return "alto";
  if (index >= RISK_MODERATE_FROM) return "moderado";
  return "baixo";
}

/** Ordem de severidade, para ordenar e para escolher o pior de um conjunto. */
export const RISK_RANK: Record<RiskLevel, number> = { baixo: 0, moderado: 1, alto: 2 };
