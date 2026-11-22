import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

async function getAccessToken(refreshToken: string): Promise<string | null> {
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
  // Select all rows to debug
  const { data: rows, error } = await supabase.from("financas_config").select("*");

  if (error) return NextResponse.json({ ok: false, error: error.message, step: "select" });
  if (!rows?.length) return NextResponse.json({ ok: false, error: "nenhuma row", rows });

  // Use the row with the correct spreadsheet
  const cfg = rows.find((r) => r.spreadsheet_id === "1d_5pZpV1l3h6PMuCKuNlBal20wJKRezAPmoMlr3lyQI") || rows[0];

  const allIds = rows.map((r) => ({ id: r.id, spreadsheet_id: r.spreadsheet_id, email: r.google_email }));

  if (!cfg?.google_refresh_token) return NextResponse.json({ ok: false, error: "sem token", allIds });

  const accessToken = await getAccessToken(cfg.google_refresh_token);
  if (!accessToken) return NextResponse.json({ ok: false, error: "token inválido", allIds });

  const tabName = "🏠 Família";
  const range = `'${tabName}'!A:G`;
  const today = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const url = `${SHEETS_BASE}/${cfg.spreadsheet_id}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      values: [[today, "Alimentação", "Teste mercado", "Variável", 50, 8, 2026]],
    }),
  });

  const data = await res.json();

  return NextResponse.json({
    ok: res.ok,
    status: res.status,
    spreadsheet_id_used: cfg.spreadsheet_id,
    allIds,
    response: data,
  });
}
