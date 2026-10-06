/**
 * Converte uma mensagem SASI (dataFields do formulário HSE IT) num HseRecord.
 *
 * Os nomes dos campos do formulário no SASI não são documentados, então cada
 * afirmativa é localizada por uma cascata tolerante em vez de um nome fixo:
 *   1. o texto da afirmativa aparece no `title`/`name` do campo (mais confiável);
 *   2. o `name` é do tipo "pergunta_12", "q12", "item-12"…;
 *   3. o `title` começa com o número ("12. As relações…", "12) …").
 * A resposta aceita o número 1–5 ou o rótulo ("Nunca" … "Sempre").
 *
 * Regra herdada do cgc-atividades: nunca lança por dado ausente ou inesperado —
 * devolve `{ ok: false, reason }` e o webhook registra o motivo.
 */

import type { SasiDataField, SasiMessageRaw } from "@/lib/sasi/types";
import { ITEM_COUNT, ITEM_TEXTS, SCALE, type Score } from "./questionnaire";

export interface HseRecord {
  messageId: number;
  setor: string;
  /** Idade informada, ou null (não armazenamos nome — só o necessário). */
  idade: number | null;
  /** Data local da resposta, YYYY-MM-DD. */
  respondidoEm: string;
  /** item (1–35) → pontuação (1–5). */
  answers: Record<number, Score>;
}

export type MapResult =
  | { ok: true; record: HseRecord }
  | { ok: false; reason: string };

export const SETOR_NAO_INFORMADO = "Não informado";

const TIMEZONE = process.env.HSE_TIMEZONE || "America/Campo_Grande";

function minAnswers(): number {
  const parsed = Number.parseInt(process.env.HSE_MIN_ANSWERS ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, ITEM_COUNT) : 10;
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

const ITEM_TEXTS_NORM = ITEM_TEXTS.map(normalize);

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

  // "Nunca", "Às vezes", "4 - Frequentemente"… — o rótulo vale mais que o dígito.
  for (const label of LABELS) {
    if (norm === label.norm || norm.endsWith(` ${label.norm}`) || norm.startsWith(`${label.norm} `)) {
      return label.score;
    }
  }
  const digit = /^([1-5])(?:\s|$)/.exec(norm);
  return digit ? (Number(digit[1]) as Score) : null;
}

export function fieldToScore(field: SasiDataField): Score | null {
  for (const candidate of candidates(field)) {
    const score = candidateToScore(candidate);
    if (score) return score;
  }
  return null;
}

const ORDINAL_NAME = /^(?:q|p|i|pergunta|questao|item|afirmativa|afirmacao)\s?0*(\d{1,2})$/;
const ORDINAL_TITLE = /^0*(\d{1,2})\s*(?:[.)\-:]|\s-\s)/;

function inRange(n: number): boolean {
  return n >= 1 && n <= ITEM_COUNT;
}

