import { getDb, initDb } from "@/lib/db";
import type { ResponseRow } from "./analytics";
import type { HseRecord } from "./mapper";

/** Upsert por message_id: o SASI pode reenviar/atualizar a mesma mensagem. */
export async function upsertResponse(record: HseRecord): Promise<"created" | "updated"> {
  await initDb();
  const db = getDb();
  const now = new Date().toISOString();

  const existing = await db.execute({
    sql: "SELECT 1 FROM hse_responses WHERE message_id = ?",
    args: [record.messageId],
  });

  await db.execute({
    sql: `INSERT INTO hse_responses
            (message_id, setor, idade, respondido_em, answers_json, answered_count, received_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (message_id) DO UPDATE SET
            setor = excluded.setor,
            idade = excluded.idade,
            respondido_em = excluded.respondido_em,
            answers_json = excluded.answers_json,
            answered_count = excluded.answered_count,
            updated_at = excluded.updated_at`,
    args: [
      record.messageId,
      record.setor,
      record.idade,
      record.respondidoEm,
      JSON.stringify(record.answers),
      Object.keys(record.answers).length,
      now,
      now,
    ],
  });

  return existing.rows.length ? "updated" : "created";
}

export interface ResponseFilter {
  /** Comparação sem caixa/acento feita em memória (o setor é texto livre). */
  setor?: string;
  from?: string;
  to?: string;
}

export async function listResponses(filter: ResponseFilter = {}): Promise<ResponseRow[]> {
  await initDb();
  const where: string[] = [];
  const args: string[] = [];
  if (filter.from) {
    where.push("respondido_em >= ?");
    args.push(filter.from);
  }
  if (filter.to) {
    where.push("respondido_em <= ?");
    args.push(filter.to);
  }

  const result = await getDb().execute({
    sql: `SELECT message_id, setor, idade, respondido_em, answers_json
          FROM hse_responses
          ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
          ORDER BY respondido_em ASC, message_id ASC`,
    args,
  });

  return result.rows.map((row) => {
    let answers: Record<number, number> = {};
    try {
      answers = JSON.parse(String(row.answers_json));
    } catch {
      // Linha corrompida vira resposta vazia em vez de derrubar a dashboard.
    }
    return {
      messageId: Number(row.message_id),
      setor: String(row.setor),
      idade: row.idade === null ? null : Number(row.idade),
      respondidoEm: String(row.respondido_em),
      answers,
    };
  });
}

export async function lastReceivedAt(): Promise<string | null> {
  await initDb();
  const result = await getDb().execute("SELECT MAX(updated_at) AS last FROM hse_responses");
  const last = result.rows[0]?.last;
  return last ? String(last) : null;
}
