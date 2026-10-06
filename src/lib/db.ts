/**
 * Cliente libSQL (singleton lazy) + DDL. Sem TURSO_DATABASE_URL usa um arquivo
 * local (`file:./data/hse-it.db`) — é o que roda no Docker com volume; em
 * produção aponta para o Turso, mesmo código.
 */

import fs from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";

let client: Client | null = null;
let ready: Promise<void> | null = null;

const DEFAULT_URL = "file:./data/hse-it.db";

export function getDb(): Client {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL?.trim() || DEFAULT_URL;
    if (url.startsWith("file:")) {
      // O libSQL não cria o diretório do arquivo sozinho.
      fs.mkdirSync(path.dirname(path.resolve(url.slice("file:".length))), { recursive: true });
    }
    client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN || undefined });
  }
  return client;
}

/** CREATE IF NOT EXISTS a cada processo (uma vez) — sem ferramenta de migração. */
export function initDb(): Promise<void> {
  if (!ready) {
    ready = getDb()
      .batch(
        [
          `CREATE TABLE IF NOT EXISTS hse_responses (
             message_id INTEGER PRIMARY KEY,
             setor TEXT NOT NULL,
             idade INTEGER,
             respondido_em TEXT NOT NULL,
             answers_json TEXT NOT NULL,
             answered_count INTEGER NOT NULL,
             received_at TEXT NOT NULL,
             updated_at TEXT NOT NULL
           )`,
          `CREATE INDEX IF NOT EXISTS idx_hse_responses_data ON hse_responses (respondido_em)`,
          `CREATE TABLE IF NOT EXISTS hse_webhook_log (
             id TEXT PRIMARY KEY,
             method TEXT NOT NULL,
             authorized INTEGER NOT NULL,
             outcome TEXT,
             headers_json TEXT,
             query_json TEXT,
             body_json TEXT,
             body_raw TEXT,
             received_at TEXT NOT NULL
           )`,
          // Capturas do webhook de teste (descoberta do formato do canal) — nunca
          // alimentam a dashboard.
          `CREATE TABLE IF NOT EXISTS hse_test_captures (
             id TEXT PRIMARY KEY,
             method TEXT NOT NULL,
             headers_json TEXT,
             query_json TEXT,
             body_json TEXT,
             body_raw TEXT,
             analysis_json TEXT,
             received_at TEXT NOT NULL
           )`,
        ],
        "write"
      )
      .then(() => undefined)
      .catch((error) => {
        ready = null;
        throw error;
      });
  }
  return ready;
}
