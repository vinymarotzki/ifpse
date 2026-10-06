/**
 * Agregação pura (sem I/O) das respostas HSE IT para a dashboard.
 *
 * Duas leituras convivem, como nos documentos da CGC:
 *  - média do fator → Alto/Moderado/Baixo (Tabela 1, gera plano de ação);
 *  - contagem de respostas críticas (4–5 nos negativos, 1–2 nos positivos).
 */

import {
  FACTORS,
  ITEM_COUNT,
  ITEM_TEXTS,
  factorOfItem,
  isCriticalScore,
  type Factor,
  type FactorId,
} from "./questionnaire";
import { RISK_RANK, classifyAverage, riskIndex, type RiskLevel } from "./risk";

export interface ResponseRow {
  messageId: number;
  setor: string;
  idade: number | null;
  respondidoEm: string;
  answers: Record<number, number>;
}

export interface FactorStat {
  id: FactorId;
  name: string;
  short: string;
  polarity: Factor["polarity"];
  description: string;
  actions: readonly string[];
  /** Média 1–5 de todas as respostas do fator; null sem respostas. */
  average: number | null;
  /** 1–5, maior = pior (ver risk.ts). */
  riskIndex: number | null;
  level: RiskLevel | null;
  answerCount: number;
  criticalCount: number;
  criticalPct: number;
  /** Respostas por pontuação 1..5 (índice 0 = nota 1). */
  distribution: [number, number, number, number, number];
  /** Quantos respondentes cada nível de risco no fator (média individual). */
  respondentLevels: Record<RiskLevel, number>;
}

export interface ItemStat {
  item: number;
  text: string;
  factorId: FactorId;
  factorName: string;
  average: number | null;
  criticalPct: number;
  criticalCount: number;
  count: number;
}

export interface SectorStat {
  setor: string;
  respondents: number;
  factors: Record<FactorId, { average: number | null; level: RiskLevel | null }>;
  highCount: number;
  worst: RiskLevel | null;
}

export interface TimelinePoint {
  period: string;
  respondents: number;
  /** Índice de risco (maior = pior) por fator; null sem dados no período. */
  risk: Record<FactorId, number | null>;
}

export interface Analysis {
  totals: {
    respondents: number;
    sectors: number;
    highFactors: number;
    moderateFactors: number;
    lowFactors: number;
    overallRiskIndex: number | null;
    overallLevel: RiskLevel | null;
    criticalPct: number;
    firstDate: string | null;
    lastDate: string | null;
  };
  factors: FactorStat[];
  items: ItemStat[];
  sectors: SectorStat[];
  timeline: { granularity: "day" | "month"; points: TimelinePoint[] };
  ages: { range: string; count: number }[];
}

const round = (n: number, digits = 2) => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};

const mean = (values: number[]): number | null =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

/** Média/classificação de um fator para um conjunto de respostas (pooled). */
function factorAverage(rows: ResponseRow[], factor: Factor): number | null {
  const scores: number[] = [];
  for (const row of rows) {
    for (const item of factor.items) {
      const score = row.answers[item];
      if (score) scores.push(score);
    }
  }
  return mean(scores);
}

function respondentFactorAverage(row: ResponseRow, factor: Factor): number | null {
  const scores = factor.items.map((i) => row.answers[i]).filter((s): s is number => !!s);
  return mean(scores);
}

function buildFactorStat(rows: ResponseRow[], factor: Factor): FactorStat {
  const distribution: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  let answerCount = 0;
  let criticalCount = 0;
  const respondentLevels: Record<RiskLevel, number> = { alto: 0, moderado: 0, baixo: 0 };

  for (const row of rows) {
    for (const item of factor.items) {
      const score = row.answers[item];
      if (!score) continue;
      distribution[score - 1] += 1;
      answerCount += 1;
      if (isCriticalScore(factor.polarity, score)) criticalCount += 1;
    }
    const own = respondentFactorAverage(row, factor);
    if (own !== null) respondentLevels[classifyAverage(own, factor.polarity)] += 1;
  }

  const average = factorAverage(rows, factor);
  return {
    id: factor.id,
    name: factor.name,
    short: factor.short,
    polarity: factor.polarity,
    description: factor.description,
    actions: factor.actions,
    average: average === null ? null : round(average),
    riskIndex: average === null ? null : round(riskIndex(average, factor.polarity)),
    level: average === null ? null : classifyAverage(average, factor.polarity),
    answerCount,
    criticalCount,
    criticalPct: answerCount ? round((criticalCount / answerCount) * 100, 1) : 0,
    distribution,
    respondentLevels,
  };
}

function buildItems(rows: ResponseRow[]): ItemStat[] {
  const items: ItemStat[] = [];
  for (let item = 1; item <= ITEM_COUNT; item++) {
    const factor = factorOfItem(item);
    const scores = rows.map((r) => r.answers[item]).filter((s): s is number => !!s);
    const criticalCount = scores.filter((s) => isCriticalScore(factor.polarity, s)).length;
    const average = mean(scores);
    items.push({
      item,
      text: ITEM_TEXTS[item - 1],
      factorId: factor.id,
      factorName: factor.name,
      average: average === null ? null : round(average),
      criticalCount,
      count: scores.length,
      criticalPct: scores.length ? round((criticalCount / scores.length) * 100, 1) : 0,
    });
  }
  return items;
}

