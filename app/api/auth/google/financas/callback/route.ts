import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.salxconvert.com.br";
const REDIRECT_URI = `${APP_URL}/api/auth/google/financas/callback`;

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code");
    if (!code) return NextResponse.redirect(`${APP_URL}/financas?error=missing_code`);

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
    console.log("[financas/callback] Token response keys:", Object.keys(tokens));
    console.log("[financas/callback] Token prefix:", tokens.refresh_token ? tokens.refresh_token.substring(0, 15) : "NONE");
    if (!tokens.refresh_token) {
      console.error("[financas/callback] Sem refresh_token. Resposta:", JSON.stringify(tokens).slice(0, 200));
      const errMsg = tokens.error ? `google_error_${tokens.error}` : "no_refresh_token";
      return NextResponse.redirect(`${APP_URL}/financas?error=${errMsg}`);
    }

    // Testar Calendar scope (sem bloquear — apenas logar)
    const calTestRes = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=1", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const calTestOk = calTestRes.ok;
    console.log("[financas/callback] Calendar test status:", calTestRes.status, "ok:", calTestOk);
    if (!calTestOk) {
      const calErr = await calTestRes.json().catch(() => ({}));
      console.warn("[financas/callback] Token SEM Calendar scope (salvando mesmo assim):", JSON.stringify(calErr).slice(0, 200));
    } else {
      console.log("[financas/callback] Token TEM Calendar scope OK");
    }

    // Get user email
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const user = await userRes.json();
    const email = user.email || "";

    // Check if config row exists (preserve existing spreadsheet_id)
    const { data: existing } = await supabase
      .from("financas_config")
      .select("id, spreadsheet_id, spreadsheet_url")
      .limit(1)
      .single();

    if (existing?.id) {
      // Just update the token — keep the existing spreadsheet
      await supabase
        .from("financas_config")
        .update({
          google_refresh_token: tokens.refresh_token,
          google_email: email,
        })
        .eq("id", existing.id);
    } else {
      // First time setup — no spreadsheet yet
      await supabase.from("financas_config").insert({
        google_refresh_token: tokens.refresh_token,
        google_email: email,
      });
    }

    return NextResponse.redirect(`${APP_URL}/financas?success=true`);
  } catch (e) {
    console.error("[financas/callback] Erro:", e);
    return NextResponse.redirect(`${APP_URL}/financas?error=exception`);
  }
}
