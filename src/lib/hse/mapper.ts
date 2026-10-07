/**
 * Converte uma mensagem SASI (dataFields do formulário) num HseRecord.
 *
 * Formato real observado (canal 38274): cada afirmativa é um dataField
 * `type: "radios"` com `title` = texto completo da pergunta, `name` = slug do
 * título cortado em ~50 caracteres e `value` = "2_raramente" (formattedValue =
 * "Raramente"). O formulário não traz setor/idade/data: o setor vem do time
 * (`team.name`) e a data de `generatedAt`.
 *
 * Cada afirmativa é localizada por uma cascata tolerante:
 *   1. o texto da afirmativa aparece no `title`/`name` do campo (mais confiável);
 *   2. o `name` (slug truncado) é o começo do texto de uma afirmativa;
 *   3. só para o questionário de 35: `name` do tipo "pergunta_12" ou título "12. …".
 * O questionário da mensagem é o que mais afirmativas reconhecer.
 *
 * Regra herdada do cgc-atividades: nunca lança por dado ausente ou inesperado —
 * devolve `{ ok: false, reason }` e o webhook registra o motivo.
 */

import type { SasiDataField, SasiMessageRaw } from "@/lib/sasi/types";
import { QUESTIONNAIRES, SCALE, getQuestionnaire, type QuestionnaireId, type Score } from "./questionnaire";

export interface HseRecord {
  messageId: number;
  questionnaire: QuestionnaireId;
  /** Setor/unidade: campo "setor" do formulário, senão o nome do time da SASI. */
  setor: string;
  /** Idade informada, ou null (não armazenamos nome — só o necessário). */
  idade: number | null;
  /** Data local da resposta, YYYY-MM-DD. */
  respondidoEm: string;
  /** Número da afirmativa (1-based, do questionário) → pontuação 1–5 bruta. */
  answers: Record<number, Score>;
}

export type MapResult =
  | { ok: true; record: HseRecord }
  | { ok: false; reason: string };

export const SETOR_NAO_INFORMADO = "Não informado";

const TIMEZONE = process.env.HSE_TIMEZONE || "America/Campo_Grande";

function minAnswers(): number {
  const parsed = Number.parseInt(process.env.HSE_MIN_ANSWERS ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
}

/** minúsculas, sem acento, só letras/dígitos separados por espaço único. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

interface IndexedItem {
  questionnaire: QuestionnaireId;
  number: number;
  norm: string;
}

const INDEX: readonly IndexedItem[] = QUESTIONNAIRES.flatMap((q) =>
  q.items.map((item) => ({ questionnaire: q.id, number: item.number, norm: normalize(item.text) }))
);

/** Slug de `name` precisa de tamanho mínimo para não casar por acaso ("setor", "nome"). */
const MIN_SLUG_LENGTH = 30;

/** Texto exibido pelo SASI para um campo: formattedValue (rótulo) ou value. */
function candidates(field: SasiDataField): unknown[] {
  const out: unknown[] = [];
  const formatted = Array.isArray(field.formattedValue) ? field.formattedValue[0] : field.formattedValue;
  if (formatted !== undefined && formatted !== null) out.push(formatted);
  const value = Array.isArray(field.value) ? field.value[0] : field.value;
  if (value !== undefined && value !== null) out.push(value);
  return out;
}

const LABELS: readonly { norm: string; score: Score }[] = SCALE.map((s) => ({
  norm: normalize(s.label),
  score: s.score,
}));

function candidateToScore(candidate: unknown): Score | null {
  if (typeof candidate === "number") {
    return Number.isInteger(candidate) && candidate >= 1 && candidate <= 5 ? (candidate as Score) : null;
  }
  if (typeof candidate !== "string") return null;

  const norm = normalize(candidate);
  if (!norm) return null;

  // "Nunca", "Ás Vezes", "4 - Frequentemente", "2_raramente"… — o rótulo vale mais que o dígito.
  for (const label of LABELS) {
    if (norm === label.norm || norm.endsWith(` ${label.norm}`) || norm.startsWith(`${label.norm} `)) {
      return label.score;
    }
  }
  const digit = /^([1-5])(?:\s|$)/.exec(norm);
  return digit ? (Number(digit[1]) as Score) : null;
}

/** Opção N/A do SASI ("Não tenho elementos para avaliar"): fica fora do cálculo da exposição. */
const NOT_APPLICABLE = "nao tenho elementos";

export function fieldToScore(field: SasiDataField): Score | null {
  const all = candidates(field);
  // Antes do dígito: um value como "5_nao_tenho_elementos" não pode virar nota 5.
  if (all.some((c) => typeof c === "string" && normalize(c).includes(NOT_APPLICABLE))) return null;
  for (const candidate of all) {
    const score = candidateToScore(candidate);
    if (score) return score;
  }
  return null;
}

const ORDINAL_NAME = /^(?:q|p|i|pergunta|questao|item|afirmativa|afirmacao)\s?0*(\d{1,2})$/;
const ORDINAL_TITLE = /^0*(\d{1,2})\s*(?:[.)\-:]|\s-\s)/;
const HSE35_COUNT = 35;

