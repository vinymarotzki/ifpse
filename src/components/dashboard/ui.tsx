import { ShieldAlert, ShieldCheck, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { RISK_LABEL, type RiskLevel } from "@/lib/hse/risk";

const ICONS: Record<RiskLevel, LucideIcon> = {
  alto: ShieldAlert,
  moderado: TriangleAlert,
  baixo: ShieldCheck,
};

/** Risco nunca é só cor: ícone + rótulo acompanham sempre. */
export function RiskBadge({ level }: { level: RiskLevel | null }) {
  if (!level) return <span className="badge bg-surface-2 text-muted">Sem dados</span>;
  const Icon = ICONS[level];
  return (
    <span className={`badge badge-${level}`}>
      <Icon size={13} aria-hidden />
      {RISK_LABEL[level]}
    </span>
  );
}

export function RiskIcon({ level, size = 14 }: { level: RiskLevel; size?: number }) {
  const Icon = ICONS[level];
  return <Icon size={size} aria-hidden />;
}

export function Card({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card flex flex-col p-4 sm:p-5 ${className}`}>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="card-title">{title}</h2>
          {subtitle && <p className="card-sub mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

/** Tooltip único para todos os gráficos (tema via variáveis CSS). */
export function TooltipBox({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div
      className="min-w-[160px] rounded-lg bg-surface px-3 py-2 text-[13px] text-ink shadow-lg"
      style={{ border: "1px solid var(--ring)" }}
    >
      {title && <p className="mb-1 font-semibold">{title}</p>}
      <div className="space-y-0.5 text-ink-2">{children}</div>
    </div>
  );
}

export function Swatch({ color }: { color: string }) {
  return <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: color }} />;
}
