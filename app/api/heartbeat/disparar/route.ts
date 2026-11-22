import { NextRequest, NextResponse } from "next/server";

// Endpoint interno: dispara o cron de heartbeat com as credenciais server-side
export async function POST(req: NextRequest) {
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.salxconvert.com.br";
  const CRON_SECRET = process.env.CRON_SECRET;

  if (!CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET não configurado" }, { status: 500 });
  }

  try {
    const res = await fetch(`${APP_URL}/api/cron/heartbeat`, {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