export interface ItemRef {
  questionnaire: QuestionnaireId;
  number: number;
}

/** Qual afirmativa (de qual questionário) este campo representa? null se nenhuma. */
export function fieldToItem(field: SasiDataField): ItemRef | null {
  const keys = [field.title, field.name].filter((k): k is string => typeof k === "string" && k.trim() !== "");

  // 1. Texto da afirmativa dentro do título/nome — escolhe o casamento mais longo.
  let best: IndexedItem | null = null;
  for (const key of keys) {
    const norm = normalize(key);
    for (const item of INDEX) {
      if (norm.includes(item.norm) && (best === null || item.norm.length > best.norm.length)) best = item;
    }
  }
  if (best) return { questionnaire: best.questionnaire, number: best.number };

  // 2. `name` é o slug truncado do título: começo do texto de uma afirmativa.
  if (typeof field.name === "string") {
    const slug = normalize(field.name);
    if (slug.length >= MIN_SLUG_LENGTH) {
      const hit = INDEX.find((item) => item.norm.startsWith(slug));
      if (hit) return { questionnaire: hit.questionnaire, number: hit.number };
    }
  }

  // 3. Ordem ("pergunta_12", "12. …") — só faz sentido no questionário de 35.
  if (typeof field.name === "string") {
    const match = ORDINAL_NAME.exec(normalize(field.name));
    if (match && Number(match[1]) >= 1 && Number(match[1]) <= HSE35_COUNT) {
      return { questionnaire: "hse35", number: Number(match[1]) };
    }
  }
  if (typeof field.title === "string") {
    const match = ORDINAL_TITLE.exec(field.title.trim());
    if (match && Number(match[1]) >= 1 && Number(match[1]) <= HSE35_COUNT) {
      return { questionnaire: "hse35", number: Number(match[1]) };
    }
  }

  return null;
}

/** Valor textual de um campo de metadado (setor, idade, data). */
function fieldText(field: SasiDataField): string {
  for (const candidate of candidates(field)) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    if (typeof candidate === "number" && Number.isFinite(candidate)) return String(candidate);
  }
  return "";
}

/**
 * Campo de metadado pelo nome/título exato (após normalizar) — igualdade, não
 * "contém", porque a afirmativa 31 do questionário de 35 também fala em "meu setor".
 */
function findMeta(fields: SasiDataField[], names: readonly string[]): SasiDataField | null {
  for (const field of fields) {
    for (const key of [field.name, field.title]) {
      if (typeof key !== "string") continue;
      const norm = normalize(key);
      if (names.some((n) => norm === n || norm.startsWith(`${n} `))) return field;
    }
  }
  return null;
}

function envNames(envKey: string, defaults: readonly string[]): readonly string[] {
  const custom = process.env[envKey]?.trim();
  return custom ? [normalize(custom)] : defaults;
}

function localDate(date: Date): string {
  // en-CA formata como YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(date);
}

/** Aceita "2026-10-06", "06/10/2026" ou ISO completo; senão null. */
export function parseDateText(text: string): string | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(text);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  return null;
}

function resolveDate(fields: SasiDataField[], message: SasiMessageRaw): string {
  const meta = findMeta(fields, envNames("HSE_FIELD_DATA", ["data", "data da avaliacao", "data da resposta"]));
  const fromField = meta ? parseDateText(fieldText(meta)) : null;
  if (fromField) return fromField;

  if (message.generatedAt) {
    const generated = new Date(message.generatedAt);
    if (!Number.isNaN(generated.getTime())) return localDate(generated);
  }
  return localDate(new Date());
}

function resolveSetor(fields: SasiDataField[], message: SasiMessageRaw): string {
  const field = findMeta(fields, envNames("HSE_FIELD_SETOR", ["setor", "unidade", "lotacao", "departamento"]));
  const fromField = field ? fieldText(field) : "";
  const raw = fromField || (typeof message.team?.name === "string" ? message.team.name : "");
  return raw.replace(/\s+/g, " ").trim().slice(0, 80) || SETOR_NAO_INFORMADO;
}

interface Extraction {
  /** Questionário com mais afirmativas reconhecidas (null se nenhuma). */
  questionnaire: QuestionnaireId | null;
  answers: Record<number, Score>;
  /** Campos que não são afirmativa do questionário vencedor. */
  others: SasiDataField[];
  /** Afirmativas reconhecidas por questionário (com resposta legível). */
  counts: Record<string, number>;
}

