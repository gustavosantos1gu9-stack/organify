import { NextRequest, NextResponse } from "next/server";

// Inicia o fluxo OAuth do Meta — redireciona pro Facebook
export async function GET(req: NextRequest) {
  const appId = process.env.META_APP_ID;
  if (!appId) {
    return NextResponse.json({ error: "META_APP_ID não configurado" }, { status: 500 });
  }

  const url = new URL(req.url);
  const agenciaId = url.searchParams.get("agencia_id");
  const returnTo = url.searchParams.get("return_to") || "/relatorios-meta/conexoes";
  const redirectUri = `${url.origin}/api/auth/meta/callback`;

  // State: agencia_id pra saber onde salvar + return_to
  const state = JSON.stringify({ agencia_id: agenciaId, return_to: returnTo });
  const stateEncoded = Buffer.from(state).toString("base64url");

  // Permissões necessárias
  const scopes = [
    "ads_read",
    "ads_management",
    "business_management",
    "pages_read_engagement",
  ].join(",");

  const oauthUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&response_type=code&state=${stateEncoded}`;

  return NextResponse.redirect(oauthUrl);
}
