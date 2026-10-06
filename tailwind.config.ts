import type { Config } from "tailwindcss";

// Todas as cores vêm de variáveis CSS (globals.css) — é assim que o modo
// claro/escuro troca num lugar só, inclusive dentro dos SVGs do Recharts.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        page: "var(--page)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        ink: "var(--ink)",
        "ink-2": "var(--ink-2)",
        muted: "var(--muted)",
        line: "var(--line)",
        brand: "var(--brand)",
        risk: {
          high: "var(--risk-high)",
          mid: "var(--risk-mid)",
          low: "var(--risk-low)",
        },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', '"Segoe UI"', "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgb(16 24 40 / 0.04), 0 1px 3px rgb(16 24 40 / 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
