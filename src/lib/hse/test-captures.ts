import { getDb, initDb } from "@/lib/db";
import type { MessageInspection } from "./mapper";

/** Quantas capturas manter — são só para descobrir o formato, não um histórico. */
const RETENTION = 50;

/** Segredo do webhook de teste; cai no do webhook principal se não houver um próprio. */
export function testWebhookSecret(): string | undefined {
  return process.env.HSE_TEST_WEBHOOK_SECRET?.trim() || process.env.HSE_WEBHOOK_SECRET;
}

export interface CaptureInput {
  method: string;
  headers: unknown;
  query: unknown;
  /** Corpo já mascarado, se for JSON. */
  bodyJson: unknown | null;
  /** Corpo mascarado e truncado, se NÃO for JSON. */
  bodyRaw: string | null;
  analysis: { eventType: string | null; inspection: MessageInspection } | { reason: string } | null;
}

export async function saveCapture(input: CaptureInput): Promise<string> {
  await initDb();
  const db = getDb();
  const id = crypto.randomUUID();

  await db.execute({
    sql: `INSERT INTO hse_test_captures
            (id, method, headers_json, query_json, body_json, body_raw, analysis_json, received_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      input.method,
      JSON.stringify(input.headers),
      JSON.stringify(input.query),
      input.bodyJson === null ? null : JSON.stringify(input.bodyJson),
      input.bodyRaw,
      input.analysis === null ? null : JSON.stringify(input.analysis),
      new Date().toISOString(),
    ],
  });

  await db.execute({
    sql: `DELETE FROM hse_test_captures WHERE id NOT IN
            (SELECT id FROM hse_test_captures ORDER BY received_at DESC LIMIT ?)`,
    args: [RETENTION],
  });

  return id;
}

function parse(value: unknown): unknown {
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function listCaptures(limit: number) {
  await initDb();
  const result = await getDb().execute({
    sql: `SELECT id, method, headers_json, query_json, body_json, body_raw, analysis_json, received_at
          FROM hse_test_captures ORDER BY received_at DESC LIMIT ?`,
    args: [Math.min(Math.max(limit, 1), RETENTION)],
  });

  return result.rows.map((row) => ({
    id: String(row.id),
    receivedAt: String(row.received_at),
    method: String(row.method),
    headers: parse(row.headers_json),
    query: parse(row.query_json),
    body: parse(row.body_json),
    bodyRaw: row.body_raw === null ? null : String(row.body_raw),
    analysis: parse(row.analysis_json),
  }));
}
