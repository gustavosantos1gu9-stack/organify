import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Salx Convert - Aceleração de Vendas",
  description: "Aceleração de Vendas",
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "64x64", type: "image/png" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
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
