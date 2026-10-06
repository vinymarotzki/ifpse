/**
 * Webhook ÚNICO do HSE IT: recebe as respostas do questionário vindas da API
 * SASI. Cadastrado manualmente no painel do SASI apontando para esta rota —
 * mesmo padrão do webhook do cgc-atividades (evento "io.sasi.message" com a
 * mensagem inteira em `data`).
 *
 * Segredo (HSE_WEBHOOK_SECRET): aceito no header `x-webhook-secret` ou na query
 * `?secret=`, porque o painel do SASI pode não permitir header customizado.
 * Sem a env var configurada, toda chamada é recusada.
 *
 * Aceita GET além de POST: alguns provedores fazem um handshake na URL antes de
 * aceitar o cadastro. GET autorizado responde 200 sem ingerir nada.
 *
 * Sempre grava a chamada crua em hse_webhook_log (credenciais e dados pessoais
 * mascarados) — o formato do formulário não é documentado, então é assim que se
 * descobre/depura o que realmente chega.
 */

import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getDb, initDb } from "@/lib/db";
import { mapMessageToHseRecord } from "@/lib/hse/mapper";
import { upsertResponse } from "@/lib/hse/store";
import { isInfraHeader, redactSecretInText, redactSensitive } from "@/lib/sasi/redact";
import type { SasiMessageRaw } from "@/lib/sasi/types";

export const dynamic = "force-dynamic";

/** Quantas chamadas cruas manter no log (as mais antigas são podadas). */
const LOG_RETENTION = 500;

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.HSE_WEBHOOK_SECRET?.trim();
  if (!secret) return false;

  const provided = [req.headers.get("x-webhook-secret"), req.nextUrl.searchParams.get("secret")];
  return provided.some((value) => value !== null && safeEqual(value.trim(), secret));
}

type Outcome =
  | { status: "unauthorized" }
  | { status: "handshake" }
  | { status: "ignored"; reason: string }
  | { status: "created" | "updated"; messageId: number; answered: number };

/**
 * Extrai a mensagem do corpo: envelope `{ type: "io.sasi.message", data }` (como
 * o SASI manda) ou — por tolerância — a própria mensagem solta com `dataFields`.
 */
function parseMessage(bodyRaw: string): { message: SasiMessageRaw } | { reason: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyRaw);
  } catch {
    return { reason: "corpo não é JSON" };
  }
  if (!parsed || typeof parsed !== "object") return { reason: "corpo JSON inesperado" };

  const event = parsed as { type?: unknown; data?: unknown; dataFields?: unknown };
  if (event.data && typeof event.data === "object") {
    if (event.type !== undefined && event.type !== "io.sasi.message") {
      return { reason: `evento ${String(event.type)} não é de mensagem` };
    }
    return { message: event.data as SasiMessageRaw };
  }
  if (Array.isArray(event.dataFields)) return { message: parsed as SasiMessageRaw };
  return { reason: "evento sem `data` (mensagem)" };
}

function channelAllowed(message: SasiMessageRaw): boolean {
  const wanted = process.env.HSE_CHANNEL_ID?.trim();
  if (!wanted) return true;
  return String(message.channel?.id ?? "") === wanted;
}

async function ingest(bodyRaw: string): Promise<Outcome> {
  const parsed = parseMessage(bodyRaw);
  if ("reason" in parsed) return { status: "ignored", reason: parsed.reason };

  if (!channelAllowed(parsed.message)) {
    return { status: "ignored", reason: `canal ${String(parsed.message.channel?.id)} diferente de HSE_CHANNEL_ID` };
  }

  const mapped = mapMessageToHseRecord(parsed.message);
  if (!mapped.ok) return { status: "ignored", reason: mapped.reason };

  const status = await upsertResponse(mapped.record);
  return { status, messageId: mapped.record.messageId, answered: Object.keys(mapped.record.answers).length };
}

/** Best-effort: um log que falha nunca derruba o recebimento. */
async function logCall(req: NextRequest, authorized: boolean, bodyRaw: string | null, outcome: Outcome) {
  try {
    await initDb();
    const db = getDb();

    const headers = redactSensitive(
      Object.fromEntries(Array.from(req.headers.entries()).filter(([key]) => !isInfraHeader(key)))
    );

    let bodyJson: string | null = null;
    if (bodyRaw) {
      try {
        bodyJson = JSON.stringify(redactSensitive(JSON.parse(bodyRaw)));
      } catch {
        // Não é JSON — fica só em body_raw.
      }
    }

    await db.execute({
      sql: `INSERT INTO hse_webhook_log
              (id, method, authorized, outcome, headers_json, query_json, body_json, body_raw, received_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        crypto.randomUUID(),
        req.method,
        authorized ? 1 : 0,
        JSON.stringify(outcome),
        JSON.stringify(headers),
        JSON.stringify(redactSensitive(Object.fromEntries(req.nextUrl.searchParams))),
        bodyJson,
        bodyJson || !bodyRaw ? null : redactSecretInText(bodyRaw.slice(0, 20_000)),
        new Date().toISOString(),
      ],
    });

    await db.execute({
      sql: `DELETE FROM hse_webhook_log WHERE id NOT IN
              (SELECT id FROM hse_webhook_log ORDER BY received_at DESC LIMIT ?)`,
      args: [LOG_RETENTION],
    });
  } catch (error) {
    console.error(`[hse-webhook] falha ao gravar log: ${error}`);
  }
}

async function handle(req: NextRequest) {
  const bodyRaw = await req.text().catch(() => null);
  const authorized = isAuthorized(req);

  if (!authorized) {
    console.warn(`[hse-webhook] 401 ${req.method}`);
    await logCall(req, false, bodyRaw || null, { status: "unauthorized" });
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let outcome: Outcome;
  if (!bodyRaw?.trim()) {
    outcome = { status: "handshake" };
  } else {
    try {
      outcome = await ingest(bodyRaw);
    } catch (error) {
      console.error(`[hse-webhook] falha ao gravar resposta: ${error}`);
      await logCall(req, true, bodyRaw, { status: "ignored", reason: "erro interno ao gravar" });
      return NextResponse.json({ error: "Falha ao gravar a resposta." }, { status: 500 });
    }
  }

  console.log(`[hse-webhook] ${req.method} -> ${JSON.stringify(outcome)}`);
  await logCall(req, true, bodyRaw || null, outcome);

  // 200 também para "ignored": o SASI não deve reenviar eventos que não são do HSE IT.
  return NextResponse.json({ received: true, ...outcome });
}

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  return handle(req);
}
