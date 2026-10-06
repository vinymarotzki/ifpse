/**
 * Webhook de TESTE: aponte aqui o canal de teste da SASI para descobrir o
 * formato real do primeiro payload. NÃO grava respostas e NÃO alimenta a
 * dashboard — só captura a chamada (credenciais, dados do remetente e campos de
 * identificação mascarados) e diz como o mapper a leria.
 *
 * Ver as capturas: GET /api/hse/webhook-test/captures?secret=...
 *
 * Segredo: HSE_TEST_WEBHOOK_SECRET; se ausente, cai em HSE_WEBHOOK_SECRET.
 * Chamada não autorizada é recusada e nem é gravada (evita lixo no banco).
 * Aceita GET além de POST, para o handshake de cadastro da URL.
 */

import { NextRequest, NextResponse } from "next/server";
import { inspectMessage } from "@/lib/hse/mapper";
import { saveCapture, testWebhookSecret } from "@/lib/hse/test-captures";
import { parseMessage } from "@/lib/sasi/event";
import { isInfraHeader, redactSecretInText, redactSensitive } from "@/lib/sasi/redact";
import { isSecretValid } from "@/lib/sasi/webhook-auth";

export const dynamic = "force-dynamic";

/** Limite do corpo cru guardado quando não é JSON. */
const RAW_LIMIT = 20_000;

async function handle(req: NextRequest) {
  const bodyRaw = (await req.text().catch(() => "")) ?? "";

  if (!isSecretValid(req, testWebhookSecret())) {
    console.warn(`[hse-webhook-test] 401 ${req.method}`);
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let bodyJson: unknown | null = null;
  let analysis: Parameters<typeof saveCapture>[0]["analysis"] = null;
  if (bodyRaw.trim()) {
    const parsed = parseMessage(bodyRaw);
    analysis =
      "reason" in parsed
        ? { reason: parsed.reason }
        : { eventType: parsed.eventType, inspection: inspectMessage(parsed.message) };
    try {
      bodyJson = redactSensitive(JSON.parse(bodyRaw));
    } catch {
      // Não é JSON — fica só em bodyRaw.
    }
  }

  try {
    const id = await saveCapture({
      method: req.method,
      headers: redactSensitive(
        Object.fromEntries(Array.from(req.headers.entries()).filter(([key]) => !isInfraHeader(key)))
      ),
      query: redactSensitive(Object.fromEntries(req.nextUrl.searchParams)),
      bodyJson,
      bodyRaw: bodyJson !== null || !bodyRaw ? null : redactSecretInText(bodyRaw.slice(0, RAW_LIMIT)),
      analysis,
    });
    console.log(`[hse-webhook-test] ${req.method} capturado id=${id} bytes=${bodyRaw.length}`);
    return NextResponse.json({ captured: true, id, analysis });
  } catch (error) {
    console.error(`[hse-webhook-test] falha ao gravar captura: ${error}`);
    return NextResponse.json({ error: "Falha ao gravar a captura." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  return handle(req);
}
