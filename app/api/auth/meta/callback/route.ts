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
  if (stateParam) {
    try {
      const state = JSON.parse(Buffer.from(stateParam, "base64url").toString());
      agenciaId = state.agencia_id;
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
      return NextResponse.redirect(`${url.origin}/relatorios-meta/conexoes?meta_error=${encodeURIComponent(tokenData.error.message)}`);
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
      return NextResponse.redirect(`${url.origin}/relatorios-meta/conexoes?meta_error=${encodeURIComponent(meData.error.message)}`);
    }

    // 4. Salvar token na conexão de relatórios
    if (agenciaId) {
      // Verificar se já existe conexão
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

      // Buscar a primeira conta de anúncio do usuário pra pré-selecionar
      let adAccountId: string | null = null;
      let pixelId: string | null = null;
      try {
        const adAccountsRes = await fetch(
          `${META_API}/me/adaccounts?fields=id,name,account_status&limit=5`,
          { headers: { Authorization: `Bearer ${longToken}` } }
        );
        const adAccountsData = await adAccountsRes.json();
        const activeAccount = (adAccountsData.data || []).find((a: any) => a.account_status === 1) || (adAccountsData.data || [])[0];
        if (activeAccount) {
          adAccountId = activeAccount.id.replace("act_", "");

          // Buscar pixel da conta
          const pixelRes = await fetch(
            `${META_API}/${activeAccount.id}/adspixels?fields=id,name&limit=1`,
            { headers: { Authorization: `Bearer ${longToken}` } }
          );
          const pixelData = await pixelRes.json();
          if (pixelData.data?.[0]) pixelId = pixelData.data[0].id;
        }
      } catch {}

      // Salvar tudo na agência
      const updateFields: Record<string, any> = {
        meta_business_token: longToken,
        meta_token: longToken,
        meta_ativo: true,
      };
      if (adAccountId) updateFields.meta_ad_account_id = adAccountId;
      if (pixelId) updateFields.meta_pixel_id = pixelId;

      await supabase.from("agencias").update(updateFields).eq("id", agenciaId);
    }

    // 5. Redirecionar de volta. Voltar pra Integrações se veio de lá, senão pra Conexões
    const returnTo = stateParam ? (() => {
      try {
        const state = JSON.parse(Buffer.from(stateParam, "base64url").toString());
        return state.return_to || "/relatorios-meta/conexoes";
      } catch { return "/relatorios-meta/conexoes"; }
    })() : "/relatorios-meta/conexoes";

    return NextResponse.redirect(`${url.origin}${returnTo}?meta_success=true&meta_nome=${encodeURIComponent(meData.name)}`);

  } catch (e: any) {
    return NextResponse.redirect(`${url.origin}/relatorios-meta/conexoes?meta_error=${encodeURIComponent(e.message || "Erro na autenticação")}`);
  }
}
