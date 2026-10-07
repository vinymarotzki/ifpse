import type { Metadata, Viewport } from "next";
import { I18nProvider } from "@/components/dashboard/i18n";
import "./globals.css";

/**
 * Aplica o tema salvo antes da primeira pintura: sem isto quem escolheu claro
 * (ou escuro) veria um flash do tema do SO até o React hidratar.
 */
const THEME_BOOT = `try{var t=localStorage.getItem("ifpse-theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

export const metadata: Metadata = {
  title: "IFPSE · Riscos Psicossociais",
  description:
    "Dashboard dos riscos psicossociais da CGC — IFPSE, baseado no Management Standards Indicator Tool.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className="min-h-screen font-sans">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
