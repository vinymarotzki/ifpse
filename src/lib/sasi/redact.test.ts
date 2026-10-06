import { describe, expect, it } from "vitest";
import { redactSecretInText, redactSensitive } from "./redact";

describe("redactSensitive", () => {
  it("mascara credenciais e dados pessoais do remetente", () => {
    const out = redactSensitive({
      accessToken: "abc",
      profileFields: { telefone: "1" },
      headers: { Authorization: "Bearer x", "x-webhook-secret": "s" },
      keep: "ok",
    }) as Record<string, unknown>;
    expect(out.accessToken).toBe("[REDACTED]");
    expect(out.profileFields).toBe("[REDACTED]");
    expect(out.keep).toBe("ok");
    expect(JSON.stringify(out)).not.toContain("Bearer x");
    expect(JSON.stringify(out)).not.toContain('"s"');
  });

  it("mascara o valor de campos de identificação do formulário, mas não das respostas", () => {
    const out = redactSensitive({
      dataFields: [
        { name: "nome", title: "Nome", value: "Fulano", formattedValue: ["Fulano"] },
        { title: "Analista", value: "Beltrano" },
        { name: "setor", title: "Setor", value: "CGC" },
        { name: "pergunta_1", title: "Tenho prazos impossíveis de cumprir.", value: 4 },
      ],
    });
    const text = JSON.stringify(out);
    expect(text).not.toContain("Fulano");
    expect(text).not.toContain("Beltrano");
    expect(text).toContain("CGC");
    expect(text).toContain('"value":4');
  });

  it("remove ?secret= de URLs ecoadas", () => {
    expect(redactSecretInText("https://x/api?a=1&secret=abc123&b=2")).toBe("https://x/api?a=1&secret=[REDACTED]&b=2");
  });
});
