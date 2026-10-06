/**
 * Classificação de risco por fator (metodologia CGC, Tabela 1).
 *
 * O documento define faixas inteiras ("De 4 Até 5 = Alto, 3 = Moderado,
 * 1–2 = Baixo") para a média do fator, com o sentido invertido nos fatores de
 * proteção. Aqui toda resposta já vem como NOTA DE RISCO (1–5, maior = pior —
 * ver questionnaire.ts), então a média do fator é o "índice de risco" e uma
 * única tabela vale para qualquer fator/questionário. Como o índice é contínuo
 * (ex.: 3,4), as lacunas entre as faixas inteiras são fechadas pelo inteiro mais
 * próximo, de forma simétrica:
 *
 *   índice ≥ 3,5        → Alto      (negativo: média 4–5 | proteção: média 1–2)
 *   2,5 ≤ índice < 3,5  → Moderado  (média 3)
 *   índice < 2,5        → Baixo     (negativo: média 1–2 | proteção: média 4–5)
 *
 * Se a CGC preferir outro corte (ex.: Alto só a partir de 4,0), é só mudar
 * essas duas constantes.
 */

export type RiskLevel = "alto" | "moderado" | "baixo";

export const RISK_HIGH_FROM = 3.5;
export const RISK_MODERATE_FROM = 2.5;

export const RISK_LABEL: Record<RiskLevel, string> = {
  alto: "Alto",
  moderado: "Moderado",
  baixo: "Baixo",
};

export function classifyRiskIndex(index: number): RiskLevel {
  if (index >= RISK_HIGH_FROM) return "alto";
  if (index >= RISK_MODERATE_FROM) return "moderado";
  return "baixo";
}

/** Ordem de severidade, para ordenar e para escolher o pior de um conjunto. */
export const RISK_RANK: Record<RiskLevel, number> = { baixo: 0, moderado: 1, alto: 2 };
