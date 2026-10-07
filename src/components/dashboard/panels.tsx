import { CircleCheck } from "lucide-react";
import type { FactorStat, ItemStat, SectorStat } from "@/lib/hse/analytics";
import { FACTORS } from "@/lib/hse/questionnaire";
import { RISK_HIGH_FROM, RISK_MODERATE_FROM, RISK_RANK, type RiskLevel } from "@/lib/hse/risk";
import { LEVEL_VAR } from "./format";
import { useI18n } from "./i18n";
import { RiskBadge, RiskIcon } from "./ui";

/* ----------------------------------------------------- Mapa de calor setor × fator */

export function SectorHeatmap({ sectors }: { sectors: SectorStat[] }) {
  const { t, fmt, fmtInt } = useI18n();
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
      <table className="w-full min-w-[720px] border-separate border-spacing-1 text-sm">
        <thead>
          <tr className="text-left text-[12px] font-medium text-muted">
            <th className="sticky left-0 z-10 bg-surface py-1 pr-2 font-medium">{t.sectorWord}</th>
            {FACTORS.map((f) => (
              <th key={f.id} className="px-1 text-center font-medium">
                {t.factors[f.id].short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sectors.map((sector) => (
            <tr key={sector.setor}>
              <th className="sticky left-0 z-10 bg-surface py-1 pr-2 text-left font-medium text-ink">
                <span className="block max-w-[150px] truncate" title={sector.setor}>
                  {sector.setor}
                </span>
                <span className="text-[12px] font-normal text-muted">{t.respShort(fmtInt(sector.respondents))}</span>
              </th>
              {FACTORS.map((f) => {
                const cell = sector.factors[f.id];
                return (
                  <td key={f.id} className="p-0">
                    <div
                      className={`heat-cell ${cell.level ? `heat-${cell.level}` : "heat-none"}`}
                      title={t.heatTooltip(sector.setor, t.factors[f.id].name, fmt(cell.riskIndex, 2), cell.level ? t.riskLabel[cell.level] : "")}
                    >
                      <span className="flex items-center gap-1 text-[13px] font-semibold">
                        {cell.level && <RiskIcon level={cell.level} size={12} />}
                        {fmt(cell.riskIndex)}
                      </span>
                      <span className="text-[11px] text-ink-2">{cell.level ? t.riskLabel[cell.level] : "—"}</span>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------ Afirmativas mais críticas */

export function TopItems({ items }: { items: ItemStat[] }) {
  const { t, fmt, fmtInt, itemText } = useI18n();
  const top = [...items]
    .filter((i) => i.count > 0)
    .sort((a, b) => b.criticalPct - a.criticalPct || b.count - a.count)
    .slice(0, 8);

  return (
    <ol className="space-y-3">
      {top.map((item, index) => (
        <li key={item.text}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 text-[13px] leading-snug text-ink">
              <span className="mr-1.5 font-semibold text-muted">{index + 1}.</span>
              {itemText(item.text)}
            </p>
            <span className="shrink-0 text-sm font-semibold text-ink">{fmt(item.criticalPct)}%</span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full" style={{ width: `${item.criticalPct}%`, background: "var(--risk-high)" }} />
          </div>
          <p className="mt-1 text-[12px] text-muted">
            {t.factors[item.factorId].name} · {t.criticalShare(fmt(item.criticalPct), fmtInt(item.criticalCount), fmtInt(item.count))}
          </p>
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------ Plano de ação */

export function ActionPlan({ factors }: { factors: FactorStat[] }) {
  const { t, fmt } = useI18n();
  const needing = factors
    .filter((f) => f.level === "alto" || f.level === "moderado")
    .sort((a, b) => RISK_RANK[b.level!] - RISK_RANK[a.level!] || (b.riskIndex ?? 0) - (a.riskIndex ?? 0));

  if (!needing.length) {
    return (
      <p className="flex items-center gap-2 text-sm text-ink-2">
        <CircleCheck size={18} style={{ color: "var(--risk-low)" }} aria-hidden />
        {t.planNone}
      </p>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {needing.map((factor) => {
        const level = factor.level as RiskLevel;
        return (
          <article
            key={factor.id}
            className="rounded-xl bg-surface-2 p-4"
            style={{ borderLeft: `4px solid ${LEVEL_VAR[level]}` }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-ink">{t.factors[factor.id].name}</h3>
              <RiskBadge level={level} />
            </div>
            <p className="mt-1 text-[13px] text-ink-2">{t.planLine(fmt(factor.riskIndex, 2), fmt(factor.criticalPct))}</p>
            <p className="mt-2 text-[13px] font-medium text-ink">{t.planText[level]}</p>
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[13px] text-ink-2">
              {t.factors[factor.id].actions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          </article>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------- Metodologia */

export function Methodology() {
  const { t, fmt } = useI18n();
  const m = t.methodology;
  return (
    <div className="grid gap-4 text-[13px] text-ink-2 md:grid-cols-3">
      <div>
        <h3 className="mb-1 font-semibold text-ink">{m.scaleTitle}</h3>
        <p>{m.scaleBody}</p>
      </div>
      <div>
        <h3 className="mb-1 font-semibold text-ink">{m.classTitle}</h3>
        <p>{m.classBody}</p>
        <p className="mt-1">{m.thresholds(fmt(RISK_HIGH_FROM), fmt(RISK_MODERATE_FROM))}</p>
      </div>
      <div>
        <h3 className="mb-1 font-semibold text-ink">{m.criticalTitle}</h3>
        <p>{m.criticalBody((text) => <strong className="text-ink">{text}</strong>)}</p>
      </div>
    </div>
  );
}
