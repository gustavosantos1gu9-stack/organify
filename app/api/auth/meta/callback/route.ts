import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const META_API = "https://graph.facebook.com/v21.0";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  // Usuário cancelou
  if (error) {
    return NextResponse.redirect(`${url.origin}/relatorios-meta/conexoes?meta_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${url.origin}/relatorios-meta/conexoes?meta_error=Código não recebido`);
  }

  // Decodificar state
  let agenciaId: string | null = null;
  let returnTo = "/relatorios-meta/conexoes";
  let tokenType = "business"; // "pixel" | "business"
  if (stateParam) {
    try {
      const state = JSON.parse(Buffer.from(stateParam, "base64url").toString());
      agenciaId = state.agencia_id;
      if (state.return_to) returnTo = state.return_to;
      if (state.token_type) tokenType = state.token_type;
    } catch {}
  }

  const appId = process.env.META_APP_ID!;
  const appSecret = process.env.META_APP_SECRET!;
  const redirectUri = `${url.origin}/api/auth/meta/callback`;

  try {
    // 1. Trocar code por short-lived token
    const tokenRes = await fetch(
      `${META_API}/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`
    );
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      return NextResponse.redirect(`${url.origin}${returnTo}?meta_error=${encodeURIComponent(tokenData.error.message)}`);
    }

    const shortToken = tokenData.access_token;

    // 2. Trocar por long-lived token (60 dias)
    const longRes = await fetch(
      `${META_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortToken}`
    );
    const longData = await longRes.json();
    const longToken = longData.access_token || shortToken;

    // 3. Buscar info do usuário
    const meRes = await fetch(`${META_API}/me?fields=id,name`, {
      headers: { Authorization: `Bearer ${longToken}` },
    });
    const meData = await meRes.json();

    if (meData.error) {
      return NextResponse.redirect(`${url.origin}${returnTo}?meta_error=${encodeURIComponent(meData.error.message)}`);
    }

    // 4. Salvar token conforme o contexto
    if (agenciaId) {
      if (tokenType === "pixel" || tokenType === "master") {
        // MASTER INBOX: conectando para inbox/formulários — salva em agencias.meta_token
        await supabase.from("agencias").update({
          meta_token: longToken,
        }).eq("id", agenciaId);
      } else if (tokenType === "gerenciador") {
        // MASTER GERENCIADOR: conectando para ad manager — salva em agencias.meta_business_token
        await supabase.from("agencias").update({
          meta_business_token: longToken,
        }).eq("id", agenciaId);
      } else {
        // MASTER OPERACIONAL: conectando para relatórios — salva só em relatorios_conexoes
        // NÃO toca em agencias (não quebra inbox nem formulários)
        const { data: existing } = await supabase
          .from("relatorios_conexoes")
          .select("id")
          .eq("agencia_id", agenciaId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (existing) {
          await supabase.from("relatorios_conexoes").update({
            meta_token: longToken,
            meta_nome: meData.name,
            meta_user_id: meData.id,
            updated_at: new Date().toISOString(),
          }).eq("id", existing.id);
        } else {
          await supabase.from("relatorios_conexoes").insert({
            agencia_id: agenciaId,
            meta_token: longToken,
            meta_nome: meData.name,
            meta_user_id: meData.id,
          });
        }

        // Sincronizar leads de formulário do Meta (fire-and-forget)
        fetch(`${url.origin}/api/meta/sync-leads`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agencia_id: agenciaId }),
        }).catch(() => {});
      }
    }

    const agenciaParam = agenciaId ? `&agencia_id=${agenciaId}` : "";
    return NextResponse.redirect(`${url.origin}${returnTo}?meta_success=true&meta_nome=${encodeURIComponent(meData.name)}&token_type=${tokenType}${agenciaParam}`);

  } catch (e: any) {
    return NextResponse.redirect(`${url.origin}${returnTo}?meta_error=${encodeURIComponent(e.message || "Erro na autenticação")}`);
  }
}
