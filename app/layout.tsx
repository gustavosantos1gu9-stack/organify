import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Salx Convert - Aceleração de Vendas",
  description: "Aceleração de Vendas",
  icons: {
    icon: "/favicon.png",
    apple: "/apple-icon.png",
  },
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
