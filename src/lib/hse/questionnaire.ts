/**
 * Estrutura do HSE IT (Management Standards Indicator Tool) conforme o
 * documento da CGC (Albertoni Martins): 35 afirmativas, 7 fatores, escala 1–5.
 *
 * Fonte única de verdade — o mapper, a análise e a dashboard leem só daqui.
 */

export type FactorId =
  | "demandas"
  | "relacionamentos"
  | "controle"
  | "apoio-chefia"
  | "apoio-colegas"
  | "cargo"
  | "comunicacao-mudancas";

/**
 * "negative": quanto MAIOR a frequência, pior (Demandas, Relacionamentos) —
 * respostas críticas são 4 e 5. "positive": fator de proteção, quanto MENOR a
 * frequência, pior — respostas críticas são 1 e 2.
 */
export type FactorPolarity = "negative" | "positive";

export interface Factor {
  id: FactorId;
  name: string;
  short: string;
  polarity: FactorPolarity;
  /** Itens (1-based) que compõem o fator. */
  items: readonly number[];
  description: string;
  /** Medidas sugeridas quando o fator sai Moderado ou Alto (metodologia CGC). */
  actions: readonly string[];
}

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

export const FACTORS: readonly Factor[] = [
  {
    id: "demandas",
    name: "Demandas",
    short: "Demandas",
    polarity: "negative",
    items: range(1, 8),
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
    polarity: "negative",
    items: range(9, 12),
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
    polarity: "positive",
    items: range(13, 18),
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
    polarity: "positive",
    items: range(19, 23),
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
    polarity: "positive",
    items: range(24, 27),
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
    polarity: "positive",
    items: range(28, 32),
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
    polarity: "positive",
    items: range(33, 35),
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

export const ITEM_COUNT = 35;

/** Texto das 35 afirmativas — também usado pelo mapper para casar campos pelo título. */
export const ITEM_TEXTS: readonly string[] = [
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
];

export type Score = 1 | 2 | 3 | 4 | 5;

export const SCALE: readonly { score: Score; label: string }[] = [
  { score: 1, label: "Nunca" },
  { score: 2, label: "Raramente" },
  { score: 3, label: "Às vezes" },
  { score: 4, label: "Frequentemente" },
  { score: 5, label: "Sempre" },
];

const FACTOR_BY_ITEM = new Map<number, Factor>(
  FACTORS.flatMap((factor) => factor.items.map((item) => [item, factor] as const))
);

export function factorOfItem(item: number): Factor {
  const factor = FACTOR_BY_ITEM.get(item);
  if (!factor) throw new Error(`Item fora do questionário: ${item}`);
  return factor;
}

export function isCriticalScore(polarity: FactorPolarity, score: number): boolean {
  return polarity === "negative" ? score >= 4 : score <= 2;
}
