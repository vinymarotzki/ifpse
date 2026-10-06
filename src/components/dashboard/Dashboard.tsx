"use client";

import { Activity, Building2, Gauge, HeartPulse, Inbox, Percent, RefreshCw, TriangleAlert, Users, Webhook } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Analysis } from "@/lib/hse/analytics";
import { FactorBars, FactorRadar, ResponseMix, SimpleBars, Timeline } from "./charts";
import { fmt, fmtDate, fmtDateTime, fmtInt } from "./format";
import { ActionPlan, Methodology, SectorHeatmap, TopItems } from "./panels";
import { Card, RiskBadge } from "./ui";

interface DashboardPayload {
  analysis: Analysis;
  sectors: string[];
  updatedAt: string | null;
}

const REFRESH_MS = 30_000;

type Preset = "all" | "30" | "90" | "year";

const PRESETS: { id: Preset; label: string }[] = [
  { id: "all", label: "Tudo" },
  { id: "30", label: "30 dias" },
  { id: "90", label: "90 dias" },
  { id: "year", label: "Este ano" },
];

function isoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function presetRange(preset: Preset): { from: string; to: string } {
  if (preset === "all") return { from: "", to: "" };
  const today = new Date();
  if (preset === "year") return { from: `${today.getFullYear()}-01-01`, to: "" };
  const start = new Date(today);
  start.setDate(start.getDate() - Number(preset));
  return { from: isoDay(start), to: "" };
}

