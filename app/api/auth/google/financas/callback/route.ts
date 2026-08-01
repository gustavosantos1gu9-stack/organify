import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSpreadsheet } from "@/lib/google-sheets";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://salxconvert-blond.vercel.app";
const REDIRECT_URI = `${APP_URL}/api/auth/google/financas/callback`;

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code");
    if (!code) {
      return NextResponse.redirect(`${APP_URL}/financas?error=missing_code`);
    }

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenRes.json();
    if (!tokens.refresh_token) {
      console.error("[financas/callback] Sem refresh_token:", tokens);
      return NextResponse.redirect(`${APP_URL}/financas?error=no_refresh_token`);
    }

    // Get user email
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const user = await userRes.json();
    const email = user.email || "";

    // Create spreadsheet
    const sheet = await createSpreadsheet(tokens.refresh_token, "💰 Finanças Pessoais");
    if (!sheet) {
      return NextResponse.redirect(`${APP_URL}/financas?error=sheet_creation_failed`);
    }

    // Upsert into financas_config (single row using a fixed approach)
    // Check if row exists
    const { data: existing } = await supabase
      .from("financas_config")
      .select("id")
      .limit(1)
      .single();

    if (existing?.id) {
      await supabase
        .from("financas_config")
        .update({
          google_refresh_token: tokens.refresh_token,
          google_email: email,
          spreadsheet_id: sheet.spreadsheetId,
          spreadsheet_url: sheet.spreadsheetUrl,
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("financas_config").insert({
        google_refresh_token: tokens.refresh_token,
        google_email: email,
        spreadsheet_id: sheet.spreadsheetId,
        spreadsheet_url: sheet.spreadsheetUrl,
      });
    }

    return NextResponse.redirect(`${APP_URL}/financas?success=true`);
  } catch (e) {
    console.error("[financas/callback] Erro:", e);
    return NextResponse.redirect(`${APP_URL}/financas?error=exception`);
  }
}
