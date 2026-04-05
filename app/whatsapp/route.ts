import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const wa = req.nextUrl.searchParams.get("wa") || "";
  const msg = req.nextUrl.searchParams.get("msg") || "";

  if (!wa) {
    return new Response("wa obrigatório", { status: 400 });
  }

  // msg já chega decodificado pelo searchParams.get
  // Montar URL do wa.me com encoding correto (uma vez só)
  const textParam = encodeURIComponent(msg);
  const waUrl = `https://wa.me/${wa}?text=${textParam}`;

  return new Response(null, {
    status: 302,
    headers: { Location: waUrl },
  });
}
