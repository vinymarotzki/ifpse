"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
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
import { RISK_HIGH_FROM } from "@/lib/hse/risk";
import { useI18n } from "./i18n";
import { Swatch, TooltipBox } from "./ui";

/** Cores categóricas em ordem fixa — a mesma por fator em qualquer gráfico. */
const SERIES = ["var(--s1)", "var(--s2)", "var(--s3)", "var(--s4)", "var(--s5)", "var(--s6)", "var(--s7)"];
const FACTOR_COLOR = Object.fromEntries(FACTORS.map((f, i) => [f.id, SERIES[i]]));

/* ------------------------------------------------------------------ Radar */

export function FactorRadar({ factors }: { factors: FactorStat[] }) {
  const { t, fmt } = useI18n();
  const data = factors.map((f) => ({ factor: t.factors[f.id].short, full: t.factors[f.id].name, risk: f.riskIndex ?? 0, level: f.level }));

  return (
    <div className="h-[300px] w-full sm:h-[340px]" role="img" aria-label={t.radarAria}>
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
                  <p>{t.radarTooltip}: {fmt(row.risk, 2)} / 5</p>
                </TooltipBox>
              );
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------------------------------------- Linha do tempo */

export function Timeline({ timeline, factors }: { timeline: Analysis["timeline"]; factors: FactorStat[] }) {
  const { t, fmt, fmtInt, fmtPeriod } = useI18n();
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
            {t.factors[factor.id].name}
          </button>
        ))}
      </div>
      <div className="h-[280px] w-full" role="img" aria-label={t.timelineAria}>
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
                    <p>{t.timelineResponses(fmtInt(respondents))}</p>
                    {payload.map((p) => (
                      <p key={String(p.dataKey)}>
                        <Swatch color={String(p.color)} />
                        {t.factors[p.dataKey as keyof typeof t.factors]?.name}: {fmt(Number(p.value), 2)}
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
      <p className="card-sub mt-2">{t.timelineNote(fmt(RISK_HIGH_FROM), t.riskLabel.alto, timeline.granularity)}</p>
    </div>
  );
}

/* ---------------------------------------------------------- Perfil (barras simples) */

export function SimpleBars({ data, color = "var(--s1)", label }: { data: { name: string; value: number }[]; color?: string; label: string }) {
  const { t, fmtInt } = useI18n();
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
                  <p>{t.respondentUnit(fmtInt(row.value))}</p>
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
