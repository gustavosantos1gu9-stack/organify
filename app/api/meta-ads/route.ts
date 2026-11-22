import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;

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
    const code = err?.error?.code;
    const msg = err?.error?.message || `Meta API error ${res.status}`;
    // Token expirado ou inválido
    if (res.status === 401 || code === 190 || code === 102) {
      throw new Error("Token expirado ou inválido. Gere um novo token no Facebook e atualize em Conexões.");
    }
    throw new Error(msg);
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
      const contasMap = new Map<string, any>();

      // Busca paginada de uma URL — retorna todos os itens
      async function fetchPaginado(urlInicial: string): Promise<any[]> {
        const itens: any[] = [];
        let url: string | null = urlInicial;
        while (url) {
          const data = await metaFetch(url, accessToken);
          itens.push(...(data.data || []));
          url = data.paging?.next || null;
        }
        return itens;
      }

      // 1. Contas diretas + businesses em paralelo
      const [diretas, businesses] = await Promise.all([
        fetchPaginado(`${META_API}/me/adaccounts?fields=id,name,account_status,currency,balance,spend_cap,amount_spent&limit=500`).catch(() => [] as any[]),
        fetchPaginado(`${META_API}/me/businesses?fields=id,name&limit=50`).catch(() => [] as any[]),
      ]);

      for (const c of diretas) contasMap.set(c.id, c);

      // 2. Para cada business, busca owned + client + partner ad accounts em paralelo
      if (businesses.length > 0) {
        await Promise.all(
          businesses.flatMap((biz: any) =>
            ["owned_ad_accounts", "client_ad_accounts", "partner_ad_accounts"].map((endpoint) =>
              fetchPaginado(`${META_API}/${biz.id}/${endpoint}?fields=id,name,account_status,currency,balance,spend_cap,amount_spent&limit=200`)
                .then(contas => { for (const c of contas) if (!contasMap.has(c.id)) contasMap.set(c.id, c); })
                .catch(() => {})
            )
          )
        );
      }

      if (contasMap.size === 0) {
        return NextResponse.json({ error: "Token expirado ou sem permissão. Reconecte em Conexões." }, { status: 401 });
      }
      const todas = Array.from(contasMap.values()).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      return NextResponse.json(todas);
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
