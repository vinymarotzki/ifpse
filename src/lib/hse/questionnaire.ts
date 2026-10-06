/**
 * Questionários suportados e os 7 fatores psicossociais do HSE IT (metodologia
 * CGC, escala 1–5).
 *
 * Dois formulários chegam/podem chegar pelo webhook:
 *  - "hse35": o HSE IT original (35 afirmativas) dos PDFs da CGC;
 *  - "escola15": a versão de segurança escolar/CIPA Escolar (15 afirmativas)
 *    publicada no canal 38274 da SASI — mesmos 7 fatores, na mesma ordem.
 *
 * O sentido do risco é da AFIRMATIVA, não do fator: o "escola15" mistura frases
 * positivas ("os colegas colaboram?" — Nunca é ruim) e negativas ("conflitos
 * que dificultam…" — Sempre é ruim) dentro de um mesmo fator. Por isso toda a
 * análise trabalha com a nota de RISCO (1–5, maior = pior), que uniformiza os
 * dois sentidos: `highIsBad ? nota : 6 − nota`.
 */

export type FactorId =
  | "demandas"
  | "relacionamentos"
  | "controle"
  | "apoio-chefia"
  | "apoio-colegas"
  | "cargo"
  | "comunicacao-mudancas";

export interface Factor {
  id: FactorId;
  name: string;
  short: string;
  description: string;
  /** Medidas sugeridas quando o fator sai Moderado ou Alto (metodologia CGC). */
  actions: readonly string[];
}

export const FACTORS: readonly Factor[] = [
  {
    id: "demandas",
    name: "Demandas",
    short: "Demandas",
    description:
      "Carga de trabalho, pressão por resultados, intensidade das atividades, prazos, ritmo e pausas adequadas.",
    actions: [
      "Redimensionamento de equipes",
      "Revisão de processos de trabalho",
      "Adequação de metas e prazos",
      "Controle de horas extras",
      "Implantação de pausas programadas",
    ],
  },
  {
    id: "relacionamentos",
    name: "Relacionamentos",
    short: "Relacionam.",
    description:
      "Conflitos interpessoais, comportamentos inadequados, assédio, respeito entre colegas e qualidade das relações.",
    actions: [
      "Ações de mediação de conflitos",
      "Programas de comunicação não violenta",
      "Capacitação das lideranças",
      "Fortalecimento dos canais de acolhimento e denúncia",
      "Monitoramento do clima organizacional",
    ],
  },
  {
    id: "controle",
    name: "Controle",
    short: "Controle",
    description:
      "Autonomia sobre a execução das atividades, participação nas decisões e influência sobre o ritmo de trabalho.",
    actions: [
      "Ampliação da participação dos trabalhadores",
      "Gestão participativa",
      "Revisão de processos decisórios",
      "Incentivo à autonomia operacional",
    ],
  },
  {
    id: "apoio-chefia",
    name: "Apoio da Chefia",
    short: "Chefia",
    description:
      "Suporte das lideranças, disponibilidade para orientação, feedback e resolução de problemas.",
    actions: [
      "Capacitações para lideranças",
      "Programas de desenvolvimento gerencial",
      "Reuniões periódicas de acompanhamento",
      "Fortalecimento da comunicação entre gestores e equipes",
    ],
  },
  {
    id: "apoio-colegas",
    name: "Apoio dos Colegas",
    short: "Colegas",
    description: "Cooperação, solidariedade, respeito e suporte entre os membros das equipes.",
    actions: [
      "Ações de integração",
      "Programas de trabalho colaborativo",
      "Atividades de fortalecimento das equipes",
      "Estratégias de apoio mútuo entre trabalhadores",
    ],
  },
  {
    id: "cargo",
    name: "Cargo",
    short: "Cargo",
    description:
      "Clareza das responsabilidades, compreensão das atribuições, objetivos e metas organizacionais.",
    actions: [
      "Revisão das descrições de cargos",
      "Alinhamento de expectativas",
      "Divulgação de objetivos institucionais",
      "Programas de integração funcional",
    ],
  },
  {
    id: "comunicacao-mudancas",
    name: "Comunicação e Mudanças",
    short: "Comunic.",
    description:
      "Como as mudanças organizacionais são comunicadas e a participação dos trabalhadores nelas.",
    actions: [
      "Estratégias formais de gestão de mudanças",
      "Comunicação transparente e tempestiva",
      "Participação dos trabalhadores nos processos decisórios",
      "Monitoramento dos impactos das mudanças organizacionais",
    ],
  },
];

