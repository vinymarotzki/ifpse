import { describe, expect, it } from "vitest";
import { QUESTIONNAIRES, SCALE } from "./questionnaire";
import { fieldToItem, fieldToScore, inspectMessage, mapMessageToHseRecord, normalize, parseDateText } from "./mapper";
import type { SasiDataField, SasiMessageRaw } from "@/lib/sasi/types";

const hse = QUESTIONNAIRES.find((q) => q.id === "hse35")!;
const escola = QUESTIONNAIRES.find((q) => q.id === "escola15")!;

/** Campo no formato real do canal 38274: radios, name = slug truncado, value "2_raramente". */
function radios(text: string, score: number): SasiDataField {
  const label = SCALE[score - 1].label;
  return {
    name: normalize(text).replace(/ /g, "_").slice(0, 50),
    title: text,
    type: "radios",
    value: `${score}_${normalize(label).replace(/ /g, "_")}`,
    formattedValue: label,
  };
}

const escolaForm = (score: (n: number) => number) => escola.items.map((i) => radios(i.text, score(i.number)));
const hseForm = (score: (n: number) => number): SasiDataField[] =>
  hse.items.map((i) => ({ title: i.text, formattedValue: [SCALE[score(i.number) - 1].label] }));

describe("fieldToScore", () => {
  it("aceita número 1–5, rótulo, 'n - rótulo' e o formato real '2_raramente'", () => {
    expect(fieldToScore({ value: 4 })).toBe(4);
    expect(fieldToScore({ value: "3" })).toBe(3);
    expect(fieldToScore({ formattedValue: ["Às vezes"] })).toBe(3);
    expect(fieldToScore({ value: "5 - Sempre" })).toBe(5);
    expect(fieldToScore({ value: "nunca" })).toBe(1);
    expect(fieldToScore({ value: "2_raramente", formattedValue: "Raramente" })).toBe(2);
    expect(fieldToScore({ value: "3_as_vezes", formattedValue: "Ás Vezes" })).toBe(3);
    expect(fieldToScore({ value: "4_frequentemente" })).toBe(4);
  });

  it("recusa fora da escala", () => {
    expect(fieldToScore({ value: 0 })).toBeNull();
    expect(fieldToScore({ value: 7 })).toBeNull();
    expect(fieldToScore({ value: "talvez" })).toBeNull();
    expect(fieldToScore({})).toBeNull();
  });

  it("ignora N/A ('Não tenho elementos para avaliar'), mesmo com dígito no value", () => {
    expect(fieldToScore({ formattedValue: "Não tenho elementos para avaliar" })).toBeNull();
    expect(fieldToScore({ value: "5_nao_tenho_elementos", formattedValue: "Sempre" })).toBeNull();
  });

  it("prefere o rótulo ao value quando divergem (value = id de opção)", () => {
    expect(fieldToScore({ value: 98123, formattedValue: "Frequentemente" })).toBe(4);
  });
});

describe("fieldToItem", () => {
  it("casa pelo texto da afirmativa e identifica o questionário", () => {
    expect(fieldToItem({ title: escola.items[6].text })).toEqual({ questionnaire: "escola15", number: 7 });
    expect(fieldToItem({ title: "12. As relações no trabalho são tensas" })).toEqual({ questionnaire: "hse35", number: 12 });
  });

  it("não confunde afirmativas parecidas (15 × 16 do HSE, 12 × 13 da escola)", () => {
    expect(fieldToItem({ title: hse.items[14].text })).toEqual({ questionnaire: "hse35", number: 15 });
    expect(fieldToItem({ title: hse.items[15].text })).toEqual({ questionnaire: "hse35", number: 16 });
    expect(fieldToItem({ title: escola.items[11].text })).toEqual({ questionnaire: "escola15", number: 12 });
    expect(fieldToItem({ title: escola.items[12].text })).toEqual({ questionnaire: "escola15", number: 13 });
  });

  it("cai para o slug do name quando o título foi editado ou não vem", () => {
    const slug = radios(escola.items[2].text, 3).name;
    expect(fieldToItem({ name: slug, title: "Texto reescrito pela escola" })).toEqual({ questionnaire: "escola15", number: 3 });
    expect(fieldToItem({ name: slug })).toEqual({ questionnaire: "escola15", number: 3 });
  });

  it("cai para a ordem só no questionário de 35", () => {
    expect(fieldToItem({ name: "pergunta_7" })).toEqual({ questionnaire: "hse35", number: 7 });
    expect(fieldToItem({ name: "Q07" })).toEqual({ questionnaire: "hse35", number: 7 });
    expect(fieldToItem({ title: "35) Qualquer texto" })).toEqual({ questionnaire: "hse35", number: 35 });
    expect(fieldToItem({ name: "pergunta_36" })).toBeNull();
  });

  it("campos de cabeçalho não viram afirmativa", () => {
    expect(fieldToItem({ name: "setor", title: "Setor" })).toBeNull();
    expect(fieldToItem({ name: "idade", title: "Idade" })).toBeNull();
    expect(fieldToItem({ name: "descreva", title: "Descreva" })).toBeNull();
  });
});

