import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const META_API = "https://graph.facebook.com/v21.0";

async function metaFetch(url: string, token: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Meta API error ${res.status}: ${errText}`);
  }
  return res.json();
}

function getPeriodDates(periodo: string): { since: string; until: string } {
  const now = new Date();
  const brDateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const [y, m, d] = brDateStr.split("-").map(Number);
  const hoje = new Date(y, m - 1, d);
  const fmt = (d: Date) => d.toISOString().split("T")[0];

  if (periodo === "hoje") {
    return { since: fmt(hoje), until: fmt(hoje) };
  }
  if (periodo === "ontem") {
    const ontem = new Date(hoje);
    ontem.setDate(ontem.getDate() - 1);
    return { since: fmt(ontem), until: fmt(ontem) };
  }
  if (periodo === "ultima_semana") {
    const day = hoje.getDay();
    const sabPassado = new Date(hoje);
    sabPassado.setDate(hoje.getDate() - day - 1);
    const domPassado = new Date(sabPassado);
    domPassado.setDate(sabPassado.getDate() - 6);
    return { since: fmt(domPassado), until: fmt(sabPassado) };
  }
  if (periodo === "ultimos_7_dias") {
    const inicio = new Date(hoje);
    inicio.setDate(hoje.getDate() - 7);
    return { since: fmt(inicio), until: fmt(hoje) };
  }
  if (periodo === "mes_atual") {
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    return { since: fmt(inicio), until: fmt(hoje) };
  }
  return { since: fmt(hoje), until: fmt(hoje) };
}

function extractMensagens(actions: any[]): number {
  if (!actions || !Array.isArray(actions)) return 0;
  const action = actions.find((a: any) =>
    a.action_type === "onsite_conversion.messaging_conversation_started_7d" ||
    a.action_type === "offsite_conversion.fb_pixel_lead" ||
    a.action_type === "lead"
  );
  return action ? parseInt(String(action.value)) || 0 : 0;
}

function extractCustoMensagem(costPerAction: any[]): number {
  if (!costPerAction || !Array.isArray(costPerAction)) return 0;
  const action = costPerAction.find((a: any) =>
    a.action_type === "onsite_conversion.messaging_conversation_started_7d" ||
    a.action_type === "offsite_conversion.fb_pixel_lead" ||
    a.action_type === "lead"
  );
  return action ? parseFloat(String(action.value)) || 0 : 0;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let adAccountId: string;
    let token: string;
    let periodo: string;
    let nomeCliente: string = "";

    if (body.relatorio_id) {
      // Fetch relatorio from DB
      const { data: rel, error: relErr } = await supabase
        .from("relatorios")
        .select("*")
        .eq("id", body.relatorio_id)
        .single();

      if (relErr || !rel) {
        return NextResponse.json({ error: "Relatório não encontrado" }, { status: 404 });
      }

      // Fetch token from conexoes or relatorio
      const { data: con } = await supabase
        .from("relatorios_conexoes")
        .select("meta_token")
        .eq("agencia_id", rel.agencia_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      token = rel.meta_token || con?.meta_token;
      if (!token) {
        return NextResponse.json({ error: "Token Meta não configurado" }, { status: 400 });
      }

      adAccountId = rel.ad_account_id;
      periodo = rel.periodo;
      nomeCliente = rel.nome_cliente || "";
    } else {
      adAccountId = body.ad_account_id;
      token = body.token;
      periodo = body.periodo || "mes_atual";
      nomeCliente = body.nome_cliente || "";
    }

    if (!adAccountId || !token) {
      return NextResponse.json({ error: "ad_account_id e token são obrigatórios" }, { status: 400 });
    }

    const acId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
    // Suporte a datas customizadas
    const customSince = body.date_from;
    const customUntil = body.date_to;
    const { since, until } = customSince && customUntil
      ? { since: customSince, until: customUntil }
      : getPeriodDates(periodo);
    const timeRange = `{"since":"${since}","until":"${until}"}`;

    // Fetch all data in parallel
    const [
      accountInsights,
      dailyInsights,
      campaignInsights,
      adInsights,
      placementInsights,
      ageInsights,
      accountInfo,
    ] = await Promise.all([
      // 1. Account-level insights
      metaFetch(
        `${META_API}/${acId}/insights?fields=impressions,reach,clicks,ctr,cpm,spend,actions,cost_per_action_type,frequency&time_range=${timeRange}`,
        token
      ),
      // 2. Daily breakdown
      metaFetch(
        `${META_API}/${acId}/insights?fields=impressions,clicks,spend,actions&time_increment=1&time_range=${timeRange}`,
        token
      ),
      // 3. Campaign breakdown
      metaFetch(
        `${META_API}/${acId}/insights?fields=campaign_name,impressions,clicks,spend,actions,cost_per_action_type,ctr&level=campaign&time_range=${timeRange}&limit=100`,
        token
      ),
      // 4. Ad breakdown
      metaFetch(
        `${META_API}/${acId}/insights?fields=ad_name,impressions,clicks,spend,actions,cost_per_action_type,ctr&level=ad&time_range=${timeRange}&limit=100`,
        token
      ),
      // 5. Placement breakdown
      metaFetch(
        `${META_API}/${acId}/insights?fields=impressions,clicks,spend,actions,ctr&breakdowns=publisher_platform,platform_position&time_range=${timeRange}&limit=100`,
        token
      ),
      // 6. Age breakdown
      metaFetch(
        `${META_API}/${acId}/insights?fields=impressions,clicks,spend,actions&breakdowns=age&time_range=${timeRange}&limit=20`,
        token
      ),
      // 7. Account balance
      metaFetch(
        `${META_API}/${acId}?fields=spend_cap,amount_spent,balance,currency,name`,
        token
      ),
    ]);

    // Process account-level data
    const acc = accountInsights.data?.[0] || {};
    const totalImpressions = parseInt(acc.impressions || "0");
    const totalReach = parseInt(acc.reach || "0");
    const totalClicks = parseInt(acc.clicks || "0");
    const totalCtr = parseFloat(acc.ctr || "0");
    const totalCpm = parseFloat(acc.cpm || "0");
    const totalSpend = parseFloat(acc.spend || "0");
    const totalFrequency = parseFloat(acc.frequency || "0");
    const totalMensagens = extractMensagens(acc.actions);
    const totalCustoMensagem = extractCustoMensagem(acc.cost_per_action_type);

    // Process daily data
    const daily = (dailyInsights.data || []).map((d: any) => ({
      date: d.date_start,
      impressions: parseInt(d.impressions || "0"),
      clicks: parseInt(d.clicks || "0"),
      spend: parseFloat(d.spend || "0"),
      mensagens: extractMensagens(d.actions),
    }));

    // Process campaign data
    const campaigns = (campaignInsights.data || []).map((c: any) => ({
      name: c.campaign_name,
      impressions: parseInt(c.impressions || "0"),
      clicks: parseInt(c.clicks || "0"),
      spend: parseFloat(c.spend || "0"),
      ctr: parseFloat(c.ctr || "0"),
      mensagens: extractMensagens(c.actions),
      cpa: extractCustoMensagem(c.cost_per_action_type),
    }));

    // Process ad data
    const ads = (adInsights.data || []).map((a: any) => ({
      name: a.ad_name,
      impressions: parseInt(a.impressions || "0"),
      clicks: parseInt(a.clicks || "0"),
      spend: parseFloat(a.spend || "0"),
      ctr: parseFloat(a.ctr || "0"),
      mensagens: extractMensagens(a.actions),
      cpa: extractCustoMensagem(a.cost_per_action_type),
    }));

    // Process placement data
    const placements = (placementInsights.data || []).map((p: any) => ({
      platform: p.publisher_platform,
      position: p.platform_position,
      impressions: parseInt(p.impressions || "0"),
      clicks: parseInt(p.clicks || "0"),
      spend: parseFloat(p.spend || "0"),
      ctr: parseFloat(p.ctr || "0"),
      mensagens: extractMensagens(p.actions),
    }));

    // Process age data
    const ageGroups = (ageInsights.data || []).map((a: any) => ({
      age: a.age,
      impressions: parseInt(a.impressions || "0"),
      clicks: parseInt(a.clicks || "0"),
      spend: parseFloat(a.spend || "0"),
      mensagens: extractMensagens(a.actions),
    }));

    // Account info
    // Saldo disponível = spend_cap - amount_spent (fundos restantes)
    const spendCap = accountInfo.spend_cap ? parseFloat(accountInfo.spend_cap) / 100 : 0;
    const amountSpent2 = accountInfo.amount_spent ? parseFloat(accountInfo.amount_spent) / 100 : 0;
    const balance = spendCap > 0
      ? spendCap - amountSpent2
      : Math.abs(accountInfo.balance ? parseFloat(accountInfo.balance) / 100 : 0);
    const accountName = accountInfo.name || nomeCliente;
    const currency = accountInfo.currency || "BRL";

    // Comparação com período anterior (mesma duração)
    let comparacao = null;
    if (body.compare) {
      try {
        const compFrom = body.compare_from;
        const compTo = body.compare_to;
        if (compFrom && compTo) {
          const compTimeRange = `{"since":"${compFrom}","until":"${compTo}"}`;
          const compInsights = await metaFetch(
            `${META_API}/${acId}/insights?fields=impressions,reach,clicks,ctr,cpm,spend,actions,cost_per_action_type,frequency&time_range=${compTimeRange}`,
            token
          );
          const compAcc = compInsights.data?.[0] || {};
          comparacao = {
            impressions: parseInt(compAcc.impressions || "0"),
            reach: parseInt(compAcc.reach || "0"),
            clicks: parseInt(compAcc.clicks || "0"),
            ctr: parseFloat(compAcc.ctr || "0"),
            cpm: parseFloat(compAcc.cpm || "0"),
            spend: parseFloat(compAcc.spend || "0"),
            frequency: parseFloat(compAcc.frequency || "0"),
            mensagens: extractMensagens(compAcc.actions),
            custoMensagem: 0,
          };
          comparacao.custoMensagem = comparacao.mensagens > 0 ? comparacao.spend / comparacao.mensagens : 0;
        }
      } catch {}
    }

    return NextResponse.json({
      nomeCliente: nomeCliente || accountName,
      periodo: { since, until, label: periodo },
      resumo: {
        impressions: totalImpressions,
        reach: totalReach,
        clicks: totalClicks,
        ctr: totalCtr,
        cpm: totalCpm,
        spend: totalSpend,
        frequency: totalFrequency,
        mensagens: totalMensagens,
        custoMensagem: totalCustoMensagem,
        balance,
        currency,
      },
      comparacao,
      daily,
      campaigns,
      ads,
      placements,
      ageGroups,
      // Aliases para o dashboard
      diario: daily,
      campanhas: campaigns,
      anuncios: ads,
      posicionamentos: placements,
      idade: ageGroups,
    });
  } catch (err: any) {
    console.error("Dashboard API error:", err);
    return NextResponse.json({ error: err.message || "Erro interno" }, { status: 500 });
  }
}