/** Qual afirmativa (1–35) este campo representa? null se nenhuma. */
export function fieldToItem(field: SasiDataField): number | null {
  const keys = [field.title, field.name].filter((k): k is string => typeof k === "string" && k.trim() !== "");

  // 1. Texto da afirmativa dentro do título/nome — escolhe o casamento mais longo.
  let bestItem: number | null = null;
  let bestLength = 0;
  for (const key of keys) {
    const norm = normalize(key);
    for (let index = 0; index < ITEM_TEXTS_NORM.length; index++) {
      const text = ITEM_TEXTS_NORM[index];
      if (norm.includes(text) && text.length > bestLength) {
        bestItem = index + 1;
        bestLength = text.length;
      }
    }
  }
  if (bestItem !== null) return bestItem;

  // 2. name "pergunta_12" / "q12".
  if (typeof field.name === "string") {
    const match = ORDINAL_NAME.exec(normalize(field.name));
    if (match && inRange(Number(match[1]))) return Number(match[1]);
  }

  // 3. title "12. …" / "12) …".
  if (typeof field.title === "string") {
    const match = ORDINAL_TITLE.exec(field.title.trim());
    if (match && inRange(Number(match[1]))) return Number(match[1]);
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
 * "contém", porque a afirmativa 31 também fala em "meu setor".
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

export interface MessageInspection {
  channelId: string | null;
  dataFieldCount: number;
  itemsRecognized: number;
  /** Afirmativas (1–35) sem campo correspondente ou com resposta ilegível. */
  missingItems: number[];
  /** Campos que não viraram afirmativa nem cabeçalho conhecido — pista do formato real. */
  unrecognizedFields: { name?: string; title?: string; type?: string; valueKind: string }[];
  /** Resultado do mapeamento real, sem as respostas. */
  mapping: { ok: true; setor: string; idade: number | null; respondidoEm: string } | { ok: false; reason: string };
}

/**
 * Diagnóstico do mapper para o webhook de teste: mostra o que seria reconhecido
 * numa mensagem sem gravar nada. Serve para ajustar o mapeamento ao primeiro
 * payload real do canal.
 */
export function inspectMessage(message: SasiMessageRaw): MessageInspection {
  const fields = Array.isArray(message.dataFields) ? message.dataFields : [];
  const seen = new Set<number>();
  const unrecognized: MessageInspection["unrecognizedFields"] = [];

  for (const field of fields) {
    const item = fieldToItem(field);
    if (item !== null) {
      if (fieldToScore(field)) seen.add(item);
      continue;
    }
    unrecognized.push({
      name: field.name,
      title: typeof field.title === "string" ? field.title.slice(0, 120) : undefined,
      type: field.type,
      // Só o tipo: o valor pode ser dado pessoal (nome) e esta análise é gravada.
      valueKind: Array.isArray(field.value) ? "array" : field.value === null ? "null" : typeof field.value,
    });
  }

  const result = mapMessageToHseRecord(message);
  return {
    channelId: message.channel?.id === undefined ? null : String(message.channel.id),
    dataFieldCount: fields.length,
    itemsRecognized: seen.size,
    missingItems: Array.from({ length: ITEM_COUNT }, (_, i) => i + 1).filter((item) => !seen.has(item)),
    unrecognizedFields: unrecognized,
    mapping: result.ok
      ? { ok: true, setor: result.record.setor, idade: result.record.idade, respondidoEm: result.record.respondidoEm }
      : { ok: false, reason: result.reason },
  };
}

export function mapMessageToHseRecord(message: SasiMessageRaw): MapResult {
  if (typeof message.id !== "number") return { ok: false, reason: "mensagem sem id" };

  const fields = Array.isArray(message.dataFields) ? message.dataFields : [];

  const answers: Record<number, Score> = {};
  const metaFields: SasiDataField[] = [];
  for (const field of fields) {
    const item = fieldToItem(field);
    if (item === null) {
      metaFields.push(field);
      continue;
    }
    const score = fieldToScore(field);
    // Primeiro campo válido do item vence (formulário repetido não sobrescreve).
    if (score && !(item in answers)) answers[item] = score;
  }

  const answered = Object.keys(answers).length;
  if (answered < minAnswers()) {
    return { ok: false, reason: `apenas ${answered} afirmativa(s) reconhecida(s) — não parece uma resposta do HSE IT` };
  }

  const setorField = findMeta(metaFields, envNames("HSE_FIELD_SETOR", ["setor", "unidade", "lotacao", "departamento"]));
  const setor = (setorField ? fieldText(setorField) : "").replace(/\s+/g, " ").slice(0, 80) || SETOR_NAO_INFORMADO;

  const idadeField = findMeta(metaFields, envNames("HSE_FIELD_IDADE", ["idade"]));
  const idadeRaw = idadeField ? Number.parseInt(fieldText(idadeField), 10) : Number.NaN;
  const idade = Number.isFinite(idadeRaw) && idadeRaw >= 14 && idadeRaw <= 100 ? idadeRaw : null;

  return {
    ok: true,
    record: {
      messageId: message.id,
      setor,
      idade,
      respondidoEm: resolveDate(metaFields, message),
      answers,
    },
  };
}
