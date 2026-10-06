import type { RiskLevel } from "@/lib/hse/risk";

export const LEVEL_VAR: Record<RiskLevel, string> = {
  alto: "var(--risk-high)",
  moderado: "var(--risk-mid)",
  baixo: "var(--risk-low)",
};

/** 1 casa por padrão ("3,4"); dados ausentes viram travessão. */
export function fmt(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtInt(value: number): string {
  return value.toLocaleString("pt-BR");
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-10-06" → "06/10/2026"; "2026-10" → "out/26". */
export function fmtPeriod(period: string): string {
  const [year, month, day] = period.split("-");
  if (day) return `${day}/${month}`;
  return `${MONTHS[Number(month) - 1] ?? month}/${year.slice(2)}`;
}

export function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const [year, month, day] = iso.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

export function fmtDateTime(iso: string | null): string {
  if (!iso) return "ainda sem dados";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
