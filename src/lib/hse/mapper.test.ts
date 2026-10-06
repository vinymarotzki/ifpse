import { describe, expect, it } from "vitest";
import { ITEM_COUNT, ITEM_TEXTS, SCALE } from "./questionnaire";
import { fieldToItem, fieldToScore, mapMessageToHseRecord, parseDateText } from "./mapper";
import type { SasiDataField, SasiMessageRaw } from "@/lib/sasi/types";

function fullForm(build: (item: number) => SasiDataField): SasiDataField[] {
  return Array.from({ length: ITEM_COUNT }, (_, i) => build(i + 1));
}

const meta: SasiDataField[] = [
  { name: "setor", title: "Setor", value: "CGC" },
  { name: "idade", title: "Idade", value: "34" },
  { name: "data", title: "Data", value: "06/10/2026" },
  { name: "nome", title: "Nome", value: "Fulano" },
];

describe("fieldToScore", () => {
  it("aceita número 1–5, rótulo e 'n - rótulo'", () => {
    expect(fieldToScore({ value: 4 })).toBe(4);
    expect(fieldToScore({ value: "3" })).toBe(3);
    expect(fieldToScore({ formattedValue: ["Às vezes"] })).toBe(3);
    expect(fieldToScore({ value: "5 - Sempre" })).toBe(5);
    expect(fieldToScore({ value: "nunca" })).toBe(1);
  });

  it("recusa fora da escala", () => {
    expect(fieldToScore({ value: 0 })).toBeNull();
    expect(fieldToScore({ value: 7 })).toBeNull();
    expect(fieldToScore({ value: "talvez" })).toBeNull();
    expect(fieldToScore({})).toBeNull();
  });

  it("prefere o rótulo ao value quando divergem (value = id de opção)", () => {
    expect(fieldToScore({ value: 98123, formattedValue: "Frequentemente" })).toBe(4);
  });
});

describe("fieldToItem", () => {
  it("casa pelo texto da afirmativa, ignorando acento/pontuação/prefixo numérico", () => {
    expect(fieldToItem({ title: "12. As relações no trabalho são tensas" })).toBe(12);
    expect(fieldToItem({ title: ITEM_TEXTS[28] })).toBe(29);
  });

  it("não confunde afirmativas parecidas (15 × 16, 29 × 28)", () => {
    expect(fieldToItem({ title: ITEM_TEXTS[14] })).toBe(15);
    expect(fieldToItem({ title: ITEM_TEXTS[15] })).toBe(16);
  });

  it("cai para a ordem no name ou no começo do título", () => {
    expect(fieldToItem({ name: "pergunta_7" })).toBe(7);
    expect(fieldToItem({ name: "Q07" })).toBe(7);
    expect(fieldToItem({ title: "35) Qualquer texto" })).toBe(35);
    expect(fieldToItem({ name: "pergunta_36" })).toBeNull();
  });

  it("campos de cabeçalho não viram afirmativa", () => {
    expect(fieldToItem({ name: "setor", title: "Setor" })).toBeNull();
    expect(fieldToItem({ name: "idade", title: "Idade" })).toBeNull();
  });
});

describe("mapMessageToHseRecord", () => {
  it("mapeia um formulário completo e os campos de cabeçalho", () => {
    const message: SasiMessageRaw = {
      id: 1,
      dataFields: [
        ...meta,
        ...fullForm((item) => ({ title: ITEM_TEXTS[item - 1], formattedValue: [SCALE[item % 5].label] })),
      ],
    };
    const result = mapMessageToHseRecord(message);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.record.answers)).toHaveLength(ITEM_COUNT);
    expect(result.record.answers[5]).toBe(1); // 5 % 5 = 0 → "Nunca"
    expect(result.record.setor).toBe("CGC");
    expect(result.record.idade).toBe(34);
    expect(result.record.respondidoEm).toBe("2026-10-06");
  });

  it("não armazena o nome e usa 'Não informado' sem setor", () => {
    const result = mapMessageToHseRecord({
      id: 2,
      generatedAt: "2026-03-10T15:00:00Z",
      dataFields: fullForm((item) => ({ name: `pergunta_${item}`, value: 3 })),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.record.setor).toBe("Não informado");
    expect(result.record.respondidoEm).toBe("2026-03-10");
    expect(JSON.stringify(result.record)).not.toContain("Fulano");
  });

  it("não confunde a afirmativa 31 ('…meu setor…') com o campo setor", () => {
    const result = mapMessageToHseRecord({
      id: 3,
      dataFields: [
        { name: "setor", title: "Setor", value: "AVA" },
        ...fullForm((item) => ({ title: ITEM_TEXTS[item - 1], value: 4 })),
      ],
    });
    expect(result.ok && result.record.setor).toBe("AVA");
  });

  it("recusa mensagem que não parece HSE IT", () => {
    const result = mapMessageToHseRecord({ id: 4, dataFields: [{ name: "descreva", value: "texto" }] });
    expect(result.ok).toBe(false);
  });

  it("recusa mensagem sem id e nunca lança com dataFields ausente", () => {
    expect(mapMessageToHseRecord({}).ok).toBe(false);
    expect(mapMessageToHseRecord({ id: 5 }).ok).toBe(false);
  });
});

describe("parseDateText", () => {
  it("lê ISO e dd/mm/aaaa", () => {
    expect(parseDateText("2026-10-06T12:00:00Z")).toBe("2026-10-06");
    expect(parseDateText("6/1/2026")).toBe("2026-01-06");
    expect(parseDateText("ontem")).toBeNull();
  });
});