export type Score = 1 | 2 | 3 | 4 | 5;

export const SCALE: readonly { score: Score; label: string }[] = [
  { score: 1, label: "Nunca" },
  { score: 2, label: "Raramente" },
  { score: 3, label: "Às vezes" },
  { score: 4, label: "Frequentemente" },
  { score: 5, label: "Sempre" },
];

export type QuestionnaireId = "hse35" | "escola15";

export interface QuestionnaireItem {
  /** Número da afirmativa (1-based) dentro do questionário. */
  number: number;
  text: string;
  factor: FactorId;
  /** true: quanto MAIOR a resposta, pior (ex.: "Tenho prazos impossíveis de cumprir"). */
  highIsBad: boolean;
}

export interface Questionnaire {
  id: QuestionnaireId;
  name: string;
  items: readonly QuestionnaireItem[];
}

/** [fator, quantas afirmativas, highIsBad] na ordem em que aparecem no formulário. */
type Layout = readonly (readonly [FactorId, number, boolean])[];

function build(id: QuestionnaireId, name: string, texts: readonly string[], layout: Layout): Questionnaire {
  const items: QuestionnaireItem[] = [];
  for (const [factor, count, highIsBad] of layout) {
    for (let i = 0; i < count; i++) {
      items.push({ number: items.length + 1, text: texts[items.length], factor, highIsBad });
    }
  }
  if (items.length !== texts.length) throw new Error(`Questionário ${id}: layout não cobre todas as afirmativas`);
  return { id, name, items };
}

/** HSE IT original: Demandas e Relacionamentos são negativos; os demais, de proteção. */
const HSE35 = build(
  "hse35",
  "HSE IT (35 afirmativas)",
  [
    "As exigências de trabalho feitas por colegas e supervisores são difíceis de combinar.",
    "Tenho prazos impossíveis de cumprir.",
    "Devo trabalhar muito intensamente.",
    "Eu não faço algumas tarefas porque tenho muita coisa para fazer.",
    "Não tenho possibilidade de fazer pausas suficientes.",
    "Recebo pressão para trabalhar em outro horário.",
    "Tenho que fazer meu trabalho com muita rapidez.",
    "As pausas temporárias são impossíveis de cumprir.",
    "Falam ou se comportam comigo de forma dura.",
    "Existem conflitos entre os colegas.",
    "Sinto que sou perseguido no trabalho.",
    "As relações no trabalho são tensas.",
    "Posso decidir quando fazer uma pausa.",
    "Consideram a minha opinião sobre a velocidade do meu trabalho.",
    "Tenho liberdade de escolha de como fazer meu trabalho.",
    "Tenho liberdade de escolha para decidir o que fazer no meu trabalho.",
    "Minhas sugestões são consideradas sobre como fazer meu trabalho.",
    "O meu horário de trabalho pode ser flexível.",
    "Recebo informações e suporte que me ajudam no trabalho que eu faço.",
    "Posso confiar no meu chefe quando eu tiver problemas no trabalho.",
    "Quando algo no trabalho me perturba ou irrita posso falar com meu chefe.",
    "Tenho suportado trabalhos emocionalmente exigentes.",
    "Meu chefe me incentiva no trabalho.",
    "Quando o trabalho se torna difícil, posso contar com ajuda dos colegas.",
    "Meus colegas me ajudam e me dão apoio quando eu preciso.",
    "No trabalho os meus colegas demonstram o respeito que mereço.",
    "Os colegas estão disponíveis para escutar os meus problemas de trabalho.",
    "Tenho clareza sobre o que se espera do meu trabalho.",
    "Eu sei como fazer o meu trabalho.",
    "Estão claras as minhas tarefas e responsabilidades.",
    "Os objetivos e metas do meu setor são claros para mim.",
    "Eu vejo como o meu trabalho se encaixa nos objetivos da empresa.",
    "Tenho oportunidades para pedir explicações ao chefe sobre as mudanças no trabalho.",
    "As pessoas são sempre consultadas sobre as mudanças no trabalho.",
    "Quando há mudanças, faço o meu trabalho com o mesmo carinho.",
  ],
  [
    ["demandas", 8, true],
    ["relacionamentos", 4, true],
    ["controle", 6, false],
    ["apoio-chefia", 5, false],
    ["apoio-colegas", 4, false],
    ["cargo", 5, false],
    ["comunicacao-mudancas", 3, false],
  ]
);

