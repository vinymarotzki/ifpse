"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ESCOLA15_TEXTS, type FactorId } from "@/lib/hse/questionnaire";
import type { RiskLevel } from "@/lib/hse/risk";
import { makeFormatters, type Formatters, type Lang } from "./format";

/*
 * Tradução só na camada de apresentação: o servidor (webhook, banco, analytics)
 * continua em português. O texto vem do dicionário abaixo e os fatores/afirmativas
 * são resolvidos por id/ordem, nunca pelo texto em português que chega da API.
 */

export const LANG_KEY = "ifpse-lang";
export const THEME_KEY = "ifpse-theme";

export type ThemeMode = "system" | "light" | "dark";

interface FactorText {
  name: string;
  short: string;
  description: string;
  actions: readonly string[];
}

interface Dict {
  htmlTitle: string;
  title: string;
  updated: string;
  noDataYet: string;
  refresh: string;
  refreshAria: string;
  language: string;
  theme: string;
  themeModes: Record<ThemeMode, string>;
  sector: string;
  allSectors: string;
  period: string;
  presets: { all: string; d30: string; d90: string; year: string };
  customPeriod: string;
  /** "05/15/2026 to 10/07/2026": palavra entre as duas datas do resumo. */
  rangeTo: string;
  from: string;
  to: string;
  loadError: string;
  loading: string;
  emptyFilteredTitle: string;
  emptyTitle: string;
  emptyFilteredText: string;
  emptyText: string;
  respondents: string;
  formSchool: string;
  formFull: string;
  overallIndex: string;
  highFactors: string;
  ofSeven: string;
  moderateLow: (moderate: number, low: number) => string;
  riskLabel: Record<RiskLevel, string>;
  noData: string;
  riskProfileTitle: string;
  riskProfileSub: string;
  radarAria: string;
  radarTooltip: string;
  topItemsTitle: string;
  topItemsSub: string;
  riskIndexWord: string;
  criticalShare: (pct: string, count: string, total: string) => string;
  timelineTitle: string;
  timelineSub: string;
  timelineAria: string;
  timelineResponses: (n: string) => string;
  timelineNote: (high: string, highLabel: string, granularity: "day" | "month") => string;
  sectorHeatTitle: string;
  sectorHeatSub: string;
  sectorWord: string;
  respShort: (n: string) => string;
  heatTooltip: (sector: string, factor: string, index: string, level: string) => string;
  respBySectorTitle: string;
  respondentUnit: (n: string) => string;
  actionPlanTitle: string;
  actionPlanSub: string;
  planText: Record<RiskLevel, string>;
  planNone: string;
  planLine: (index: string, pct: string) => string;
  howToReadTitle: string;
  footer: string;
  methodology: {
    scaleTitle: string;
    scaleBody: string;
    classTitle: string;
    classBody: ReactNode;
    thresholds: (high: string, moderate: string) => string;
    criticalTitle: string;
    criticalBody: (strong: (text: string) => ReactNode) => ReactNode;
  };
  factors: Record<FactorId, FactorText>;
}

