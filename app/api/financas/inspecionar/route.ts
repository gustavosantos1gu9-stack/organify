import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAccessToken } from "@/lib/google-calendar";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

export async function GET() {
  const { data: cfg } = await supabase.from("financas_config").select("*").limit(1).single();
  if (!cfg?.google_refresh_token || !cfg?.spreadsheet_id)
    return NextResponse.json({ ok: false, error: "Não configurado" });

  let accessToken: string;
  try { accessToken = await getAccessToken(cfg.google_refresh_token); }
  catch { return NextResponse.json({ ok: false, error: "Token inválido" }); }

  const metaRes = await fetch(`${SHEETS_BASE}/${cfg.spreadsheet_id}?fields=sheets.properties`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const meta = await metaRes.json();
  const sheets = (meta.sheets || []).map((s: any) => ({
    title: s.properties.title,
    sheetId: s.properties.sheetId,
    rowCount: s.properties.gridProperties?.rowCount,
    colCount: s.properties.gridProperties?.columnCount,
  }));

  // Fetch first row (headers) of each sheet
  const results = [];
  for (const sheet of sheets) {
    const rangeRes = await fetch(
      `${SHEETS_BASE}/${cfg.spreadsheet_id}/values/${encodeURIComponent(`'${sheet.title}'!A1:Z1`)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const rangeData = await rangeRes.json();
    results.push({ ...sheet, headers: rangeData.values?.[0] || [] });
  }

  return NextResponse.json({ ok: true, spreadsheetId: cfg.spreadsheet_id, sheets: results });
}