function Kpi({ icon, label, children, hint }: { icon: ReactNode; label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="card flex items-start gap-3 p-3 sm:p-4">
      <div className="hidden h-10 w-10 shrink-0 place-items-center rounded-xl text-ink-2 sm:grid" style={{ background: "var(--surface-2)" }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[13px] text-muted">{label}</p>
        <div className="mt-0.5 text-2xl font-semibold leading-tight text-ink">{children}</div>
        {hint && <div className="mt-1 text-[12px] text-muted">{hint}</div>}
      </div>
    </div>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl text-ink-2" style={{ background: "var(--surface-2)" }}>
        {filtered ? <Inbox size={26} aria-hidden /> : <Webhook size={26} aria-hidden />}
      </div>
      <h2 className="text-lg font-semibold text-ink">
        {filtered ? "Nenhuma resposta neste filtro" : "Aguardando as respostas da SASI"}
      </h2>
      <p className="max-w-md text-sm text-ink-2">
        {filtered
          ? "Ajuste o setor ou o período para ver os resultados."
          : "Assim que a API da SASI enviar a primeira resposta para o webhook, os gráficos aparecem aqui automaticamente."}
      </p>
      {!filtered && (
        <code className="rounded-lg px-3 py-1.5 text-[13px] text-ink-2" style={{ background: "var(--surface-2)" }}>
          POST /api/hse/webhook
        </code>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [setor, setSetor] = useState("");
  const [preset, setPreset] = useState<Preset | "custom">("all");
  const [range, setRange] = useState({ from: "", to: "" });
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    const params = new URLSearchParams();
    if (setor) params.set("setor", setor);
    if (range.from) params.set("from", range.from);
    if (range.to) params.set("to", range.to);

    setLoading(true);
    try {
      const response = await fetch(`/api/hse/dashboard?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = (await response.json()) as DashboardPayload;
      if (id !== requestId.current) return; // chegou depois de um filtro mais novo
      setData(payload);
      setError(null);
    } catch {
      if (id === requestId.current) setError("Não foi possível carregar os dados. Tentando novamente…");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [setor, range]);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    const onFocus = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [load]);

  const analysis = data?.analysis;
  const hasData = !!analysis && analysis.totals.respondents > 0;
  const filtered = !!setor || !!range.from || !!range.to;

  const sectorBars = useMemo(
    () => (analysis?.sectors ?? []).slice(0, 8).map((s) => ({ name: s.setor, value: s.respondents })),
    [analysis]
  );
  const ageBars = useMemo(() => (analysis?.ages ?? []).map((a) => ({ name: a.range, value: a.count })), [analysis]);
  // O formulário escolar não pergunta a idade: sem nenhuma idade conhecida, o card some.
  const hasAges = ageBars.some((bar) => bar.name !== "Não informada" && bar.value > 0);

  function applyPreset(next: Preset) {
    setPreset(next);
    setRange(presetRange(next));
  }

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 pb-16 pt-5 sm:px-6 lg:px-8">
      {/* Cabeçalho */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl text-white" style={{ background: "var(--brand)" }}>
            <HeartPulse size={22} aria-hidden />
          </div>
          <div>
            <h1 className="text-xl font-semibold leading-tight text-ink sm:text-2xl">Riscos Psicossociais</h1>
            <p className="text-[13px] text-muted">IFPSE · baseado no Management Standards Indicator Tool · CGC</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[13px] text-muted">
          <span className="hidden sm:inline">Atualizado: {fmtDateTime(data?.updatedAt ?? null)}</span>
          <button type="button" className="chip" onClick={load} disabled={loading} aria-label="Atualizar agora">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} aria-hidden />
            Atualizar
          </button>
        </div>
      </header>

      {/* Filtros */}
      <div className="card mt-5 flex flex-wrap items-end gap-x-4 gap-y-3 p-4">
        <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-[12px] font-medium text-muted sm:max-w-[260px]">
          Setor
          <select className="field" value={setor} onChange={(e) => setSetor(e.target.value)}>
            <option value="">Todos os setores</option>
            {data?.sectors.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-1 text-[12px] font-medium text-muted">
          Período
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button key={p.id} type="button" className="chip" aria-pressed={preset === p.id} onClick={() => applyPreset(p.id)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-end gap-2 text-[12px] font-medium text-muted">
          <label className="flex flex-col gap-1">
            De
            <input
              type="date"
              className="field"
              value={range.from}
              onChange={(e) => {
                setPreset("custom");
                setRange((r) => ({ ...r, from: e.target.value }));
              }}
            />
          </label>
          <label className="flex flex-col gap-1">
            Até
            <input
              type="date"
              className="field"
              value={range.to}
              onChange={(e) => {
                setPreset("custom");
                setRange((r) => ({ ...r, to: e.target.value }));
              }}
            />
          </label>
        </div>
      </div>

      {error && (
        <p className="mt-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm text-ink" style={{ background: "color-mix(in srgb, var(--risk-high) 14%, transparent)" }} role="alert">
          <TriangleAlert size={16} aria-hidden /> {error}
        </p>
      )}

      {!data && loading && <p className="mt-10 text-center text-sm text-muted">Carregando…</p>}

      {data && !hasData && (
        <div className="mt-5">
          <EmptyState filtered={filtered} />
        </div>
      )}

      {analysis && hasData && (
        <main className="mt-5 space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <Kpi
              icon={<Users size={20} aria-hidden />}
              label="Respondentes"
              hint={
                analysis.totals.forms.length > 1
                  ? analysis.totals.forms.map((f) => `${fmtInt(f.respondents)} ${f.id === "escola15" ? "escolar" : "completo (35)"}`).join(" · ")
                  : `${fmtDate(analysis.totals.firstDate)} a ${fmtDate(analysis.totals.lastDate)}`
              }
            >
              {fmtInt(analysis.totals.respondents)}
            </Kpi>
            <Kpi
              icon={<Building2 size={20} aria-hidden />}
              label="Setores"
              hint={setor ? `Filtrado: ${setor}` : "Com ao menos uma resposta"}
            >
              {fmtInt(analysis.totals.sectors)}
            </Kpi>
            <Kpi
              icon={<Gauge size={20} aria-hidden />}
              label="Índice geral de risco"
              hint={<RiskBadge level={analysis.totals.overallLevel} />}
            >
              {fmt(analysis.totals.overallRiskIndex, 2)} <span className="text-sm font-normal text-muted">/ 5</span>
            </Kpi>
            <Kpi
              icon={<Activity size={20} aria-hidden />}
              label="Fatores em risco Alto"
              hint={`${analysis.totals.moderateFactors} moderado(s) · ${analysis.totals.lowFactors} baixo(s)`}
            >
              {analysis.totals.highFactors} <span className="text-sm font-normal text-muted">de 7</span>
            </Kpi>
          </div>

          {/* Panorama */}
          <div className="grid gap-5 lg:grid-cols-5">
            <Card className="lg:col-span-2" title="Perfil de risco" subtitle="Índice de risco por fator (1 a 5, maior = pior)">
              <FactorRadar factors={analysis.factors} />
            </Card>
            <Card className="lg:col-span-3" title="Fatores por nível de risco" subtitle="Ordenados do mais para o menos crítico">
              <FactorBars factors={analysis.factors} />
            </Card>
          </div>

          {/* Cartões de fator */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {analysis.factors.map((factor) => (
              <article key={factor.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-ink">{factor.name}</h3>
                  <RiskBadge level={factor.level} />
                </div>
                <p className="mt-2 text-3xl font-semibold text-ink">
                  {fmt(factor.riskIndex, 2)}
                  <span className="ml-1 text-sm font-normal text-muted">índice de risco</span>
                </p>
                <p className="mt-1 text-[13px] text-ink-2">
                  {fmt(factor.criticalPct)}% de respostas críticas ({fmtInt(factor.criticalCount)} de {fmtInt(factor.answerCount)})
                </p>
                <p className="mt-2 text-[12px] leading-snug text-muted">{factor.description}</p>
              </article>
            ))}
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Respostas favoráveis × críticas" subtitle="Proporção de respostas por fator (críticas = nota de risco 4–5, considerando o sentido de cada afirmativa)">
              <ResponseMix factors={analysis.factors} />
            </Card>
            <Card title="Evolução no tempo" subtitle="Índice de risco por fator">
              <Timeline timeline={analysis.timeline} factors={analysis.factors} />
            </Card>
          </div>

          <Card title="Setores × fatores" subtitle="Média e nível de risco de cada fator por setor — mais críticos primeiro">
            <SectorHeatmap sectors={analysis.sectors} />
          </Card>

          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2" title="Afirmativas mais críticas" subtitle="Maior proporção de respostas críticas entre as afirmativas do questionário">
              <TopItems items={analysis.items} />
            </Card>
            <div className="grid gap-5">
              <Card title="Respondentes por setor">
                <SimpleBars data={sectorBars} label="Respondentes por setor" />
              </Card>
              {hasAges && (
                <Card title="Faixa etária">
                  <SimpleBars data={ageBars} color="var(--s3)" label="Respondentes por faixa etária" />
                </Card>
              )}
            </div>
          </div>

          <Card title="Plano de ação" subtitle="Fatores Altos exigem plano específico; Moderados, avaliação de medidas (metodologia CGC)">
            <ActionPlan factors={analysis.factors} />
          </Card>

          <Card title="Como ler esta dashboard">
            <Methodology />
          </Card>
        </main>
      )}

      <footer className="mt-8 flex items-center justify-center gap-1.5 text-[12px] text-muted">
        <Percent size={12} aria-hidden /> Dados agregados e anônimos · recebidos pelo webhook da API SASI
      </footer>
    </div>
  );
}
