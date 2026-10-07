import type { RiskLevel } from "@/lib/hse/risk";

export type Lang = "pt" | "en";

export const LEVEL_VAR: Record<RiskLevel, string> = {
  alto: "var(--risk-high)",
  moderado: "var(--risk-mid)",
  baixo: "var(--risk-low)",
};

const LOCALE: Record<Lang, string> = { pt: "pt-BR", en: "en-US" };

const MONTHS: Record<Lang, string[]> = {
  pt: ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};

/** Formatadores presos ao idioma: o número, a data e o mês mudam junto com o texto. */
export function makeFormatters(lang: Lang) {
  const locale = LOCALE[lang];

  /** 1 casa por padrão ("3,4" / "3.4"); dados ausentes viram travessão. */
  function fmt(value: number | null | undefined, digits = 1): string {
    if (value === null || value === undefined) return "—";
    return value.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  function fmtInt(value: number): string {
    return value.toLocaleString(locale);
  }

  /** "2026-10-06" → "06/10" (pt) ou "10/06" (en); "2026-10" → "out/26" ou "Oct/26". */
  function fmtPeriod(period: string): string {
    const [year, month, day] = period.split("-");
    if (day) return lang === "pt" ? `${day}/${month}` : `${month}/${day}`;
    return `${MONTHS[lang][Number(month) - 1] ?? month}/${year.slice(2)}`;
  }

  function fmtDate(iso: string | null): string {
    if (!iso) return "—";
    const [year, month, day] = iso.slice(0, 10).split("-");
    return lang === "pt" ? `${day}/${month}/${year}` : `${month}/${day}/${year}`;
  }

  function fmtDateTime(iso: string | null, empty: string): string {
    if (!iso) return empty;
    return new Date(iso).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" });
  }

  return { fmt, fmtInt, fmtPeriod, fmtDate, fmtDateTime };
}

export type Formatters = ReturnType<typeof makeFormatters>;
