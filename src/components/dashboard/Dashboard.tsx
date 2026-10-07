"use client";

import { Activity, Gauge, HeartPulse, Inbox, Info, Monitor, Moon, Percent, RefreshCw, Sun, TriangleAlert, Users, Webhook, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Analysis } from "@/lib/hse/analytics";
import { FactorRadar, SimpleBars, Timeline } from "./charts";
import { useI18n, type ThemeMode } from "./i18n";
import { ActionPlan, Methodology, SectorHeatmap, TopItems } from "./panels";
import { Card, RiskBadge } from "./ui";

interface DashboardPayload {
  analysis: Analysis;
  sectors: string[];
  updatedAt: string | null;
}

const REFRESH_MS = 30_000;

type Preset = "all" | "30" | "90" | "year";

const PRESETS: { id: Preset; key: "all" | "d30" | "d90" | "year" }[] = [
  { id: "all", key: "all" },
  { id: "30", key: "d30" },
  { id: "90", key: "d90" },
  { id: "year", key: "year" },
];

const THEME_OPTIONS: { mode: ThemeMode; Icon: LucideIcon }[] = [
  { mode: "system", Icon: Monitor },
  { mode: "light", Icon: Sun },
  { mode: "dark", Icon: Moon },
];

/** Idioma (PT/EN) e tema (automático/claro/escuro); a escolha fica salva no navegador. */
function Preferences() {
  const { t, lang, setLang, theme, setTheme } = useI18n();
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1" role="group" aria-label={t.language}>
        {(["pt", "en"] as const).map((code) => (
          <button key={code} type="button" className="chip" aria-pressed={lang === code} onClick={() => setLang(code)}>
            {code.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="flex gap-1" role="group" aria-label={t.theme}>
        {THEME_OPTIONS.map(({ mode, Icon }) => (
          <button
            key={mode}
            type="button"
            className="chip px-2.5"
            aria-pressed={theme === mode}
            aria-label={t.themeModes[mode]}
            title={t.themeModes[mode]}
            onClick={() => setTheme(mode)}
          >
            <Icon size={14} aria-hidden />
          </button>
        ))}
      </div>
    </div>
  );
}

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
  const { t } = useI18n();
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl text-ink-2" style={{ background: "var(--surface-2)" }}>
        {filtered ? <Inbox size={26} aria-hidden /> : <Webhook size={26} aria-hidden />}
      </div>
      <h2 className="text-lg font-semibold text-ink">
        {filtered ? t.emptyFilteredTitle : t.emptyTitle}
      </h2>
      <p className="max-w-md text-sm text-ink-2">{filtered ? t.emptyFilteredText : t.emptyText}</p>
      {!filtered && (
        <code className="rounded-lg px-3 py-1.5 text-[13px] text-ink-2" style={{ background: "var(--surface-2)" }}>
          POST /api/hse/webhook
        </code>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { t, fmt, fmtInt, fmtDate, fmtDateTime } = useI18n();
  const [setor, setSetor] = useState("");
  const [preset, setPreset] = useState<Preset | "custom">("all");
  const [range, setRange] = useState({ from: "", to: "" });
  // Os campos De/Até só aparecem quando alguém pede "Personalizado".
  const [showCustom, setShowCustom] = useState(false);
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState(false);
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
      setError(false);
    } catch {
      if (id === requestId.current) setError(true);
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
  // Com um único setor (hoje só o time de teste) o comparativo entre setores não diz nada.
  const multiSector = (analysis?.totals.sectors ?? 0) > 1;
  // Linha do tempo com 1–2 pontos é um gráfico quase vazio.
  const hasTimeline = (analysis?.timeline.points.length ?? 0) >= 3;

  function applyPreset(next: Preset) {
    setShowCustom(false);
    setPreset(next);
    setRange(presetRange(next));
  }

  function toggleCustom() {
    if (showCustom) {
      applyPreset("all");
      return;
    }
    setShowCustom(true);
    setPreset("custom");
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
            <h1 className="text-xl font-semibold leading-tight text-ink sm:text-2xl">{t.title}</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[13px] text-muted">
          <span className="hidden sm:inline">
            {t.updated} {fmtDateTime(data?.updatedAt ?? null, t.noDataYet)}
          </span>
          <button type="button" className="chip" onClick={load} disabled={loading} aria-label={t.refreshAria}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} aria-hidden />
            {t.refresh}
          </button>
          <Preferences />
        </div>
      </header>

      {/* Filtros */}
      <div className="card mt-5 flex flex-wrap items-end gap-x-4 gap-y-3 p-4">
        <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-[12px] font-medium text-muted sm:max-w-[260px]">
          {t.sector}
          <select className="field" value={setor} onChange={(e) => setSetor(e.target.value)}>
            <option value="">{t.allSectors}</option>
            {data?.sectors.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-1 text-[12px] font-medium text-muted">
          {t.period}
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button key={p.id} type="button" className="chip" aria-pressed={preset === p.id} onClick={() => applyPreset(p.id)}>
                {t.presets[p.key]}
              </button>
            ))}
            <button type="button" className="chip" aria-pressed={showCustom} onClick={toggleCustom}>
              {t.customPeriod}
            </button>
          </div>
        </div>
        {showCustom && (
        <div className="flex items-end gap-2 text-[12px] font-medium text-muted">
          <label className="flex flex-col gap-1">
            {t.from}
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
            {t.to}
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
        )}
      </div>

      {error && (
        <p className="mt-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm text-ink" style={{ background: "color-mix(in srgb, var(--risk-high) 14%, transparent)" }} role="alert">
          <TriangleAlert size={16} aria-hidden /> {t.loadError}
        </p>
      )}

      {!data && loading && <p className="mt-10 text-center text-sm text-muted">{t.loading}</p>}

      {data && !hasData && (
        <div className="mt-5">
          <EmptyState filtered={filtered} />
        </div>
      )}

      {analysis && hasData && (
        <main className="mt-5 space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            <Kpi
              icon={<Users size={20} aria-hidden />}
              label={t.respondents}
              hint={
                analysis.totals.forms.length > 1
                  ? analysis.totals.forms.map((f) => `${fmtInt(f.respondents)} ${f.id === "escola15" ? t.formSchool : t.formFull}`).join(" · ")
                  : `${fmtDate(analysis.totals.firstDate)} ${t.rangeTo} ${fmtDate(analysis.totals.lastDate)}`
              }
            >
              {fmtInt(analysis.totals.respondents)}
            </Kpi>
            <Kpi
              icon={<Gauge size={20} aria-hidden />}
              label={t.overallIndex}
              hint={<RiskBadge level={analysis.totals.overallLevel} />}
            >
              {fmt(analysis.totals.overallRiskIndex, 2)} <span className="text-sm font-normal text-muted">/ 5</span>
            </Kpi>
            <Kpi
              icon={<Activity size={20} aria-hidden />}
              label={t.highFactors}
              hint={t.moderateLow(analysis.totals.moderateFactors, analysis.totals.lowFactors)}
            >
              {analysis.totals.highFactors} <span className="text-sm font-normal text-muted">{t.ofSeven}</span>
            </Kpi>
          </div>

          {/* Panorama */}
          <div className="grid gap-5 lg:grid-cols-5">
            <Card className="lg:col-span-2" title={t.riskProfileTitle} subtitle={t.riskProfileSub}>
              <FactorRadar factors={analysis.factors} />
            </Card>
            <Card className="lg:col-span-3" title={t.topItemsTitle} subtitle={t.topItemsSub}>
              <TopItems items={analysis.items} />
            </Card>
          </div>

          {/* Cartões de fator */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {analysis.factors.map((factor) => (
              <article key={factor.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-1">
                    <h3 className="font-semibold text-ink">{t.factors[factor.id].name}</h3>
                    <span title={t.factors[factor.id].description} className="mt-1 cursor-help text-muted">
                      <Info size={13} aria-label={t.factors[factor.id].description} role="img" />
                    </span>
                  </div>
                  <RiskBadge level={factor.level} />
                </div>
                <p className="mt-2 text-3xl font-semibold text-ink">
                  {fmt(factor.riskIndex, 2)}
                  <span className="ml-1 text-sm font-normal text-muted">{t.riskIndexWord}</span>
                </p>
                <p className="mt-1 text-[13px] text-ink-2">
                  {t.criticalShare(fmt(factor.criticalPct), fmtInt(factor.criticalCount), fmtInt(factor.answerCount))}
                </p>
              </article>
            ))}
          </div>

          {hasTimeline && (
            <Card title={t.timelineTitle} subtitle={t.timelineSub}>
              <Timeline timeline={analysis.timeline} factors={analysis.factors} />
            </Card>
          )}

          {multiSector && (
            <>
              <Card title={t.sectorHeatTitle} subtitle={t.sectorHeatSub}>
                <SectorHeatmap sectors={analysis.sectors} />
              </Card>
              <Card title={t.respBySectorTitle}>
                <SimpleBars data={sectorBars} label={t.respBySectorTitle} />
              </Card>
            </>
          )}

          <Card title={t.actionPlanTitle} subtitle={t.actionPlanSub}>
            <ActionPlan factors={analysis.factors} />
          </Card>

          <details className="card group p-4 sm:p-5">
            <summary className="card-title cursor-pointer select-none">{t.howToReadTitle}</summary>
            <div className="mt-4">
              <Methodology />
            </div>
          </details>
        </main>
      )}

      <footer className="mt-8 flex items-center justify-center gap-1.5 text-[12px] text-muted">
        <Percent size={12} aria-hidden /> {t.footer}
      </footer>
    </div>
  );
}
