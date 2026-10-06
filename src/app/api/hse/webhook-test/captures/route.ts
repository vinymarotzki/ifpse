import { NextRequest, NextResponse } from "next/server";
import { listCaptures, testWebhookSecret } from "@/lib/hse/test-captures";
import { isSecretValid } from "@/lib/sasi/webhook-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/hse/webhook-test/captures?secret=...&limit=5
 * Últimas capturas do webhook de teste (mais novas primeiro), já mascaradas, em
 * JSON indentado para ler direto no navegador e colar na conversa.
 */
export async function GET(req: NextRequest) {
  if (!isSecretValid(req, testWebhookSecret())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const limit = Number.parseInt(req.nextUrl.searchParams.get("limit") ?? "", 10);
  try {
    const captures = await listCaptures(Number.isFinite(limit) ? limit : 5);
    return new NextResponse(JSON.stringify({ count: captures.length, captures }, null, 2), {
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  } catch (error) {
    console.error(`[hse-webhook-test] falha ao listar capturas: ${error}`);
    return NextResponse.json({ error: "Falha ao ler as capturas." }, { status: 500 });
  }
}
