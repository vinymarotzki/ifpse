import type { SasiMessageRaw } from "./types";

/**
 * Extrai a mensagem do corpo: envelope `{ type: "io.sasi.message", data }` (como
 * o SASI manda) ou — por tolerância — a própria mensagem solta com `dataFields`.
 */
export function parseMessage(
  bodyRaw: string
): { message: SasiMessageRaw; eventType: string | null } | { reason: string } {
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
    return { message: event.data as SasiMessageRaw, eventType: event.type === undefined ? null : String(event.type) };
  }
  if (Array.isArray(event.dataFields)) return { message: parsed as SasiMessageRaw, eventType: null };
  return { reason: "evento sem `data` (mensagem)" };
}
