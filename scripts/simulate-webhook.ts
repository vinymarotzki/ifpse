/**
 * Simula o SASI: dispara respostas fictícias no webhook, no mesmo formato do evento
 * "io.sasi.message". Serve para ver a dashboard populada e testar o webhook ponta a
 * ponta (inclusive o mascaramento do log).
 *
 *   npm run simulate -- --count 120 --url http://localhost:3000 --secret SEGREDO
 *
 * Flags (ou env): --url/HSE_URL, --secret/HSE_WEBHOOK_SECRET, --count, --days (espalha
 * as respostas pelos últimos N dias), --seed, --path (padrão /api/hse/webhook; use
 * /api/hse/webhook-test para o webhook de teste), --form escola15|hse35 (padrão escola15,
 * o formato real do canal 38274: sem setor/idade — o setor vem do time).
 * Dados 100% sintéticos. Nunca aponte para produção: grava respostas de verdade.
 */

import { normalize } from "../src/lib/hse/mapper";
import { QUESTIONNAIRES, SCALE, type FactorId } from "../src/lib/hse/questionnaire";

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const url = arg("url", process.env.HSE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const path = arg("path", "/api/hse/webhook");
const secret = arg("secret", process.env.HSE_WEBHOOK_SECRET ?? "");
const count = Number.parseInt(arg("count", "120"), 10);
const days = Number.parseInt(arg("days", "150"), 10);
const form = arg("form", "escola15");
let seed = Number.parseInt(arg("seed", "42"), 10);

const slug = (text: string) => normalize(text).replace(/ /g, "_");

/** mulberry32 — determinístico, para o mesmo cenário a cada execução. */
function random(): number {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Pressão extra (0 = saudável, 1 = crítico) por fator, por setor/time. */
const SECTORS: { name: string; weight: number; pressure: Partial<Record<FactorId, number>> }[] = [
  { name: "Escola Municipal Norte", weight: 3, pressure: { demandas: 0.75, relacionamentos: 0.35, controle: 0.5, "apoio-chefia": 0.3 } },
  { name: "Escola Estadual Centro", weight: 2, pressure: { demandas: 0.45, relacionamentos: 0.7, "apoio-colegas": 0.55, "comunicacao-mudancas": 0.6 } },
  { name: "Escola Rural Sul", weight: 2, pressure: { demandas: 0.3, controle: 0.25, cargo: 0.2 } },
  { name: "Colégio Técnico", weight: 2, pressure: { demandas: 0.55, "apoio-chefia": 0.65, controle: 0.45 } },
  { name: "Escola Infantil Leste", weight: 1, pressure: { demandas: 0.15, relacionamentos: 0.1 } },
  { name: "Administração Central", weight: 2, pressure: { cargo: 0.5, "comunicacao-mudancas": 0.45, controle: 0.4 } },
];

function pickSector() {
  const total = SECTORS.reduce((sum, s) => sum + s.weight, 0);
  let roll = random() * total;
  for (const sector of SECTORS) {
    roll -= sector.weight;
    if (roll <= 0) return sector;
  }
  return SECTORS[0];
}

const questionnaire = QUESTIONNAIRES.find((q) => q.id === form);
if (!questionnaire) {
  console.error(`--form inválido: ${form} (use escola15 ou hse35)`);
  process.exit(1);
}

/** Sorteia a nota de RISCO desejada e a converte para a resposta bruta do sentido da afirmativa. */
function scoreFor(highIsBad: boolean, pressure: number): number {
  const risk = Math.min(5, Math.max(1, Math.round(1.8 + pressure * 2.8 + (random() + random() - 1) * 1.6)));
  return highIsBad ? risk : 6 - risk;
}

function isoDaysAgo(daysAgo: number): string {
  const date = new Date(Date.now() - daysAgo * 86_400_000);
  date.setUTCHours(14, Math.floor(random() * 59), 0, 0);
  return date.toISOString();
}

function buildEvent(index: number) {
  const sector = pickSector();
  const generatedAt = isoDaysAgo(Math.floor(random() * days));
  const dataFields: Record<string, unknown>[] = [];

  // O HSE de 35 original pede cabeçalho; o formulário real do canal 38274 não.
  if (form === "hse35") {
    dataFields.push(
      { name: "nome", title: "Nome", type: "text", value: `Servidor Sintético ${index}` },
      { name: "idade", title: "Idade", type: "number", value: 22 + Math.floor(random() * 40) },
      { name: "setor", title: "Setor", type: "select", value: sector.name, formattedValue: [sector.name] },
      { name: "data", title: "Data", type: "date", value: generatedAt.slice(0, 10) }
    );
  }

  for (const item of questionnaire!.items) {
    const pressure = Math.min(1, Math.max(0, (sector.pressure[item.factor] ?? 0.2) + (random() - 0.5) * 0.2));
    const score = scoreFor(item.highIsBad, pressure);
    const label = SCALE[score - 1].label;
    dataFields.push({
      // Formato real: name = slug do título cortado em 50; value "2_raramente"; formattedValue = rótulo.
      name: slug(item.text).slice(0, 50),
      title: item.text,
      type: "radios",
      value: `${score}_${slug(label)}`,
      formattedValue: label,
    });
  }

  return {
    type: "io.sasi.message",
    data: {
      id: 900_000 + index,
      generatedAt,
      channel: { id: 38274, name: "Questionários", mode: "message", channelType: "message" },
      team: { id: 1000 + SECTORS.indexOf(sector), name: sector.name },
      // Dados pessoais e credenciais que o log do webhook precisa mascarar.
      profile: { name: `Servidor Sintético ${index}` },
      profileFields: { telefone: "67 90000-0000", email: "sintetico@example.com" },
      accessToken: "token-sintetico-que-deve-ser-mascarado",
      dataFields,
    },
  };
}

async function main() {
  if (!secret) {
    console.error("Informe o segredo: --secret ... ou HSE_WEBHOOK_SECRET");
    process.exit(1);
  }
  console.log(`Enviando ${count} resposta(s) ${form} para ${url}${path}…`);

  const tally: Record<string, number> = {};
  for (let index = 1; index <= count; index++) {
    const response = await fetch(`${url}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-webhook-secret": secret },
      body: JSON.stringify(buildEvent(index)),
    });
    const body = (await response.json().catch(() => ({}))) as { status?: string; captured?: boolean };
    const key = response.ok ? (body.status ?? (body.captured ? "captured" : "ok")) : `HTTP ${response.status}`;
    tally[key] = (tally[key] ?? 0) + 1;
  }
  console.log("Resultado:", tally);
  if (Object.keys(tally).some((key) => key.startsWith("HTTP"))) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
