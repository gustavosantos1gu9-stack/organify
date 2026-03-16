import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Organify — Organização para agências",
  description: "Plataforma de gestão para agências digitais",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
