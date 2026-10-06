"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Analysis, FactorStat } from "@/lib/hse/analytics";
import { FACTORS } from "@/lib/hse/questionnaire";
import { RISK_HIGH_FROM, RISK_LABEL, RISK_MODERATE_FROM } from "@/lib/hse/risk";
import { LEVEL_VAR, fmt, fmtInt, fmtPeriod } from "./format";
import { RiskBadge, Swatch, TooltipBox } from "./ui";

/** Cores categóricas em ordem fixa — a mesma por fator em qualquer gráfico. */
const SERIES = ["var(--s1)", "var(--s2)", "var(--s3)", "var(--s4)", "var(--s5)", "var(--s6)", "var(--s7)"];
const FACTOR_COLOR = Object.fromEntries(FACTORS.map((f, i) => [f.id, SERIES[i]]));

/* ------------------------------------------------------------------ Radar */

export function FactorRadar({ factors }: { factors: FactorStat[] }) {
  const data = factors.map((f) => ({ factor: f.short, full: f.name, risk: f.riskIndex ?? 0, level: f.level }));

  return (
    <div className="h-[300px] w-full sm:h-[340px]" role="img" aria-label="Radar do índice de risco por fator">
      <ResponsiveContainer>
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="var(--line)" />
          <PolarAngleAxis dataKey="factor" />
          <PolarRadiusAxis domain={[1, 5]} tickCount={5} axisLine={false} tick={{ fontSize: 10 }} />
          <Radar
            dataKey="risk"
            stroke="var(--risk-high)"
            strokeWidth={2}
            fill="var(--risk-high)"
            fillOpacity={0.18}
            dot={{ r: 3, fill: "var(--risk-high)", stroke: "var(--surface)", strokeWidth: 2 }}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload as (typeof data)[number];
              return (
                <TooltipBox title={row.full}>
                  <p>Índice de risco: {fmt(row.risk, 2)} / 5</p>
                </TooltipBox>
              );
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------------------------------------------------- Índice por fator (barras) */

export function FactorBars({ factors }: { factors: FactorStat[] }) {
  const data = [...factors]
    .filter((f) => f.riskIndex !== null)
    .sort((a, b) => (b.riskIndex ?? 0) - (a.riskIndex ?? 0))
    .map((f) => ({ ...f, risk: f.riskIndex as number }));

  return (
    <div>
      <div className="h-[300px] w-full sm:h-[340px]" role="img" aria-label="Índice de risco por fator, do maior para o menor">
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 36, bottom: 0, left: 0 }} barCategoryGap={10}>
            <CartesianGrid horizontal={false} stroke="var(--line)" />
            <XAxis type="number" domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={118} axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
            <ReferenceLine x={RISK_MODERATE_FROM} stroke="var(--axis)" strokeDasharray="4 4" />
            <ReferenceLine x={RISK_HIGH_FROM} stroke="var(--risk-high)" strokeDasharray="4 4" />
            <Tooltip
              cursor={{ fill: "var(--surface-2)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const f = payload[0].payload as (typeof data)[number];
                return (
                  <TooltipBox title={f.name}>
                    <p>Média das respostas: {fmt(f.average, 2)}</p>
                    <p>Índice de risco: {fmt(f.riskIndex, 2)}</p>
                    <p>Respostas críticas: {fmt(f.criticalPct)}%</p>
                    <div className="pt-1">
                      <RiskBadge level={f.level} />
                    </div>
                  </TooltipBox>
                );
              }}
            />
            <Bar dataKey="risk" radius={[0, 4, 4, 0]} maxBarSize={22} label={{ position: "right", fontSize: 12, fill: "var(--ink-2)", formatter: (v: unknown) => fmt(Number(v), 1) }}>
              {data.map((f) => (
                <Cell key={f.id} fill={LEVEL_VAR[f.level ?? "baixo"]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="card-sub mt-2">
        Linha tracejada vermelha: a partir de {fmt(RISK_HIGH_FROM)} o fator é <strong className="text-ink">Alto</strong>; cinza:
        a partir de {fmt(RISK_MODERATE_FROM)} é <strong className="text-ink">Moderado</strong>.
      </p>
    </div>
  );
}

/* ------------------------------------------- Respostas favoráveis × críticas */

export function ResponseMix({ factors }: { factors: FactorStat[] }) {
  const data = factors
    .filter((f) => f.answerCount > 0)
    .map((f) => {
      const d = f.distribution;
      const critical = f.polarity === "negative" ? d[3] + d[4] : d[0] + d[1];
      const favorable = f.polarity === "negative" ? d[0] + d[1] : d[3] + d[4];
      const pct = (n: number) => (n / f.answerCount) * 100;
      return {
        name: f.name,
        favoravel: pct(favorable),
        neutra: pct(d[2]),
        critica: pct(critical),
        counts: { favorable, neutral: d[2], critical },
        total: f.answerCount,
      };
    });

  const parts = [
    { key: "favoravel", label: "Favoráveis", color: "var(--risk-low)" },
    { key: "neutra", label: "Às vezes", color: "var(--neutral-bar)" },
    { key: "critica", label: "Críticas", color: "var(--risk-high)" },
  ] as const;

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2">
        {parts.map((p) => (
          <span key={p.key}>
            <Swatch color={p.color} />
            {p.label}
          </span>
        ))}
      </div>
      <div className="h-[300px] w-full" role="img" aria-label="Proporção de respostas favoráveis, neutras e críticas por fator">
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" stackOffset="expand" margin={{ top: 0, right: 8, bottom: 0, left: 0 }} barCategoryGap={10}>
            <XAxis type="number" tickFormatter={(v: number) => `${Math.round(v * 100)}%`} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={118} axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
            <Tooltip
              cursor={{ fill: "var(--surface-2)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as (typeof data)[number];
                return (
                  <TooltipBox title={row.name}>
                    <p><Swatch color="var(--risk-low)" />Favoráveis: {fmtInt(row.counts.favorable)} ({fmt(row.favoravel)}%)</p>
                    <p><Swatch color="var(--neutral-bar)" />Às vezes: {fmtInt(row.counts.neutral)} ({fmt(row.neutra)}%)</p>
                    <p><Swatch color="var(--risk-high)" />Críticas: {fmtInt(row.counts.critical)} ({fmt(row.critica)}%)</p>
                  </TooltipBox>
                );
              }}
            />
            {parts.map((p, index) => (
              <Bar
                key={p.key}
                dataKey={p.key}
                stackId="mix"
                fill={p.color}
                maxBarSize={22}
                stroke="var(--surface)"
                strokeWidth={2}
                radius={index === parts.length - 1 ? [0, 4, 4, 0] : 0}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- Linha do tempo */

export function Timeline({ timeline, factors }: { timeline: Analysis["timeline"]; factors: FactorStat[] }) {
  // Padrão: os três fatores de maior risco — 7 linhas ao mesmo tempo viram ruído.
  const initial = useMemo(
    () =>
      new Set(
        [...factors]
          .filter((f) => f.riskIndex !== null)
          .sort((a, b) => (b.riskIndex ?? 0) - (a.riskIndex ?? 0))
          .slice(0, 3)
          .map((f) => f.id)
      ),
    [factors]
  );
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const active = selected ?? initial;

  const data = timeline.points.map((point) => ({
    label: fmtPeriod(point.period),
    respondents: point.respondents,
    ...point.risk,
  }));

  const toggle = (id: string) => {
    const next = new Set(active);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {FACTORS.map((factor) => (
          <button key={factor.id} type="button" className="chip" aria-pressed={active.has(factor.id)} onClick={() => toggle(factor.id)}>
            <Swatch color={FACTOR_COLOR[factor.id]} />
            {factor.name}
          </button>
        ))}
      </div>
      <div className="h-[280px] w-full" role="img" aria-label="Evolução do índice de risco por fator ao longo do tempo">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="label" axisLine={{ stroke: "var(--axis)" }} tickLine={false} />
            <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} axisLine={false} tickLine={false} />
            <ReferenceLine y={RISK_HIGH_FROM} stroke="var(--risk-high)" strokeDasharray="4 4" />
            <Tooltip
              cursor={{ stroke: "var(--axis)" }}
              content={({ active: on, payload, label }) => {
                if (!on || !payload?.length) return null;
                const respondents = (payload[0].payload as { respondents: number }).respondents;
                return (
                  <TooltipBox title={String(label)}>
                    <p>{fmtInt(respondents)} resposta(s) no período</p>
                    {payload.map((p) => (
                      <p key={String(p.dataKey)}>
                        <Swatch color={String(p.color)} />
                        {FACTORS.find((f) => f.id === p.dataKey)?.name}: {fmt(Number(p.value), 2)}
                      </p>
                    ))}
                  </TooltipBox>
                );
              }}
            />
            {FACTORS.filter((f) => active.has(f.id)).map((factor) => (
              <Line
                key={factor.id}
                type="monotone"
                dataKey={factor.id}
                stroke={FACTOR_COLOR[factor.id]}
                strokeWidth={2}
                dot={{ r: 4, fill: FACTOR_COLOR[factor.id], stroke: "var(--surface)", strokeWidth: 2 }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="card-sub mt-2">
        Índice de risco de 1 a 5 (quanto maior, pior). Acima da linha tracejada vermelha ({fmt(RISK_HIGH_FROM)}) o fator é {RISK_LABEL.alto}.
        {timeline.granularity === "month" ? " Agrupado por mês." : " Agrupado por dia."}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------- Perfil (barras simples) */

export function SimpleBars({ data, color = "var(--s1)", label }: { data: { name: string; value: number }[]; color?: string; label: string }) {
  const height = Math.max(160, data.length * 38 + 24);
  return (
    <div style={{ height }} className="w-full" role="img" aria-label={label}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 32, bottom: 0, left: 0 }} barCategoryGap={8}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" width={104} axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload as (typeof data)[number];
              return (
                <TooltipBox title={row.name}>
                  <p>{fmtInt(row.value)} respondente(s)</p>
                </TooltipBox>
              );
            }}
          />
          <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} maxBarSize={20} label={{ position: "right", fontSize: 12, fill: "var(--ink-2)" }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
