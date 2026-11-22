import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const META_API = "https://graph.facebook.com/v21.0";

function gerarSemanas(desde: string, ate: string) {
  const semanas: { inicio: string; fim: string }[] = [];
  const end = new Date(ate + "T12:00:00");
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  let semInicio = new Date(desde + "T12:00:00");
  while (semInicio <= end) {
    const semFim = new Date(semInicio);
    semFim.setDate(semFim.getDate() + (6 - semFim.getDay()));
    const fimReal = semFim > end ? end : semFim;
    semanas.push({ inicio: fmt(semInicio), fim: fmt(fimReal) });
    semInicio = new Date(fimReal);
    semInicio.setDate(semInicio.getDate() + 1);
    if (semInicio.getDay() !== 0) semInicio.setDate(semInicio.getDate() + (7 - semInicio.getDay()));
  }
  return semanas;
}

function gerarMeses(desde: string, ate: string) {
  const meses: { inicio: string; fim: string }[] = [];
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const end = new Date(ate + "T12:00:00");
  let cur = new Date(desde + "T12:00:00");
  cur = new Date(cur.getFullYear(), cur.getMonth(), 1);
  while (cur <= end) {
    const inicio = new Date(cur);
    const fim = new Date(cur.getFullYear(), cur.getMonth() + 1, 0); // último dia do mês
    const fimReal = fim > end ? end : fim;
    if (new Date(desde + "T12:00:00") > inicio) {
      meses.push({ inicio: desde, fim: fmt(fimReal) });
    } else {
      meses.push({ inicio: fmt(inicio), fim: fmt(fimReal) });
    }
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  return meses;
}

function extractMensagens(actions: any[]): number {
  if (!Array.isArray(actions)) return 0;
  const prioridade = [
    "onsite_conversion.messaging_conversation_started_7d",
    "onsite_conversion.total_messaging_connection",
    "onsite_conversion.messaging_first_reply",
    "offsite_conversion.fb_pixel_schedule",
    "offsite_conversion.fb_pixel_lead",
    "lead",
  ];
  for (const tipo of prioridade) {
    const found = actions.find((a: any) => a.action_type === tipo);
    if (found) return parseInt(found.value || "0");
  }
  return 0;
}

async function metaInsights(url: string, token: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return { data: [] };
  return res.json();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, agencia_id } = body;
    if (!agencia_id) return NextResponse.json({ error: "agencia_id obrigatório" }, { status: 400 });

    // ── CARREGAR ─────────────────────────────────────────────────────────────
    if (action === "carregar") {
      const { date_from, date_to } = body;
      const hoje = new Date().toISOString().split("T")[0];
      const primeiroDiaMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
      const desde = date_from || primeiroDiaMes;
      const ate = date_to || hoje;

      const { data: ag } = await supabase.from("agencias")
        .select("meta_business_token, meta_ad_account_id, meta_ads_ativo, nome")
        .eq("id", agencia_id).single();

      const token = ag?.meta_business_token;
      const acId = ag?.meta_ad_account_id
        ? (ag.meta_ad_account_id.startsWith("act_") ? ag.meta_ad_account_id : `act_${ag.meta_ad_account_id}`)
        : null;

      const diasPeriodo = (new Date(ate).getTime() - new Date(desde).getTime()) / 86400000;
      const agruparPorMes = diasPeriodo > 60;
      const semanas = agruparPorMes ? gerarMeses(desde, ate) : gerarSemanas(desde, ate);

      // Buscar dados em paralelo
      const [manuaisResult, contatosResult, historicoAgendResult] = await Promise.all([
        supabase.from("performance_semanal")
          .select("*").eq("agencia_id", agencia_id)
          .gte("semana_inicio", desde).lte("semana_inicio", ate),

        supabase.from("conversas")
          .select("id, created_at, primeira_mensagem_at, utm_campaign, utm_content")
          .eq("agencia_id", agencia_id)
          .gte("created_at", desde + "T00:00:00")
          .lte("created_at", ate + "T23:59:59"),

        // Agendamentos via etapas_historico: exclui entradas retroativas (migration em massa)
        supabase.from("etapas_historico")
          .select("conversa_id, created_at")
          .eq("agencia_id", agencia_id)
          .ilike("etapa_nova", "%agend%")
          .neq("alterado_por", "retroativo")
          .gte("created_at", desde + "T00:00:00")
          .lte("created_at", ate + "T23:59:59"),
      ]);

      const manuais = manuaisResult.data || [];
      const contatos = contatosResult.data || [];

      // Buscar dados das conversas do historico para filtrar por origem Meta
      const historicoRows = historicoAgendResult.data || [];
      const conversaIds = [...new Set(historicoRows.map(h => h.conversa_id))];
      let conversasMeta: any[] = [];
      if (conversaIds.length > 0) {
        const { data: convData } = await supabase.from("conversas")
          .select("id, utm_campaign, utm_content, origem")
          .in("id", conversaIds)
          .in("origem", ["Meta Ads", "Formulário Meta"]);
        conversasMeta = convData || [];
      }
      const conversaMetaMap = new Map(conversasMeta.map(c => [c.id, c]));

      // Desduplicar por conversa_id (pegar primeira ocorrência no período)
      const agendMap = new Map<string, any>();
      for (const h of historicoRows) {
        if (!conversaMetaMap.has(h.conversa_id)) continue; // não é do Meta
        if (!agendMap.has(h.conversa_id)) {
          const conv = conversaMetaMap.get(h.conversa_id);
          agendMap.set(h.conversa_id, { ...conv, historico_at: h.created_at });
        }
      }
      const agendamentos = Array.from(agendMap.values());

      // Meta por semana
      const metaResultados = await Promise.all(
        semanas.map(async (sem) => {
          if (!token || !acId) return { mensagens: 0, investimento: 0 };
          try {
            const timeRange = encodeURIComponent(`{"since":"${sem.inicio}","until":"${sem.fim}"}`);
            const data = await metaInsights(
              `${META_API}/${acId}/insights?fields=spend,actions&time_range=${timeRange}`,
              token
            );
            const ins = data.data?.[0];
            if (ins) return { mensagens: extractMensagens(ins.actions), investimento: parseFloat(ins.spend || "0") };
          } catch {}
          return { mensagens: 0, investimento: 0 };
        })
      );

      // Meta: campanhas + conjuntos em paralelo
      let campanhas: any[] = [];
      let conjuntos: any[] = [];
      if (token && acId) {
        const timeRange = encodeURIComponent(`{"since":"${desde}","until":"${ate}"}`);
        const fields = "spend,impressions,clicks,ctr,actions";

        const [campRes, conjRes] = await Promise.all([
          metaInsights(
            `${META_API}/${acId}/insights?fields=campaign_id,campaign_name,${fields}&level=campaign&time_range=${timeRange}&limit=30`,
            token
          ),
          metaInsights(
            `${META_API}/${acId}/insights?fields=adset_id,adset_name,campaign_name,${fields}&level=adset&time_range=${timeRange}&limit=50`,
            token
          ),
        ]);

        campanhas = (campRes.data || [])
          .filter((c: any) => parseFloat(c.spend || "0") > 0)
          .map((c: any) => ({
            id: c.campaign_id,
            nome: c.campaign_name,
            investimento: parseFloat(c.spend || "0"),
            impressoes: parseInt(c.impressions || "0"),
            cliques: parseInt(c.clicks || "0"),
            ctr: parseFloat(c.ctr || "0"),
            mensagens: extractMensagens(c.actions || []),
            // Agendamentos desta campanha via utm_campaign
            agendamentos: agendamentos.filter(a =>
              a.utm_campaign && c.campaign_name &&
              a.utm_campaign.toLowerCase().includes(c.campaign_name.toLowerCase().slice(0, 15))
            ).length,
          }));

        conjuntos = (conjRes.data || [])
          .filter((c: any) => parseFloat(c.spend || "0") > 0)
          .map((c: any) => ({
            id: c.adset_id,
            nome: c.adset_name,
            campanha: c.campaign_name,
            investimento: parseFloat(c.spend || "0"),
            impressoes: parseInt(c.impressions || "0"),
            cliques: parseInt(c.clicks || "0"),
            ctr: parseFloat(c.ctr || "0"),
            mensagens: extractMensagens(c.actions || []),
            // Agendamentos deste conjunto via utm_content
            agendamentos: agendamentos.filter(a =>
              a.utm_content && c.adset_name &&
              a.utm_content.toLowerCase().includes(c.adset_name.toLowerCase().slice(0, 15))
            ).length,
          }));
      }

      // Montar resultado por semana
      const resultado = semanas.map((sem, i) => {
        const manual = manuais.find(m => (m.semana_inicio || "").split("T")[0] === sem.inicio);
        const meta = metaResultados[i];
        const contatosSemana = contatos.filter(c => {
          const d = (c.primeira_mensagem_at || c.created_at || "").split("T")[0];
          return d >= sem.inicio && d <= sem.fim;
        }).length;
        const agendSemana = agendamentos.filter(c => {
          // historico_at = data real da mudança de etapa para "Agendou" (excluindo retroativos)
          const d = (c.historico_at || "").split("T")[0];
          return d >= sem.inicio && d <= sem.fim;
        }).length;
        return {
          semana_inicio: sem.inicio,
          semana_fim: sem.fim,
          mensagens: meta.mensagens || 0,
          investimento: meta.investimento || 0,
          contatos: contatosSemana,
          agendamentos: agendSemana,
          comparecimentos: manual?.comparecimentos ?? 0,
          vendas: manual?.vendas ?? 0,
          valor_vendas: manual?.valor_vendas ?? 0,
          id: manual?.id || null,
        };
      });

      return NextResponse.json({
        semanas: resultado,
        campanhas,
        conjuntos,
        nomeAgencia: ag?.nome || "",
        temMeta: !!(token && acId && ag?.meta_ads_ativo),
        agruparPorMes,
        periodo: { desde, ate },
      });
    }

    // ── SALVAR ────────────────────────────────────────────────────────────────
    if (action === "salvar") {
      const { semanas } = body;
      if (!semanas) return NextResponse.json({ error: "semanas obrigatório" }, { status: 400 });
      await supabase.from("performance_semanal").upsert(
        semanas.map((sem: any) => ({
          agencia_id,
          semana_inicio: sem.semana_inicio,
          semana_fim: sem.semana_fim,
          agendamentos: sem.agendamentos || 0,
          comparecimentos: sem.comparecimentos || 0,
          vendas: sem.vendas || 0,
          valor_vendas: sem.valor_vendas || 0,
          mensagens: sem.mensagens || 0,
          investimento: sem.investimento || 0,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "agencia_id,semana_inicio" }
      );
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "action inválida" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