/**
 * Versão escolar (canal SASI 38274). O agrupamento em fatores (3-2-2-2-2-2-2) segue
 * o conteúdo e a ordem das afirmativas — CONFIRMAR com a CGC. Só as afirmativas 2
 * ("…dificultando…") e 4 ("conflitos…") são negativas; as demais estão redigidas
 * no sentido positivo.
 */
const ESCOLA15_TEXTS = [
  "Na escola, a quantidade de atividades relacionadas à prevenção e à segurança é compatível com o tempo e as pessoas disponíveis para realizá-las?",
  "As atividades de segurança da escola exigem lidar com muitas informações, tarefas ou situações ao mesmo tempo, dificultando a realização adequada das ações preventivas?",
  "Quando surge uma situação inesperada que pode afetar a segurança da escola, existem condições para lidar com o problema sem prejudicar outras ações importantes de prevenção?",
  "Acontecem conflitos ou desentendimentos entre pessoas da escola que dificultam a comunicação, a cooperação ou a solução de problemas relacionados à segurança?",
  "Quando existe uma situação de risco ou um problema de segurança, as pessoas conseguem conversar e tratar umas às outras com respeito, mesmo quando possuem opiniões diferentes?",
  "As pessoas têm oportunidade de participar das decisões e contribuir com sugestões quando são identificadas situações que podem melhorar a segurança da escola?",
  "Quando uma pessoa identifica uma situação que pode colocar alguém em risco, ela pode comunicar o problema e sugerir uma forma mais segura de agir?",
  "Quando a CIPA Escolar ou outra pessoa comunica uma situação que pode comprometer a segurança, a gestão oferece apoio para que o problema seja analisado e encaminhado?",
  "Quando é identificada uma necessidade de segurança, a escola busca disponibilizar as orientações, condições ou recursos necessários para prevenir ou controlar o problema?",
  "Quando uma pessoa precisa de ajuda para realizar uma ação de prevenção ou lidar com uma situação de risco, os colegas colaboram?",
  "Quando alguém identifica uma informação importante para a segurança da escola, essa informação chega às pessoas que precisam conhecê-la?",
  "Na escola, está claro o que cada pessoa ou equipe deve fazer quando é identificado um risco e quem deve ser comunicado?",
  "Em uma emergência, está claro quando devem ser acionados a gestão, a CIPA Escolar, a Brigada de Incêndio ou outros responsáveis, conforme as orientações da escola?",
  "Quando uma orientação, procedimento ou medida de segurança é criada ou modificada, as pessoas recebem informações suficientes para saber o que mudou e como devem agir?",
  "Quando uma pessoa não entende uma orientação de segurança ou um procedimento de emergência, existe espaço para perguntar e esclarecer a dúvida antes de precisar agir?",
] as const;

/** Sentido por afirmativa do formulário escolar (número da afirmativa → highIsBad). */
const ESCOLA15_HIGH_IS_BAD = new Set([2, 4]);
const ESCOLA15_FACTORS: readonly FactorId[] = [
  "demandas", "demandas", "demandas",
  "relacionamentos", "relacionamentos",
  "controle", "controle",
  "apoio-chefia", "apoio-chefia",
  "apoio-colegas", "apoio-colegas",
  "cargo", "cargo",
  "comunicacao-mudancas", "comunicacao-mudancas",
];

const ESCOLA15: Questionnaire = {
  id: "escola15",
  name: "Segurança escolar (15 afirmativas)",
  items: ESCOLA15_TEXTS.map((text, index) => ({
    number: index + 1,
    text,
    factor: ESCOLA15_FACTORS[index],
    highIsBad: ESCOLA15_HIGH_IS_BAD.has(index + 1),
  })),
};

export const QUESTIONNAIRES: readonly Questionnaire[] = [ESCOLA15, HSE35];

const BY_ID = new Map<string, Questionnaire>(QUESTIONNAIRES.map((q) => [q.id, q]));

/** Questionário desconhecido (linha antiga/corrompida) cai no HSE IT original. */
export function getQuestionnaire(id: string | null | undefined): Questionnaire {
  return (id && BY_ID.get(id)) || HSE35;
}

/** Nota de RISCO (1–5, maior = pior) de uma resposta. */
export function riskScore(item: QuestionnaireItem, score: number): number {
  return item.highIsBad ? score : 6 - score;
}

/** Resposta crítica = nota de risco 4 ou 5 (4–5 nas negativas, 1–2 nas de proteção). */
export function isCriticalRisk(risk: number): boolean {
  return risk >= 4;
}
