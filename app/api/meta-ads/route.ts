import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const META_API = "https://graph.facebook.com/v21.0";

async function metaFetch(url: string, token: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Meta API error ${res.status}`);
  }
  return res.json();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, agencia_id, ad_account_id, adAccountId: adAccountIdCamel, token, date_from, date_to } = body;

    // Se não recebeu token diretamente, buscar da agência
    let accessToken = token;
    let adAccountId = ad_account_id || adAccountIdCamel;

    if (!accessToken && agencia_id) {
      const { data: ag } = await supabase.from("agencias").select("meta_business_token, meta_ad_account_id").eq("id", agencia_id).single();
      if (ag) {
        accessToken = ag.meta_business_token;
        adAccountId = adAccountId || ag.meta_ad_account_id;
      }
    }

    if (!accessToken) {
      return NextResponse.json({ error: "Token não configurado" }, { status: 400 });
    }

    // ─── Ações ─────────────────────────────────────────────────

    if (action === "listar_contas") {
      // Listar todas as contas de anúncio acessíveis pelo token
      const data = await metaFetch(
        `${META_API}/me/adaccounts?fields=id,name,account_status,currency,balance,spend_cap,amount_spent&limit=100`,
        accessToken
      );
      return NextResponse.json(data.data || []);
    }

    if (action === "insights") {
      if (!adAccountId) {
        return NextResponse.json({ error: "Ad Account ID não informado" }, { status: 400 });
      }
      const acId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
      const timeRange = date_from && date_to
        ? `&time_range={"since":"${date_from}","until":"${date_to}"}`
        : "";

      const data = await metaFetch(
        `${META_API}/${acId}/insights?fields=impressions,reach,clicks,ctr,cpm,spend,actions,cost_per_action_type,frequency${timeRange}`,
        accessToken
      );
      return NextResponse.json(data.data || []);
    }

    if (action === "campanhas") {
      if (!adAccountId) {
        return NextResponse.json({ error: "Ad Account ID não informado" }, { status: 400 });
      }
      const acId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
      const timeRange = date_from && date_to
        ? `&time_range={"since":"${date_from}","until":"${date_to}"}`
        : "";

      const data = await metaFetch(
        `${META_API}/${acId}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget,insights.time_range(${date_from ? `{"since":"${date_from}","until":"${date_to}"}` : "{}"}){impressions,reach,clicks,ctr,cpm,spend,actions,cost_per_action_type,frequency}&limit=100`,
        accessToken
      );
      return NextResponse.json(data.data || []);
    }

    if (action === "conjuntos") {
      if (!adAccountId) {
        return NextResponse.json({ error: "Ad Account ID não informado" }, { status: 400 });
      }
      const acId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
      const data = await metaFetch(
        `${META_API}/${acId}/adsets?fields=id,name,status&limit=100`,
        accessToken
      );
      return NextResponse.json(data.data || []);
    }

    if (action === "criativos") {
      if (!adAccountId) {
        return NextResponse.json({ error: "Ad Account ID não informado" }, { status: 400 });
      }
      const acId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;

      // Buscar todos os ads (com insights opcionais se tiver período)
      let url = `${META_API}/${acId}/ads?fields=id,name,status&limit=100`;
      if (date_from && date_to) {
        url = `${META_API}/${acId}/ads?fields=id,name,status,creative{id,name,thumbnail_url,object_story_spec},insights.time_range({"since":"${date_from}","until":"${date_to}"}){impressions,reach,clicks,ctr,cpm,spend,actions,cost_per_action_type}&limit=100`;
      }
      const data = await metaFetch(url, accessToken);
      return NextResponse.json(data.data || []);
    }

    if (action === "saldo") {
      if (!adAccountId) {
        return NextResponse.json({ error: "Ad Account ID não informado" }, { status: 400 });
      }
      const acId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
      const data = await metaFetch(
        `${META_API}/${acId}?fields=balance,spend_cap,amount_spent,currency,name`,
        accessToken
      );
      return NextResponse.json(data);
    }

    if (action === "validar_token") {
      const data = await metaFetch(
        `${META_API}/me?fields=id,name`,
        accessToken
      );
      return NextResponse.json({ valid: true, ...data });
    }

    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erro interno" }, { status: 500 });
  }
}