const pt: Dict = {
  htmlTitle: "IFPSE · Riscos Psicossociais",
  title: "Riscos Psicossociais",
  updated: "Atualizado:",
  noDataYet: "ainda sem dados",
  refresh: "Atualizar",
  refreshAria: "Atualizar agora",
  language: "Idioma",
  theme: "Tema",
  themeModes: { system: "Automático", light: "Claro", dark: "Escuro" },
  sector: "Setor",
  allSectors: "Todos os setores",
  period: "Período",
  presets: { all: "Tudo", d30: "30 dias", d90: "90 dias", year: "Este ano" },
  customPeriod: "Personalizado",
  rangeTo: "a",
  from: "De",
  to: "Até",
  loadError: "Não foi possível carregar os dados. Tentando novamente…",
  loading: "Carregando…",
  emptyFilteredTitle: "Nenhuma resposta neste filtro",
  emptyTitle: "Aguardando as respostas da SASI",
  emptyFilteredText: "Ajuste o setor ou o período para ver os resultados.",
  emptyText: "Assim que a API da SASI enviar a primeira resposta para o webhook, os gráficos aparecem aqui automaticamente.",
  respondents: "Respondentes",
  formSchool: "escolar",
  formFull: "completo (35)",
  overallIndex: "Índice geral de risco",
  highFactors: "Fatores em risco Alto",
  ofSeven: "de 7",
  moderateLow: (moderate, low) => `${moderate} moderado(s) · ${low} baixo(s)`,
  riskLabel: { alto: "Alto", moderado: "Moderado", baixo: "Baixo" },
  noData: "Sem dados",
  riskProfileTitle: "Perfil de risco",
  riskProfileSub: "Índice de risco por fator (1 a 5, maior = pior)",
  radarAria: "Radar do índice de risco por fator",
  radarTooltip: "Índice de risco",
  topItemsTitle: "Afirmativas mais críticas",
  topItemsSub: "Maior proporção de respostas críticas entre as afirmativas do questionário",
  riskIndexWord: "índice de risco",
  criticalShare: (pct, count, total) => `${pct}% de respostas críticas (${count} de ${total})`,
  timelineTitle: "Evolução no tempo",
  timelineSub: "Índice de risco por fator",
  timelineAria: "Evolução do índice de risco por fator ao longo do tempo",
  timelineResponses: (n) => `${n} resposta(s) no período`,
  timelineNote: (high, highLabel, granularity) =>
    `Índice de risco de 1 a 5 (quanto maior, pior). Acima da linha tracejada vermelha (${high}) o fator é ${highLabel}.${
      granularity === "month" ? " Agrupado por mês." : " Agrupado por dia."
    }`,
  sectorHeatTitle: "Setores × fatores",
  sectorHeatSub: "Média e nível de risco de cada fator por setor — mais críticos primeiro",
  sectorWord: "Setor",
  respShort: (n) => `${n} resp.`,
  heatTooltip: (sector, factor, index, level) => `${sector} · ${factor}: índice de risco ${index}${level ? ` (${level})` : ""}`,
  respBySectorTitle: "Respondentes por setor",
  respondentUnit: (n) => `${n} respondente(s)`,
  actionPlanTitle: "Plano de ação",
  actionPlanSub: "Fatores Altos exigem plano específico; Moderados, avaliação de medidas (metodologia CGC)",
  planText: {
    alto: "Plano de ação específico obrigatório (eliminar, reduzir ou controlar as causas).",
    moderado: "Avaliar as medidas abaixo e manter monitoramento periódico.",
    baixo: "Monitoramento periódico.",
  },
  planNone: "Nenhum fator em risco Moderado ou Alto — manter o monitoramento periódico.",
  planLine: (index, pct) => `Índice de risco ${index} · ${pct}% de respostas críticas`,
  howToReadTitle: "Como ler esta dashboard",
  footer: "Dados agregados e anônimos · recebidos pelo webhook da API SASI",
  methodology: {
    scaleTitle: "Escala de resposta",
    scaleBody: "Nunca = 1 · Raramente = 2 · Às vezes = 3 · Frequentemente = 4 · Sempre = 5. Considera os últimos seis meses.",
    classTitle: "Classificação por fator",
    classBody: (
      <>
        Cada resposta vira uma <em>nota de risco</em> de 1 a 5 (maior = pior): em afirmativas negativas (ex.: &ldquo;tenho prazos
        impossíveis&rdquo;) vale a própria resposta; nas positivas (ex.: &ldquo;os colegas colaboram&rdquo;) a escala é invertida. A
        média das notas do fator é o <em>índice de risco</em>.
      </>
    ),
    thresholds: (high, moderate) => `Alto a partir de ${high}, Moderado a partir de ${moderate}, Baixo abaixo disso.`,
    criticalTitle: "Respostas críticas",
    criticalBody: (strong) => (
      <>
        São as respostas com nota de risco 4 ou 5: &ldquo;Frequentemente/Sempre&rdquo; em afirmativas negativas e
        &ldquo;Nunca/Raramente&rdquo; nas positivas. Quanto maior a proporção, maior a exposição ao risco psicossocial daquele
        fator. Fatores em {strong("Alto")} exigem plano de ação.
      </>
    ),
  },
  factors: {
    demandas: {
      name: "Demandas",
      short: "Demandas",
      description: "Carga de trabalho, pressão por resultados, intensidade das atividades, prazos, ritmo e pausas adequadas.",
      actions: [
        "Redimensionamento de equipes",
        "Revisão de processos de trabalho",
        "Adequação de metas e prazos",
        "Controle de horas extras",
        "Implantação de pausas programadas",
      ],
    },
    relacionamentos: {
      name: "Relacionamentos",
      short: "Relacionam.",
      description: "Conflitos interpessoais, comportamentos inadequados, assédio, respeito entre colegas e qualidade das relações.",
      actions: [
        "Ações de mediação de conflitos",
        "Programas de comunicação não violenta",
        "Capacitação das lideranças",
        "Fortalecimento dos canais de acolhimento e denúncia",
        "Monitoramento do clima organizacional",
      ],
    },
    controle: {
      name: "Controle",
      short: "Controle",
      description: "Autonomia sobre a execução das atividades, participação nas decisões e influência sobre o ritmo de trabalho.",
      actions: [
        "Ampliação da participação dos trabalhadores",
        "Gestão participativa",
        "Revisão de processos decisórios",
        "Incentivo à autonomia operacional",
      ],
    },
    "apoio-chefia": {
      name: "Apoio da Chefia",
      short: "Chefia",
      description: "Suporte das lideranças, disponibilidade para orientação, feedback e resolução de problemas.",
      actions: [
        "Capacitações para lideranças",
        "Programas de desenvolvimento gerencial",
        "Reuniões periódicas de acompanhamento",
        "Fortalecimento da comunicação entre gestores e equipes",
      ],
    },
    "apoio-colegas": {
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
    cargo: {
      name: "Cargo",
      short: "Cargo",
      description: "Clareza das responsabilidades, compreensão das atribuições, objetivos e metas organizacionais.",
      actions: [
        "Revisão das descrições de cargos",
        "Alinhamento de expectativas",
        "Divulgação de objetivos institucionais",
        "Programas de integração funcional",
      ],
    },
    "comunicacao-mudancas": {
      name: "Comunicação e Mudanças",
      short: "Comunic.",
      description: "Como as mudanças organizacionais são comunicadas e a participação dos trabalhadores nelas.",
      actions: [
        "Estratégias formais de gestão de mudanças",
        "Comunicação transparente e tempestiva",
        "Participação dos trabalhadores nos processos decisórios",
        "Monitoramento dos impactos das mudanças organizacionais",
      ],
    },
  },
};

const en: Dict = {
  htmlTitle: "IFPSE · Psychosocial Risks",
  title: "Psychosocial Risks",
  updated: "Updated:",
  noDataYet: "no data yet",
  refresh: "Refresh",
  refreshAria: "Refresh now",
  language: "Language",
  theme: "Theme",
  themeModes: { system: "Automatic", light: "Light", dark: "Dark" },
  sector: "Sector",
  allSectors: "All sectors",
  period: "Period",
  presets: { all: "All", d30: "30 days", d90: "90 days", year: "This year" },
  customPeriod: "Custom",
  rangeTo: "to",
  from: "From",
  to: "To",
  loadError: "Could not load the data. Retrying…",
  loading: "Loading…",
  emptyFilteredTitle: "No responses for this filter",
  emptyTitle: "Waiting for SASI responses",
  emptyFilteredText: "Adjust the sector or the period to see the results.",
  emptyText: "As soon as the SASI API sends the first response to the webhook, the charts appear here automatically.",
  respondents: "Respondents",
  formSchool: "school",
  formFull: "full (35)",
  overallIndex: "Overall risk index",
  highFactors: "Factors at High risk",
  ofSeven: "of 7",
  moderateLow: (moderate, low) => `${moderate} moderate · ${low} low`,
  riskLabel: { alto: "High", moderado: "Moderate", baixo: "Low" },
  noData: "No data",
  riskProfileTitle: "Risk profile",
  riskProfileSub: "Risk index per factor (1 to 5, higher = worse)",
  radarAria: "Radar chart of the risk index per factor",
  radarTooltip: "Risk index",
  topItemsTitle: "Most critical statements",
  topItemsSub: "Highest share of critical answers among the questionnaire statements",
  riskIndexWord: "risk index",
  criticalShare: (pct, count, total) => `${pct}% critical answers (${count} of ${total})`,
  timelineTitle: "Trend over time",
  timelineSub: "Risk index per factor",
  timelineAria: "Trend of the risk index per factor over time",
  timelineResponses: (n) => `${n} response(s) in the period`,
  timelineNote: (high, highLabel, granularity) =>
    `Risk index from 1 to 5 (higher is worse). Above the red dashed line (${high}) the factor is rated ${highLabel}.${
      granularity === "month" ? " Grouped by month." : " Grouped by day."
    }`,
  sectorHeatTitle: "Sectors × factors",
  sectorHeatSub: "Average and risk level of each factor by sector — most critical first",
  sectorWord: "Sector",
  respShort: (n) => `${n} resp.`,
  heatTooltip: (sector, factor, index, level) => `${sector} · ${factor}: risk index ${index}${level ? ` (${level})` : ""}`,
  respBySectorTitle: "Respondents by sector",
  respondentUnit: (n) => `${n} respondent(s)`,
  actionPlanTitle: "Action plan",
  actionPlanSub: "High factors require a specific plan; Moderate ones, an assessment of measures (CGC methodology)",
  planText: {
    alto: "A specific action plan is mandatory (eliminate, reduce or control the causes).",
    moderado: "Assess the measures below and keep monitoring periodically.",
    baixo: "Periodic monitoring.",
  },
  planNone: "No factor at Moderate or High risk — keep monitoring periodically.",
  planLine: (index, pct) => `Risk index ${index} · ${pct}% critical answers`,
  howToReadTitle: "How to read this dashboard",
  footer: "Aggregated, anonymous data · received through the SASI API webhook",
  methodology: {
    scaleTitle: "Answer scale",
    scaleBody: "Never = 1 · Rarely = 2 · Sometimes = 3 · Often = 4 · Always = 5. Covers the last six months.",
    classTitle: "Classification by factor",
    classBody: (
      <>
        Each answer becomes a <em>risk score</em> from 1 to 5 (higher = worse): for negative statements (e.g. &ldquo;I have
        impossible deadlines&rdquo;) the answer itself counts; for positive ones (e.g. &ldquo;colleagues cooperate&rdquo;) the scale
        is inverted. The average of the factor&rsquo;s scores is the <em>risk index</em>.
      </>
    ),
    thresholds: (high, moderate) => `High from ${high}, Moderate from ${moderate}, Low below that.`,
    criticalTitle: "Critical answers",
    criticalBody: (strong) => (
      <>
        These are the answers with a risk score of 4 or 5: &ldquo;Often/Always&rdquo; on negative statements and
        &ldquo;Never/Rarely&rdquo; on positive ones. The higher the share, the greater the exposure to psychosocial risk in that
        factor. Factors rated {strong("High")} require an action plan.
      </>
    ),
  },
  factors: {
    demandas: {
      name: "Demands",
      short: "Demands",
      description: "Workload, pressure for results, activity intensity, deadlines, pace and adequate breaks.",
      actions: [
        "Resizing of teams",
        "Review of work processes",
        "Adjustment of goals and deadlines",
        "Overtime control",
        "Introduction of scheduled breaks",
      ],
    },
    relacionamentos: {
      name: "Relationships",
      short: "Relations",
      description: "Interpersonal conflicts, inappropriate behavior, harassment, respect among colleagues and quality of relationships.",
      actions: [
        "Conflict mediation actions",
        "Nonviolent communication programs",
        "Leadership training",
        "Stronger support and reporting channels",
        "Monitoring of the organizational climate",
      ],
    },
    controle: {
      name: "Control",
      short: "Control",
      description: "Autonomy over how activities are carried out, participation in decisions and influence over the pace of work.",
      actions: [
        "Broader participation of workers",
        "Participatory management",
        "Review of decision-making processes",
        "Encouragement of operational autonomy",
      ],
    },
    "apoio-chefia": {
      name: "Management Support",
      short: "Manager",
      description: "Support from leaders, availability for guidance, feedback and problem solving.",
      actions: [
        "Training for leaders",
        "Management development programs",
        "Periodic follow-up meetings",
        "Stronger communication between managers and teams",
      ],
    },
    "apoio-colegas": {
      name: "Peer Support",
      short: "Peers",
      description: "Cooperation, solidarity, respect and support among team members.",
      actions: [
        "Team integration activities",
        "Collaborative work programs",
        "Team-strengthening activities",
        "Mutual support strategies among workers",
      ],
    },
    cargo: {
      name: "Role",
      short: "Role",
      description: "Clarity of responsibilities, understanding of duties, and organizational objectives and goals.",
      actions: [
        "Review of job descriptions",
        "Alignment of expectations",
        "Dissemination of institutional objectives",
        "Functional integration programs",
      ],
    },
    "comunicacao-mudancas": {
      name: "Communication and Change",
      short: "Comm.",
      description: "How organizational changes are communicated and how much workers take part in them.",
      actions: [
        "Formal change management strategies",
        "Transparent and timely communication",
        "Worker participation in decision-making",
        "Monitoring of the impact of organizational changes",
      ],
    },
  },
};

const DICTS: Record<Lang, Dict> = { pt, en };

/** Mesma ordem de ESCOLA15_TEXTS (as 15 afirmativas do canal); a chave é o texto em português. */
const ESCOLA15_EN = [
  "At school, is the amount of prevention and safety activities compatible with the time and people available to carry them out?",
  "Do the school's safety activities require handling a lot of information, tasks or situations at the same time, making it hard to carry out preventive actions properly?",
  "When an unexpected situation arises that may affect school safety, are there conditions to deal with the problem without harming other important prevention actions?",
  "Do conflicts or disagreements happen among people at the school that make communication, cooperation or solving safety-related problems harder?",
  "When there is a risk situation or a safety problem, can people talk to and treat each other with respect, even when they hold different opinions?",
  "Do people have the opportunity to take part in decisions and contribute suggestions when situations that could improve school safety are identified?",
  "When a person identifies a situation that could put someone at risk, can they report the problem and suggest a safer way of acting?",
  "When the School CIPA or another person reports a situation that may compromise safety, does management offer support so the problem is analyzed and addressed?",
  "When a safety need is identified, does the school seek to provide the guidance, conditions or resources needed to prevent or control the problem?",
  "When a person needs help carrying out a prevention action or dealing with a risk situation, do colleagues cooperate?",
  "When someone identifies information that is important for school safety, does that information reach the people who need to know it?",
  "At school, is it clear what each person or team must do when a risk is identified and who must be informed?",
  "In an emergency, is it clear when management, the School CIPA, the Fire Brigade or other responsible parties should be called, according to the school's guidelines?",
  "When a safety guideline, procedure or measure is created or changed, do people receive enough information to know what changed and how to act?",
  "When a person does not understand a safety guideline or an emergency procedure, is there room to ask and clear up the doubt before having to act?",
] as const;

const ITEM_EN = new Map<string, string>(ESCOLA15_TEXTS.map((text, index) => [text, ESCOLA15_EN[index]]));

interface I18n extends Formatters {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Dict;
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  /** Texto da afirmativa no idioma ativo (as do questionário completo ficam em português). */
  itemText: (text: string) => string;
}

const Ctx = createContext<I18n | null>(null);

function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return allowed.includes(value as T) ? (value as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // armazenamento bloqueado (janela privada): a escolha vale só nesta visita.
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("pt");
  const [theme, setThemeState] = useState<ThemeMode>("system");

  // Lido depois da hidratação para o HTML do servidor e o do cliente coincidirem.
  useEffect(() => {
    setLangState(readStored<Lang>(LANG_KEY, ["pt", "en"], "pt"));
    setThemeState(readStored<ThemeMode>(THEME_KEY, ["system", "light", "dark"], "system"));
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === "pt" ? "pt-BR" : "en";
    document.title = DICTS[lang].htmlTitle;
  }, [lang]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
  }, [theme]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    writeStored(LANG_KEY, next);
  }, []);

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
    writeStored(THEME_KEY, next);
  }, []);

  const value = useMemo<I18n>(
    () => ({
      lang,
      setLang,
      theme,
      setTheme,
      t: DICTS[lang],
      itemText: (text) => (lang === "en" ? ITEM_EN.get(text) ?? text : text),
      ...makeFormatters(lang),
    }),
    [lang, theme, setLang, setTheme]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n precisa estar dentro de <I18nProvider>");
  return ctx;
}
