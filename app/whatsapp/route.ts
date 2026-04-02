import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const wa = searchParams.get("wa") || "";
  const msg = searchParams.get("msg") || "";

  if (!wa) {
    return NextResponse.json({ error: "wa obrigatório" }, { status: 400 });
  }

  const waUrl = `https://api.whatsapp.com/send?phone=${wa}&text=${encodeURIComponent(msg)}`;
  return NextResponse.redirect(waUrl, 302);
}
