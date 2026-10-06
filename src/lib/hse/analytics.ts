/**
 * Agregação pura (sem I/O) das respostas para a dashboard.
 *
 * Toda resposta é convertida em NOTA DE RISCO (1–5, maior = pior) conforme o
 * sentido da afirmativa (ver questionnaire.ts); a partir daí, qualquer questionário
 * se agrega do mesmo jeito. Duas leituras convivem, como nos documentos da CGC:
 *  - média das notas de risco do fator → Alto/Moderado/Baixo (Tabela 1);
 *  - proporção de respostas críticas (nota de risco 4–5).
 */

import {
  FACTORS,
  getQuestionnaire,
  isCriticalRisk,
  riskScore,
  type Factor,
  type FactorId,
  type QuestionnaireItem,
} from "./questionnaire";
import { RISK_RANK, classifyRiskIndex, type RiskLevel } from "./risk";

export interface ResponseRow {
  messageId: number;
  /** Id do questionário ("hse35" | "escola15"); desconhecido cai no hse35. */
  questionnaire: string;
  setor: string;
  idade: number | null;
  respondidoEm: string;
  /** Número da afirmativa (1-based) → pontuação bruta 1–5. */
  answers: Record<number, number>;
}

export interface FactorStat {
  id: FactorId;
  name: string;
  short: string;
  description: string;
  actions: readonly string[];
  /** Média das notas de risco, 1–5 (maior = pior); null sem respostas. */
  riskIndex: number | null;
  level: RiskLevel | null;
  answerCount: number;
  criticalCount: number;
  criticalPct: number;
  /** Respostas por nota de risco 1..5 (índice 0 = risco 1, o melhor cenário). */
  distribution: [number, number, number, number, number];
  /** Quantos respondentes em cada nível de risco no fator (média individual). */
  respondentLevels: Record<RiskLevel, number>;
}

export interface ItemStat {
  text: string;
  factorId: FactorId;
  factorName: string;
  riskIndex: number | null;
  criticalPct: number;
  criticalCount: number;
  count: number;
}

export interface SectorStat {
  setor: string;
  respondents: number;
  factors: Record<FactorId, { riskIndex: number | null; level: RiskLevel | null }>;
  highCount: number;
  worst: RiskLevel | null;
}

export interface TimelinePoint {
  period: string;
  respondents: number;
  /** Índice de risco por fator; null sem dados no período. */
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
    forms: { id: string; name: string; respondents: number }[];
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

/** Uma resposta já convertida: a afirmativa e a nota de risco. */
interface Scored {
  item: QuestionnaireItem;
  risk: number;
}

function scoredAnswers(row: ResponseRow): Scored[] {
  const items = getQuestionnaire(row.questionnaire).items;
  const out: Scored[] = [];
  for (const [key, score] of Object.entries(row.answers)) {
    const item = items[Number(key) - 1];
    if (item && score >= 1 && score <= 5) out.push({ item, risk: riskScore(item, score) });
  }
  return out;
}

/** Notas de risco do fator em um conjunto de respostas. */
function factorRisks(rows: ResponseRow[], factorId: FactorId): number[] {
  const risks: number[] = [];
  for (const row of rows) {
    for (const scored of scoredAnswers(row)) {
      if (scored.item.factor === factorId) risks.push(scored.risk);
    }
  }
  return risks;
}

function buildFactorStat(rows: ResponseRow[], factor: Factor): FactorStat {
  const distribution: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  const respondentLevels: Record<RiskLevel, number> = { alto: 0, moderado: 0, baixo: 0 };
  const all: number[] = [];
  let criticalCount = 0;

  for (const row of rows) {
    const own: number[] = [];
    for (const scored of scoredAnswers(row)) {
      if (scored.item.factor !== factor.id) continue;
      own.push(scored.risk);
      distribution[scored.risk - 1] += 1;
      if (isCriticalRisk(scored.risk)) criticalCount += 1;
    }
    all.push(...own);
    const ownMean = mean(own);
    if (ownMean !== null) respondentLevels[classifyRiskIndex(ownMean)] += 1;
  }

  const index = mean(all);
  return {
    id: factor.id,
    name: factor.name,
    short: factor.short,
    description: factor.description,
    actions: factor.actions,
    riskIndex: index === null ? null : round(index),
    level: index === null ? null : classifyRiskIndex(index),
    answerCount: all.length,
    criticalCount,
    criticalPct: all.length ? round((criticalCount / all.length) * 100, 1) : 0,
    distribution,
    respondentLevels,
  };
}

/** Afirmativas agrupadas pelo TEXTO (únicas entre questionários). */
function buildItems(rows: ResponseRow[]): ItemStat[] {
  const groups = new Map<string, { item: QuestionnaireItem; risks: number[] }>();
  for (const row of rows) {
    for (const scored of scoredAnswers(row)) {
      const group = groups.get(scored.item.text);
      if (group) group.risks.push(scored.risk);
      else groups.set(scored.item.text, { item: scored.item, risks: [scored.risk] });
    }
  }

  const factorName = new Map(FACTORS.map((f) => [f.id, f.name]));
  return [...groups.values()].map(({ item, risks }) => {
    const criticalCount = risks.filter(isCriticalRisk).length;
    const index = mean(risks);
    return {
      text: item.text,
      factorId: item.factor,
      factorName: factorName.get(item.factor) ?? item.factor,
      riskIndex: index === null ? null : round(index),
      criticalCount,
      count: risks.length,
      criticalPct: risks.length ? round((criticalCount / risks.length) * 100, 1) : 0,
    };
  });
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
      const index = mean(factorRisks(group.rows, factor.id));
      const level = index === null ? null : classifyRiskIndex(index);
      factors[factor.id] = { riskIndex: index === null ? null : round(index), level };
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
        const index = mean(factorRisks(bucketRows, factor.id));
        risk[factor.id] = index === null ? null : round(index);
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

function buildForms(rows: ResponseRow[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const id = getQuestionnaire(row.questionnaire).id;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts.entries()].map(([id, respondents]) => ({ id, name: getQuestionnaire(id).name, respondents }));
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
      overallLevel: overall === null ? null : classifyRiskIndex(overall),
      criticalPct: totalAnswers ? round((totalCritical / totalAnswers) * 100, 1) : 0,
      firstDate,
      lastDate,
      forms: buildForms(rows),
    },
    factors,
    items: buildItems(rows),
    sectors,
    timeline: buildTimeline(rows, firstDate, lastDate),
    ages: buildAges(rows),
  };
}