describe("mapMessageToHseRecord — formulário escolar (formato real)", () => {
  const message: SasiMessageRaw = {
    id: 35034472,
    generatedAt: "2026-10-06T19:30:17.000Z",
    channel: { id: 38274, name: "Questionários" },
    team: { id: 775, name: "Time de Teste" },
    dataFields: escolaForm((n) => (n % 5) + 1),
  };

  it("reconhece as 15 afirmativas, o questionário, o setor pelo time e a data por generatedAt", () => {
    const result = mapMessageToHseRecord(message);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.record.questionnaire).toBe("escola15");
    expect(Object.keys(result.record.answers)).toHaveLength(15);
    expect(result.record.answers[1]).toBe(2);
    expect(result.record.answers[4]).toBe(5);
    expect(result.record.setor).toBe("Time de Teste");
    expect(result.record.idade).toBeNull();
    expect(result.record.respondidoEm).toBe("2026-10-06");
  });

  it("aceita um campo 'setor' do formulário acima do nome do time", () => {
    const result = mapMessageToHseRecord({
      ...message,
      dataFields: [{ name: "setor", title: "Setor", value: "Escola Norte" }, ...(message.dataFields ?? [])],
    });
    expect(result.ok && result.record.setor).toBe("Escola Norte");
  });

  it("sem time nem campo, o setor é 'Não informado'", () => {
    const result = mapMessageToHseRecord({ ...message, team: null });
    expect(result.ok && result.record.setor).toBe("Não informado");
  });

  it("recusa resposta incompleta demais", () => {
    const result = mapMessageToHseRecord({ ...message, dataFields: escolaForm(() => 3).slice(0, 5) });
    expect(result.ok).toBe(false);
  });
});

describe("mapMessageToHseRecord — questionário de 35 e casos gerais", () => {
  const meta: SasiDataField[] = [
    { name: "setor", title: "Setor", value: "CGC" },
    { name: "idade", title: "Idade", value: "34" },
    { name: "data", title: "Data", value: "06/10/2026" },
    { name: "nome", title: "Nome", value: "Fulano" },
  ];

  it("mapeia um formulário completo e os campos de cabeçalho", () => {
    const result = mapMessageToHseRecord({ id: 1, dataFields: [...meta, ...hseForm((n) => (n % 5) + 1)] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.record.questionnaire).toBe("hse35");
    expect(Object.keys(result.record.answers)).toHaveLength(35);
    expect(result.record.answers[5]).toBe(1);
    expect(result.record.setor).toBe("CGC");
    expect(result.record.idade).toBe(34);
    expect(result.record.respondidoEm).toBe("2026-10-06");
    expect(JSON.stringify(result.record)).not.toContain("Fulano");
  });

  it("não confunde a afirmativa 31 ('…meu setor…') com o campo setor", () => {
    const result = mapMessageToHseRecord({
      id: 3,
      dataFields: [{ name: "setor", title: "Setor", value: "AVA" }, ...hseForm(() => 4)],
    });
    expect(result.ok && result.record.setor).toBe("AVA");
  });

  it("uma mensagem que mistura os dois formulários fica com o que casou mais", () => {
    const result = mapMessageToHseRecord({ id: 9, dataFields: [...escolaForm(() => 3), ...hseForm(() => 3).slice(0, 12)] });
    expect(result.ok && result.record.questionnaire).toBe("escola15");
  });

  it("recusa mensagem que não parece do questionário", () => {
    expect(mapMessageToHseRecord({ id: 4, dataFields: [{ name: "descreva", value: "texto" }] }).ok).toBe(false);
  });

  it("recusa mensagem sem id e nunca lança com dataFields ausente", () => {
    expect(mapMessageToHseRecord({}).ok).toBe(false);
    expect(mapMessageToHseRecord({ id: 5 }).ok).toBe(false);
  });
});

describe("inspectMessage", () => {
  it("relata questionário, time, afirmativas faltantes e campos não reconhecidos, sem expor valores", () => {
    const fields = escolaForm(() => 4).filter((f) => !f.title?.startsWith("Em uma emergência"));
    const report = inspectMessage({
      id: 7,
      channel: { id: 38274 },
      team: { name: "Escola A" },
      dataFields: [{ name: "nome", title: "Nome", type: "text", value: "Fulano" }, ...fields],
    });
    expect(report.channelId).toBe("38274");
    expect(report.teamName).toBe("Escola A");
    expect(report.questionnaire).toBe("escola15");
    expect(report.itemsRecognized).toBe(14);
    expect(report.missingItems).toEqual([13]);
    expect(report.unrecognizedFields.map((f) => f.name)).toEqual(["nome"]);
    expect(report.unrecognizedFields[0].valueKind).toBe("string");
    expect(JSON.stringify(report)).not.toContain("Fulano");
    expect(report.mapping).toMatchObject({ ok: true, questionnaire: "escola15", setor: "Escola A" });
  });

  it("explica por que um payload qualquer não seria aceito", () => {
    const report = inspectMessage({ id: 8, dataFields: [{ name: "descreva", title: "Descreva", value: "x" }] });
    expect(report.questionnaire).toBeNull();
    expect(report.itemsRecognized).toBe(0);
    expect(report.mapping.ok).toBe(false);
  });
});

describe("parseDateText", () => {
  it("lê ISO e dd/mm/aaaa", () => {
    expect(parseDateText("2026-10-06T12:00:00Z")).toBe("2026-10-06");
    expect(parseDateText("6/1/2026")).toBe("2026-01-06");
    expect(parseDateText("ontem")).toBeNull();
  });
});
