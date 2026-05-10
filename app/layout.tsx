import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UNECE Monitor — Vigilancia de Reglamentos WP.29",
  description:
    "Sistema de monitorización automática de cambios en reglamentos UNECE WP.29 con análisis IA",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