function extract(message: SasiMessageRaw): Extraction {
  const fields = Array.isArray(message.dataFields) ? message.dataFields : [];

  const perQuestionnaire = new Map<QuestionnaireId, Record<number, Score>>();
  const matched = new Map<SasiDataField, ItemRef>();
  for (const field of fields) {
    const ref = fieldToItem(field);
    if (!ref) continue;
    matched.set(field, ref);
    const score = fieldToScore(field);
    if (!score) continue;
    const answers = perQuestionnaire.get(ref.questionnaire) ?? {};
    // Primeiro campo válido do item vence (formulário repetido não sobrescreve).
    if (!(ref.number in answers)) answers[ref.number] = score;
    perQuestionnaire.set(ref.questionnaire, answers);
  }

  const counts: Record<string, number> = {};
  let winner: QuestionnaireId | null = null;
  for (const q of QUESTIONNAIRES) {
    const count = Object.keys(perQuestionnaire.get(q.id) ?? {}).length;
    counts[q.id] = count;
    if (count > 0 && (winner === null || count > counts[winner])) winner = q.id;
  }

  const others = fields.filter((field) => {
    const ref = matched.get(field);
    return !ref || ref.questionnaire !== winner;
  });
  return { questionnaire: winner, answers: winner ? (perQuestionnaire.get(winner) ?? {}) : {}, others, counts };
}

export interface MessageInspection {
  channelId: string | null;
  teamName: string | null;
  dataFieldCount: number;
  /** Questionário detectado (o que mais casou), ou null. */
  questionnaire: QuestionnaireId | null;
  itemsRecognized: number;
  /** Afirmativas do questionário detectado sem campo ou com resposta ilegível. */
  missingItems: number[];
  /** Campos que não viraram afirmativa nem cabeçalho conhecido — pista do formato real. */
  unrecognizedFields: { name?: string; title?: string; type?: string; valueKind: string }[];
  /** Resultado do mapeamento real, sem as respostas. */
  mapping:
    | { ok: true; questionnaire: QuestionnaireId; setor: string; idade: number | null; respondidoEm: string }
    | { ok: false; reason: string };
}

/**
 * Diagnóstico do mapper para o webhook de teste: mostra o que seria reconhecido
 * numa mensagem sem gravar nada. Serve para ajustar o mapeamento a payloads novos.
 */
export function inspectMessage(message: SasiMessageRaw): MessageInspection {
  const { questionnaire, answers, others } = extract(message);
  const definition = questionnaire ? getQuestionnaire(questionnaire) : null;

  const result = mapMessageToHseRecord(message);
  return {
    channelId: message.channel?.id === undefined ? null : String(message.channel.id),
    teamName: typeof message.team?.name === "string" ? message.team.name : null,
    dataFieldCount: Array.isArray(message.dataFields) ? message.dataFields.length : 0,
    questionnaire,
    itemsRecognized: Object.keys(answers).length,
    missingItems: definition ? definition.items.map((i) => i.number).filter((n) => !(n in answers)) : [],
    unrecognizedFields: others.map((field) => ({
      name: field.name,
      title: typeof field.title === "string" ? field.title.slice(0, 120) : undefined,
      type: field.type,
      // Só o tipo: o valor pode ser dado pessoal (nome) e esta análise é gravada.
      valueKind: Array.isArray(field.value) ? "array" : field.value === null ? "null" : typeof field.value,
    })),
    mapping: result.ok
      ? {
          ok: true,
          questionnaire: result.record.questionnaire,
          setor: result.record.setor,
          idade: result.record.idade,
          respondidoEm: result.record.respondidoEm,
        }
      : { ok: false, reason: result.reason },
  };
}

export function mapMessageToHseRecord(message: SasiMessageRaw): MapResult {
  if (typeof message.id !== "number") return { ok: false, reason: "mensagem sem id" };

  const { questionnaire, answers, others } = extract(message);
  const answered = Object.keys(answers).length;
  if (!questionnaire) {
    return { ok: false, reason: "nenhuma afirmativa reconhecida — não parece uma resposta do questionário" };
  }

  const definition = getQuestionnaire(questionnaire);
  const needed = Math.min(minAnswers(), definition.items.length);
  if (answered < needed) {
    return {
      ok: false,
      reason: `apenas ${answered} de ${definition.items.length} afirmativa(s) reconhecida(s) — não parece uma resposta completa`,
    };
  }

  const idadeField = findMeta(others, envNames("HSE_FIELD_IDADE", ["idade"]));
  const idadeRaw = idadeField ? Number.parseInt(fieldText(idadeField), 10) : Number.NaN;
  const idade = Number.isFinite(idadeRaw) && idadeRaw >= 14 && idadeRaw <= 100 ? idadeRaw : null;

  return {
    ok: true,
    record: {
      messageId: message.id,
      questionnaire,
      setor: resolveSetor(others, message),
      idade,
      respondidoEm: resolveDate(others, message),
      answers,
    },
  };
}
