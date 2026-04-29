import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://salxconvert-blond.vercel.app";
const REDIRECT_URI = `${APP_URL}/api/auth/google/callback`;

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code");
    const state = req.nextUrl.searchParams.get("state");
    if (!code || !state) return NextResponse.redirect(`${APP_URL}/secretaria-ia?google_error=missing_params`);

    const { agencia_id } = JSON.parse(Buffer.from(state, "base64url").toString());
    if (!agencia_id) return NextResponse.redirect(`${APP_URL}/secretaria-ia?google_error=invalid_state`);

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
      console.error("[google] No refresh_token:", tokens);
      return NextResponse.redirect(`${APP_URL}/secretaria-ia?google_error=no_refresh_token`);
    }

    // Get user email
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const user = await userRes.json();

    // Save to database
    await supabase.from("agencias").update({
      google_calendar_refresh_token: tokens.refresh_token,
      google_calendar_email: user.email || "",
      google_calendar_ativo: true,
    }).eq("id", agencia_id);

    return NextResponse.redirect(`${APP_URL}/secretaria-ia?google_success=true`);
  } catch (e) {
    console.error("[google callback] Erro:", e);
    return NextResponse.redirect(`${APP_URL}/secretaria-ia?google_error=exception`);
  }
}
