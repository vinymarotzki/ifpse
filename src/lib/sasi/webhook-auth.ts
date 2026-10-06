import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Segredo no header `x-webhook-secret` ou na query `?secret=` (o painel do SASI
 * pode não permitir header customizado). `secret` vazio/indefinido recusa tudo.
 */
export function isSecretValid(req: NextRequest, secret: string | undefined): boolean {
  const expected = secret?.trim();
  if (!expected) return false;

  const provided = [req.headers.get("x-webhook-secret"), req.nextUrl.searchParams.get("secret")];
  return provided.some((value) => value !== null && safeEqual(value.trim(), expected));
}
