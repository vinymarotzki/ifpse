/**
 * Simula o SASI: dispara respostas fictícias do HSE IT no webhook, no mesmo
 * formato do evento "io.sasi.message". Serve para ver a dashboard populada e
 * testar o webhook ponta a ponta (inclusive o mascaramento do log).
 *
 *   npm run simulate -- --count 120 --url http://localhost:3000 --secret SEGREDO
 *
 * Flags (ou env): --url/HSE_URL, --secret/HSE_WEBHOOK_SECRET, --count, --days
 * (espalha as respostas pelos últimos N dias), --seed. Dados 100% sintéticos.
 */

import { FACTORS, ITEM_COUNT, ITEM_TEXTS, SCALE, factorOfItem } from "../src/lib/hse/questionnaire";

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const url = arg("url", process.env.HSE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const secret = arg("secret", process.env.HSE_WEBHOOK_SECRET ?? "");
const count = Number.parseInt(arg("count", "120"), 10);
const days = Number.parseInt(arg("days", "150"), 10);
let seed = Number.parseInt(arg("seed", "42"), 10);

/** mulberry32 — determinístico, para o mesmo cenário a cada execução. */
function random(): number {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Pressão extra (0 = saudável, 1 = crítico) por fator, por setor. */
const SECTORS: { name: string; weight: number; pressure: Record<string, number> }[] = [
  { name: "CGC", weight: 3, pressure: { demandas: 0.75, relacionamentos: 0.35, controle: 0.5, "apoio-chefia": 0.3 } },
  { name: "NUPPAE", weight: 2, pressure: { demandas: 0.45, relacionamentos: 0.7, "apoio-colegas": 0.55, "comunicacao-mudancas": 0.6 } },
  { name: "NGOA", weight: 2, pressure: { demandas: 0.3, controle: 0.25, cargo: 0.2 } },
  { name: "AVA", weight: 2, pressure: { demandas: 0.55, "apoio-chefia": 0.65, controle: 0.45 } },
  { name: "CIPA", weight: 1, pressure: { demandas: 0.15, relacionamentos: 0.1 } },
  { name: "Administrativo", weight: 2, pressure: { cargo: 0.5, "comunicacao-mudancas": 0.45, controle: 0.4 } },
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

function scoreFor(item: number, pressure: number): number {
  const factor = factorOfItem(item);
  // Negativos: pressão sobe a nota. Positivos: pressão derruba a nota.
  const base = factor.polarity === "negative" ? 2.1 + pressure * 2.4 : 4.1 - pressure * 2.4;
  const noisy = base + (random() + random() - 1) * 1.6;
  return Math.min(5, Math.max(1, Math.round(noisy)));
}

function isoDaysAgo(daysAgo: number): string {
  const date = new Date(Date.now() - daysAgo * 86_400_000);
  date.setUTCHours(14, Math.floor(random() * 59), 0, 0);
  return date.toISOString();
}

function buildEvent(index: number) {
  const sector = pickSector();
  const generatedAt = isoDaysAgo(Math.floor(random() * days));
  const dataFields: Record<string, unknown>[] = [
    { name: "nome", title: "Nome", type: "text", value: `Servidor Sintético ${index}` },
    { name: "idade", title: "Idade", type: "number", value: 22 + Math.floor(random() * 40) },
    { name: "setor", title: "Setor", type: "select", value: sector.name, formattedValue: [sector.name] },
    { name: "data", title: "Data", type: "date", value: generatedAt.slice(0, 10) },
  ];

  for (let item = 1; item <= ITEM_COUNT; item++) {
    const pressure = Math.min(1, (sector.pressure[factorOfItem(item).id] ?? 0.2) + (random() - 0.5) * 0.2);
    const score = scoreFor(item, pressure);
    dataFields.push({
      name: `afirmativa_${item}`,
      title: ITEM_TEXTS[item - 1],
      type: "select",
      value: score,
      formattedValue: [SCALE[score - 1].label],
    });
  }

  return {
    type: "io.sasi.message",
    data: {
      id: 900_000 + index,
      generatedAt,
      channel: { id: 1, name: "HSE IT (simulação)" },
      // Dados pessoais e credenciais que o log do webhook precisa mascarar.
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
  console.log(`Enviando ${count} resposta(s) para ${url}/api/hse/webhook (${FACTORS.length} fatores)…`);

  const tally: Record<string, number> = {};
  for (let index = 1; index <= count; index++) {
    const response = await fetch(`${url}/api/hse/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-webhook-secret": secret },
      body: JSON.stringify(buildEvent(index)),
    });
    const body = (await response.json().catch(() => ({}))) as { status?: string };
    const key = response.ok ? (body.status ?? "ok") : `HTTP ${response.status}`;
    tally[key] = (tally[key] ?? 0) + 1;
  }
  console.log("Resultado:", tally);
  if (Object.keys(tally).some((key) => key.startsWith("HTTP"))) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
