import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const wa = req.nextUrl.searchParams.get("wa") || "";
  const msg = req.nextUrl.searchParams.get("msg") || "";

  if (!wa) {
    return NextResponse.json({ error: "wa obrigatório" }, { status: 400 });
  }

  // Usar wa.me — formato oficial do WhatsApp
  // O msg já chega decodificado pelo searchParams.get, re-codificar pra URL
  const waUrl = `https://wa.me/${wa}?text=${encodeURIComponent(msg)}`;

  // Redirect 302 — o navegador/iOS trata server-side redirect melhor
  return new Response(null, {
    status: 302,
    headers: { Location: waUrl },
  });
}
