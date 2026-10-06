import { CircleCheck } from "lucide-react";
import type { FactorStat, ItemStat, SectorStat } from "@/lib/hse/analytics";
import { FACTORS } from "@/lib/hse/questionnaire";
import { RISK_HIGH_FROM, RISK_LABEL, RISK_MODERATE_FROM, RISK_RANK, type RiskLevel } from "@/lib/hse/risk";
import { LEVEL_VAR, fmt, fmtInt } from "./format";
import { RiskBadge, RiskIcon } from "./ui";

/* ----------------------------------------------------- Mapa de calor setor × fator */

export function SectorHeatmap({ sectors }: { sectors: SectorStat[] }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
      <table className="w-full min-w-[720px] border-separate border-spacing-1 text-sm">
        <thead>
          <tr className="text-left text-[12px] font-medium text-muted">
            <th className="sticky left-0 z-10 bg-surface py-1 pr-2 font-medium">Setor</th>
            {FACTORS.map((f) => (
              <th key={f.id} className="px-1 text-center font-medium">
                {f.short}
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
                <span className="text-[12px] font-normal text-muted">{fmtInt(sector.respondents)} resp.</span>
              </th>
              {FACTORS.map((f) => {
                const cell = sector.factors[f.id];
                return (
                  <td key={f.id} className="p-0">
                    <div
                      className={`heat-cell ${cell.level ? `heat-${cell.level}` : "heat-none"}`}
                      title={`${sector.setor} · ${f.name}: índice de risco ${fmt(cell.riskIndex, 2)}${cell.level ? ` (${RISK_LABEL[cell.level]})` : ""}`}
                    >
                      <span className="flex items-center gap-1 text-[13px] font-semibold">
                        {cell.level && <RiskIcon level={cell.level} size={12} />}
                        {fmt(cell.riskIndex)}
                      </span>
                      <span className="text-[11px] text-ink-2">{cell.level ? RISK_LABEL[cell.level] : "—"}</span>
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
              {item.text}
            </p>
            <span className="shrink-0 text-sm font-semibold text-ink">{fmt(item.criticalPct)}%</span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full" style={{ width: `${item.criticalPct}%`, background: "var(--risk-high)" }} />
          </div>
          <p className="mt-1 text-[12px] text-muted">
            {item.factorName} · {fmtInt(item.criticalCount)} de {fmtInt(item.count)} respostas críticas
          </p>
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------ Plano de ação */

const PLAN_TEXT: Record<RiskLevel, string> = {
  alto: "Plano de ação específico obrigatório (eliminar, reduzir ou controlar as causas).",
  moderado: "Avaliar as medidas abaixo e manter monitoramento periódico.",
  baixo: "Monitoramento periódico.",
};

export function ActionPlan({ factors }: { factors: FactorStat[] }) {
  const needing = factors
    .filter((f) => f.level === "alto" || f.level === "moderado")
    .sort((a, b) => RISK_RANK[b.level!] - RISK_RANK[a.level!] || (b.riskIndex ?? 0) - (a.riskIndex ?? 0));

  if (!needing.length) {
    return (
      <p className="flex items-center gap-2 text-sm text-ink-2">
        <CircleCheck size={18} style={{ color: "var(--risk-low)" }} aria-hidden />
        Nenhum fator em risco Moderado ou Alto — manter o monitoramento periódico.
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
              <h3 className="font-semibold text-ink">{factor.name}</h3>
              <RiskBadge level={level} />
            </div>
            <p className="mt-1 text-[13px] text-ink-2">
              Índice de risco {fmt(factor.riskIndex, 2)} · {fmt(factor.criticalPct)}% de respostas críticas
            </p>
            <p className="mt-2 text-[13px] font-medium text-ink">{PLAN_TEXT[level]}</p>
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[13px] text-ink-2">
              {factor.actions.map((action) => (
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
  return (
    <div className="grid gap-4 text-[13px] text-ink-2 md:grid-cols-3">
      <div>
        <h3 className="mb-1 font-semibold text-ink">Escala de resposta</h3>
        <p>Nunca = 1 · Raramente = 2 · Às vezes = 3 · Frequentemente = 4 · Sempre = 5. Considera os últimos seis meses.</p>
      </div>
      <div>
        <h3 className="mb-1 font-semibold text-ink">Classificação por fator</h3>
        <p>
          Cada resposta vira uma <em>nota de risco</em> de 1 a 5 (maior = pior): em afirmativas negativas (ex.: &ldquo;tenho prazos
          impossíveis&rdquo;) vale a própria resposta; nas positivas (ex.: &ldquo;os colegas colaboram&rdquo;) a escala é invertida.
          A média das notas do fator é o <em>índice de risco</em>.
        </p>
        <p className="mt-1">
          Alto a partir de {fmt(RISK_HIGH_FROM)}, Moderado a partir de {fmt(RISK_MODERATE_FROM)}, Baixo abaixo disso.
        </p>
      </div>
      <div>
        <h3 className="mb-1 font-semibold text-ink">Respostas críticas</h3>
        <p>
          São as respostas com nota de risco 4 ou 5: &ldquo;Frequentemente/Sempre&rdquo; em afirmativas negativas e
          &ldquo;Nunca/Raramente&rdquo; nas positivas. Quanto maior a proporção, maior a exposição ao risco psicossocial daquele
          fator. Fatores em <strong className="text-ink">Alto</strong> exigem plano de ação.
        </p>
      </div>
    </div>
  );
}
