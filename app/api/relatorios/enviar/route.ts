import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const META_API = "https://graph.facebook.com/v21.0";

async function metaFetch(url: string, token: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Meta API error ${res.status}`);
  return res.json();
}

function formatNum(n: number | string): string {
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (isNaN(num)) return "0";
  return num.toLocaleString("pt-BR");
}

function formatMoney(n: number | string): string {
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (isNaN(num)) return "R$ 0,00";
  return `R$ ${num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercent(n: number | string): string {
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (isNaN(num)) return "0,00%";
  return `${num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function getPeriodDates(periodo: string): { since: string; until: string } {
  // Usar horário de Brasília para calcular períodos corretamente
  const now = new Date();
  const brDateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  // Criar date a partir da data BR para que getDate/getDay reflitam o dia correto
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
    // Dom anterior até Sáb anterior
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
  // default: hoje
  return { since: fmt(hoje), until: fmt(hoje) };
}

export async function POST(req: NextRequest) {
  try {
    const { relatorio_id, preview } = await req.json();

    // Buscar relatório
    const { data: rel, error: relErr } = await supabase
      .from("relatorios")
      .select("*")
      .eq("id", relatorio_id)
      .single();

    if (relErr || !rel) {
      return NextResponse.json({ error: "Relatório não encontrado" }, { status: 404 });
    }

    // Buscar conexões do módulo de relatórios (não usa agência como fallback)
    const { data: con } = await supabase
      .from("relatorios_conexoes")
      .select("evolution_url, evolution_key, whatsapp_instancia, meta_token")
      .eq("agencia_id", rel.agencia_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!con) {
      return NextResponse.json({ error: "Conexões não configuradas. Acesse Relatórios Meta → Conexões." }, { status: 404 });
    }

    const ag = con;
    const token = rel.meta_token || con.meta_token;
    if (!token) {
      return NextResponse.json({ error: "Token Meta não configurado" }, { status: 400 });
    }

    // Calcular período
    const { since, until } = getPeriodDates(rel.periodo);
    const periodoFormatado = `${since.split("-").reverse().join("/")} a ${until.split("-").reverse().join("/")}`;

    // Buscar insights da conta de anúncio
    const acId = rel.ad_account_id.startsWith("act_") ? rel.ad_account_id : `act_${rel.ad_account_id}`;

    const [insightsRes, saldoRes] = await Promise.all([
      metaFetch(
        `${META_API}/${acId}/insights?fields=impressions,reach,clicks,ctr,cpm,spend,actions,cost_per_action_type,frequency&time_range={"since":"${since}","until":"${until}"}`,
        token
      ),
      metaFetch(
        `${META_API}/${acId}?fields=spend_cap,amount_spent,balance,currency,name,funding_source_details{type,display_string}`,
        token
      ),
    ]);

    const ins = insightsRes.data?.[0] || {};
    const impressions = ins.impressions || 0;
    const reach = ins.reach || 0;
    const clicks = ins.clicks || 0;
    const frequency = ins.frequency || 0;
    const ctr = ins.ctr || 0;
    const cpm = ins.cpm || 0;
    const spend = ins.spend || 0;

    // Extrair conversas/leads das actions (prioridade: conversas CTWA > lead)
    const actions = ins.actions || [];
    const costPerAction = ins.cost_per_action_type || [];
    const prioridadeActions = [
      "onsite_conversion.messaging_conversation_started_7d",
      "onsite_conversion.total_messaging_connection",
      "onsite_conversion.messaging_first_reply",
      "offsite_conversion.fb_pixel_lead",
      "lead",
    ];
    const findByPrio = (arr: any[]) => {
      for (const tipo of prioridadeActions) {
        const found = arr.find((a: any) => a.action_type === tipo);
        if (found) return found.value || 0;
      }
      return 0;
    };
    const conversas = findByPrio(actions);
    const custoConversa = findByPrio(costPerAction);

    const convClickMsg = clicks > 0 ? ((parseInt(String(conversas)) / parseInt(String(clicks))) * 100) : 0;

    // Saldo disponível real vem em funding_source_details.display_string
    const envDisplay = saldoRes.funding_source_details?.display_string || "";
    const envMatch = envDisplay.match(/[\d.,]+/);
    let balance = 0;
    if (envMatch) {
      balance = parseFloat(envMatch[0].replace(/\./g, "").replace(",", "."));
    }
    if (!balance || isNaN(balance)) {
      const spendCap = saldoRes.spend_cap ? parseFloat(saldoRes.spend_cap) / 100 : 0;
      const amountSpent2 = saldoRes.amount_spent ? parseFloat(saldoRes.amount_spent) / 100 : 0;
      balance = spendCap > 0 ? spendCap - amountSpent2 : 0;
    }

    // Top 3 criativos
    let top3Text = "";
    try {
      const adsRes = await metaFetch(
        `${META_API}/${acId}/ads?fields=name,insights.time_range({"since":"${since}","until":"${until}"}){impressions,clicks,spend,actions,cost_per_action_type}&filtering=[{"field":"effective_status","operator":"IN","value":["ACTIVE","PAUSED"]}]&limit=50`,
        token
      );
      const ads = (adsRes.data || [])
        .filter((ad: any) => ad.insights?.data?.[0])
        .map((ad: any) => {
          const adIns = ad.insights.data[0];
          const adConversas = findByPrio(adIns.actions || []);
          const adCusto = findByPrio(adIns.cost_per_action_type || []);
          return {
            name: ad.name,
            conversas: parseInt(String(adConversas)),
            custo: parseFloat(String(adCusto)),
            spend: parseFloat(adIns.spend || 0),
          };
        })
        .sort((a: any, b: any) => b.conversas - a.conversas)
        .slice(0, 3);

      if (ads.length > 0) {
        const medals = ["🥇", "🥈", "🥉"];
        top3Text = ads.map((ad: any, i: number) =>
          `${medals[i]} *${ad.name}*\n   Conversas: ${ad.conversas} | Custo: ${formatMoney(ad.custo)} | Investido: ${formatMoney(ad.spend)}`
        ).join("\n\n");
      } else {
        top3Text = "_Sem dados de criativos no período_";
      }
    } catch {
      top3Text = "_Não foi possível carregar criativos_";
    }

    // Montar mensagem a partir do template
    const nomeCliente = rel.nome_cliente || "";
    const primeiroNome = nomeCliente.trim().split(/\s+/)[0] || nomeCliente;
    let mensagem = (rel.template || "").split("<PRIMEIRO_NOME>").join(primeiroNome);
    const replacements: Record<string, string> = {
      "<CA>": nomeCliente,
      "<DATA>": periodoFormatado,
      "<IMP>": formatNum(impressions),
      "<ALCAN>": formatNum(reach),
      "<CLIQ>": formatNum(clicks),
      "<FREQUENCIA>": formatNum(frequency),
      "<CTR>": formatPercent(ctr),
      "<CPM>": formatMoney(cpm),
      "<ALL_LEADS>": formatNum(conversas),
      "<ALL_LEADS_COST>": formatMoney(custoConversa),
      "<CONV_MSG_CLICK>": formatPercent(convClickMsg),
      "{{top_3_creatives_ranking}}": top3Text,
      "<INV>": formatMoney(spend),
      "<SALDO>": formatMoney(balance),
      "<LINK_DASH>": `${process.env.NEXT_PUBLIC_APP_URL || "https://salxconvert-blond.vercel.app"}/relatorio?id=${relatorio_id}`,
    };

    for (const [key, value] of Object.entries(replacements)) {
      mensagem = mensagem.replaceAll(key, value);
    }
    // Se é preview, retorna mensagem sem enviar
    if (preview) {
      return NextResponse.json({ mensagem, dados: { impressions, reach, clicks, ctr, cpm, spend, conversas, custoConversa, balance } });
    }

    // Determinar qual instância WhatsApp usar
    let evoUrl = ag.evolution_url;
    let evoKey = ag.evolution_key;
    let evoInst = ag.whatsapp_instancia;
    let cloudInst: any = null;

    // Se relatório tem instância específica, usar ela
    if (rel.whatsapp_instancia_id) {
      const { data: waInst } = await supabase.from("whatsapp_instancias")
        .select("instancia, tipo, evolution_url, evolution_key, cloud_phone_id, cloud_token")
        .eq("id", rel.whatsapp_instancia_id).single();
      if (waInst) {
        if (waInst.tipo === "cloud") {
          cloudInst = waInst;
        } else {
          evoInst = waInst.instancia;
          if (waInst.evolution_url) evoUrl = waInst.evolution_url;
          if (waInst.evolution_key) evoKey = waInst.evolution_key;
        }
      }
    }

    const destino = rel.grupo_id || rel.contato_numero;
    if (!destino) {
      return NextResponse.json({ error: "Destinatário não configurado", mensagem }, { status: 400 });
    }

    // Enviar via Cloud API ou Evolution
    if (cloudInst) {
      // WhatsApp Cloud API
      const numeroLimpo = destino.replace(/\D/g, "");
      const cloudRes = await fetch(`https://graph.facebook.com/v21.0/${cloudInst.cloud_phone_id}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cloudInst.cloud_token}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: numeroLimpo,
          type: "text",
          text: { body: mensagem },
        }),
      });
      const cloudData = await cloudRes.json();
      if (cloudData.error) {
        return NextResponse.json({ error: `Erro Cloud API: ${cloudData.error.message}`, mensagem }, { status: 500 });
      }
    } else {
      // Evolution API (fallback)
      if (!evoUrl || !evoKey || !evoInst) {
        return NextResponse.json({ error: "WhatsApp não configurado", mensagem }, { status: 400 });
      }
      const evoRes = await fetch(
        `${evoUrl}/message/sendText/${evoInst}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: evoKey },
          body: JSON.stringify({ number: destino, text: mensagem }),
        }
      );
      if (!evoRes.ok) {
        const evoErr = await evoRes.text();
        return NextResponse.json({ error: `Erro ao enviar: ${evoErr}`, mensagem }, { status: 500 });
      }
    }

    // Registrar envio
    await supabase.from("relatorios").update({
      ultimo_envio: new Date().toISOString(),
    }).eq("id", relatorio_id);

    return NextResponse.json({ success: true, mensagem });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erro interno" }, { status: 500 });
  }
}
