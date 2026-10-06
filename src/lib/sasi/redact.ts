/**
 * Mascaramento antes de gravar o log cru do webhook. O log existe para
 * auditoria/descoberta do formato do payload, não para virar um segundo cofre
 * de credenciais ou de dados pessoais — e este formulário é de saúde ocupacional.
 */

/** Credenciais vistas no payload real do SASI + dados pessoais do remetente. */
const SENSITIVE_KEYS = new Set([
  "accesstoken",
  "authorization",
  "secret",
  "profilefields",
  "profileprops",
  "customprops",
  "profile",
]);

/** Headers que são artefato de infraestrutura/proxy, não informação do SASI. */
const INFRA_HEADER_PREFIXES = ["x-vercel-", "x-real-ip", "x-forwarded-", "forwarded"];

export function isInfraHeader(name: string): boolean {
  return INFRA_HEADER_PREFIXES.some((prefix) => name.startsWith(prefix));
}

/** `config.callbackUrl` e afins ecoam o `?secret=` do webhook em texto puro. */
export function redactSecretInText(text: string): string {
  return text.replace(/([?&]secret=)[^&\s"]*/gi, "$1[REDACTED]");
}

/**
 * Cabeçalhos de autenticação do webhook — também mascarados no log.
 * (o valor de `x-webhook-secret` é a credencial desta rota.)
 */
const SENSITIVE_HEADERS = new Set(["x-webhook-secret", "cookie"]);

/**
 * Campos de formulário (`dataFields[]`) que identificam a pessoa — o HSE IT pede
 * "Nome", e o log não deve guardar quem respondeu o que.
 */
const PII_FIELD_NAMES = new Set(["nome", "name", "analista", "cpf", "email", "e mail", "telefone", "celular", "matricula"]);

function isPiiFormField(obj: Record<string, unknown>): boolean {
  return [obj.name, obj.title].some(
    (label) =>
      typeof label === "string" &&
      PII_FIELD_NAMES.has(
        label
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, " ")
          .trim()
      )
  );
}

export function redactSensitive(value: unknown): unknown {
  if (typeof value === "string") return redactSecretInText(value);
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const pii = isPiiFormField(record);
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(record)) {
      const lower = key.toLowerCase();
      if (SENSITIVE_KEYS.has(lower) || SENSITIVE_HEADERS.has(lower) || (pii && (lower === "value" || lower === "formattedvalue"))) {
        out[key] = "[REDACTED]";
      } else {
        out[key] = redactSensitive(val);
      }
    }
    return out;
  }
  return value;
}
