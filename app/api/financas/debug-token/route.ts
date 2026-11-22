import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const SPREADSHEET_ID = "1d_5pZpV1l3h6PMuCKuNlBal20wJKRezAPmoMlr3lyQI";

export async function GET() {
  const { data: cfg } = await supabase
    .from("financas_config")
    .select("google_refresh_token, google_email, spreadsheet_id")
    .limit(1)
    .single();

  if (!cfg?.google_refresh_token)
    return NextResponse.json({ ok: false, error: "sem refresh_token" });

  // Refresh token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: cfg.google_refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;

  if (!accessToken) {
    return NextResponse.json({ ok: false, step: "refresh_failed", error: tokenData });
  }

  // Test Sheets API
  const sheetsRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=properties.title,sheets.properties.title`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const sheetsData = await sheetsRes.json();

  return NextResponse.json({
    ok: sheetsRes.ok,
    email: cfg.google_email,
    token_ok: true,
    scope: tokenData.scope,
    sheets_status: sheetsRes.status,
    sheets_response: sheetsData,
  });
}
