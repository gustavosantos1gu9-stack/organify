import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const TARGET = "1d_5pZpV1l3h6PMuCKuNlBal20wJKRezAPmoMlr3lyQI";

async function getToken(refreshToken: string): Promise<string | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const d = await res.json();
  return d.access_token || null;
}

export async function GET() {
  const { data: cfg } = await supabase.from("financas_config").select("google_refresh_token").limit(1).single();
  if (!cfg?.google_refresh_token) return NextResponse.json({ ok: false, error: "sem token" });

  const accessToken = await getToken(cfg.google_refresh_token);
  if (!accessToken) return NextResponse.json({ ok: false, error: "token inválido" });

  const metaRes = await fetch(`${SHEETS_BASE}/${TARGET}?fields=sheets.properties`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const meta = await metaRes.json();

  if (!metaRes.ok) return NextResponse.json({ ok: false, error: meta, status: metaRes.status });

  const sheets = (meta.sheets || []).map((s: any) => ({
    title: s.properties.title,
    sheetId: s.properties.sheetId,
  }));

  const details = [];
  for (const sheet of sheets) {
    const r = await fetch(
      `${SHEETS_BASE}/${TARGET}/values/${encodeURIComponent(`'${sheet.title}'!A1:Z3`)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const d = await r.json();
    details.push({ ...sheet, rows: d.values || [] });
  }

  return NextResponse.json({ ok: true, sheets: details });
}