/** Chave de agrupamento do setor: ignora caixa, acento e espaços repetidos. */
export function sectorKey(setor: string): string {
  return setor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function buildSectors(rows: ResponseRow[]): SectorStat[] {
  const groups = new Map<string, { label: string; latest: string; rows: ResponseRow[] }>();
  for (const row of rows) {
    const key = sectorKey(row.setor);
    const group = groups.get(key);
    if (!group) {
      groups.set(key, { label: row.setor, latest: row.respondidoEm, rows: [row] });
    } else {
      group.rows.push(row);
      // O rótulo exibido é o da resposta mais recente.
      if (row.respondidoEm >= group.latest) {
        group.latest = row.respondidoEm;
        group.label = row.setor;
      }
    }
  }

  const sectors: SectorStat[] = [];
  for (const group of groups.values()) {
    const factors = {} as SectorStat["factors"];
    let highCount = 0;
    let worst: RiskLevel | null = null;
    for (const factor of FACTORS) {
      const average = factorAverage(group.rows, factor);
      const level = average === null ? null : classifyAverage(average, factor.polarity);
      factors[factor.id] = { average: average === null ? null : round(average), level };
      if (level === "alto") highCount += 1;
      if (level && (worst === null || RISK_RANK[level] > RISK_RANK[worst])) worst = level;
    }
    sectors.push({ setor: group.label, respondents: group.rows.length, factors, highCount, worst });
  }

  return sectors.sort(
    (a, b) => b.highCount - a.highCount || b.respondents - a.respondents || a.setor.localeCompare(b.setor, "pt-BR")
  );
}

function daysBetween(from: string, to: string): number {
  return (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
}

function buildTimeline(rows: ResponseRow[], firstDate: string | null, lastDate: string | null) {
  const granularity: "day" | "month" =
    firstDate && lastDate && daysBetween(firstDate, lastDate) <= 45 ? "day" : "month";

  const buckets = new Map<string, ResponseRow[]>();
  for (const row of rows) {
    const period = granularity === "day" ? row.respondidoEm : row.respondidoEm.slice(0, 7);
    const bucket = buckets.get(period);
    if (bucket) bucket.push(row);
    else buckets.set(period, [row]);
  }

  const points: TimelinePoint[] = [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, bucketRows]) => {
      const risk = {} as TimelinePoint["risk"];
      for (const factor of FACTORS) {
        const average = factorAverage(bucketRows, factor);
        risk[factor.id] = average === null ? null : round(riskIndex(average, factor.polarity));
      }
      return { period, respondents: bucketRows.length, risk };
    });

  return { granularity, points };
}

const AGE_RANGES: readonly { label: string; test: (age: number) => boolean }[] = [
  { label: "Até 24", test: (a) => a <= 24 },
  { label: "25–34", test: (a) => a >= 25 && a <= 34 },
  { label: "35–44", test: (a) => a >= 35 && a <= 44 },
  { label: "45–54", test: (a) => a >= 45 && a <= 54 },
  { label: "55+", test: (a) => a >= 55 },
];

function buildAges(rows: ResponseRow[]) {
  const counts = AGE_RANGES.map((range) => ({
    range: range.label,
    count: rows.filter((r) => r.idade !== null && range.test(r.idade)).length,
  }));
  const unknown = rows.filter((r) => r.idade === null).length;
  return unknown ? [...counts, { range: "Não informada", count: unknown }] : counts;
}

export function analyze(rows: ResponseRow[]): Analysis {
  const factors = FACTORS.map((factor) => buildFactorStat(rows, factor));

  const dates = rows.map((r) => r.respondidoEm).sort();
  const firstDate = dates[0] ?? null;
  const lastDate = dates[dates.length - 1] ?? null;

  const indices = factors.map((f) => f.riskIndex).filter((n): n is number => n !== null);
  const overall = mean(indices);
  const totalAnswers = factors.reduce((sum, f) => sum + f.answerCount, 0);
  const totalCritical = factors.reduce((sum, f) => sum + f.criticalCount, 0);

  const sectors = buildSectors(rows);

  return {
    totals: {
      respondents: rows.length,
      sectors: sectors.length,
      highFactors: factors.filter((f) => f.level === "alto").length,
      moderateFactors: factors.filter((f) => f.level === "moderado").length,
      lowFactors: factors.filter((f) => f.level === "baixo").length,
      overallRiskIndex: overall === null ? null : round(overall),
      // Mesmas faixas do fator, aplicadas ao índice (já normalizado, "negativo").
      overallLevel: overall === null ? null : classifyAverage(overall, "negative"),
      criticalPct: totalAnswers ? round((totalCritical / totalAnswers) * 100, 1) : 0,
      firstDate,
      lastDate,
    },
    factors,
    items: buildItems(rows),
    sectors,
    timeline: buildTimeline(rows, firstDate, lastDate),
    ages: buildAges(rows),
  };
}
