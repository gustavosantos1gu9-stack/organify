import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { classificar, minutosComerciais, mediana, LOTE_MINIMO, TAXA_QUALIFICADO, Msg } from "@/lib/qualidade-publicos";

// Contatos reais × Meta e qualidade dos públicos (conjuntos), só para leads do Meta (CTWA).
// Regras em lib/qualidade-publicos.ts.

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
const META_API = "https://graph.facebook.com/v21.0";

function msgsMeta(actions: any[]): number {
  if (!Array.isArray(actions)) return 0;
  const f = actions.find((a: any) => a.action_type === "onsite_conversion.messaging_conversation_started_7d");
  return f ? parseInt(f.value || "0") : 0;
}

// Datas do período em horário de Brasília → instantes UTC
const inicioBRT = (d: string) => new Date(`${d}T03:00:00.000Z`).toISOString();
const fimBRT = (d: string) => new Date(new Date(`${d}T03:00:00.000Z`).getTime() + 86400000).toISOString();

type Linha = {
  conjunto_id: string | null; conjunto: string; campanha: string;
  investimento: number; mensagens_meta: number;
  contatos_reais: number; desenvolveram: number; nao_desenvolveram: number; aberto: number; sem_resposta: number;
  tempos: number[]; por_ia: number; respondidas: number;
};

// GET ?agencia_id=&date_from=&date_to= (mesmo cálculo; usado para conferência)
export async function GET(req: NextRequest) {
  const p = new URL(req.url).searchParams;
  return calcular(p.get("agencia_id"), p.get("date_from"), p.get("date_to"));
}

export async function POST(req: NextRequest) {
  const { agencia_id, date_from, date_to } = await req.json().catch(() => ({}));
  return calcular(agencia_id, date_from, date_to);
}

async function calcular(agencia_id: string | null, date_from: string | null, date_to: string | null) {
  try {
    if (!agencia_id || !date_from || !date_to) return NextResponse.json({ error: "agencia_id, date_from e date_to obrigatórios" }, { status: 400 });

    const { data: ag } = await supabase.from("agencias")
      .select("meta_business_token, meta_ad_account_id").eq("id", agencia_id).single();
    const token = (ag as any)?.meta_business_token;
    const acId = (ag as any)?.meta_ad_account_id
      ? ((ag as any).meta_ad_account_id.startsWith("act_") ? (ag as any).meta_ad_account_id : `act_${(ag as any).meta_ad_account_id}`)
      : null;

    // 1. Meta: conjuntos do período (ID, nome, campanha, investimento, mensagens)
    const conjuntosMeta: { id: string; nome: string; campanha: string; investimento: number; mensagens: number }[] = [];
    let metaOk = false;
    if (token && acId) {
      const tr = encodeURIComponent(JSON.stringify({ since: date_from, until: date_to }));
      let url: string | null = `${META_API}/${acId}/insights?fields=adset_id,adset_name,campaign_name,spend,actions&level=adset&time_range=${tr}&limit=100`;
      for (let i = 0; url && i < 5; i++) {
        const r: Response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(12000) }).catch(() => null as any);
        if (!r || !r.ok) break;
        const j = await r.json();
        metaOk = true;
        for (const c of j.data || []) conjuntosMeta.push({
          id: c.adset_id, nome: c.adset_name || "", campanha: c.campaign_name || "",
          investimento: parseFloat(c.spend || "0"), mensagens: msgsMeta(c.actions || []),
        });
        url = j.paging?.next || null;
      }
    }

    // 2. Conversas de anúncio (CTWA) com primeira mensagem no período
    const convs: any[] = [];
    for (let de = 0; de < 20000; de += 1000) {
      const { data } = await supabase.from("conversas")
        .select("id, primeira_mensagem_at, created_at, utm_campaign, utm_content, nome_anuncio, meta_adset_id")
        .eq("agencia_id", agencia_id).ilike("origem", "meta ads%")
        .gte("primeira_mensagem_at", inicioBRT(date_from)).lt("primeira_mensagem_at", fimBRT(date_to))
        .range(de, de + 999);
      convs.push(...(data || []));
      if (!data || data.length < 1000) break;
    }

    // 3. Ligar cada conversa ao conjunto: pelo ID; sem ID, só por nome EXATO e único
    const porId = new Map(conjuntosMeta.map(c => [c.id, c]));
    const porNome = new Map<string, string[]>(); // "campanha||conjunto" → ids
    for (const c of conjuntosMeta) {
      const k = `${c.campanha}||${c.nome}`;
      porNome.set(k, [...(porNome.get(k) || []), c.id]);
    }
    const aGravar: { id: string; meta_adset_id: string }[] = [];
    const conjuntoDa = new Map<string, string | null>();
    for (const c of convs) {
      if (c.meta_adset_id) { conjuntoDa.set(c.id, c.meta_adset_id); continue; }
      // utm_content guardado como "conjunto_criativo" (ou só "conjunto")
      let nomeConj: string | null = null;
      if (c.utm_content && c.nome_anuncio && c.utm_content.endsWith(`_${c.nome_anuncio}`)) nomeConj = c.utm_content.slice(0, -(c.nome_anuncio.length + 1));
      else if (c.utm_content) nomeConj = c.utm_content;
      let ids = nomeConj && c.utm_campaign ? porNome.get(`${c.utm_campaign}||${nomeConj}`) : undefined;
      // Sem o nome do anúncio guardado: "conjunto_anúncio" começa EXATAMENTE com "<nome do conjunto>_"
      if (!ids?.length && c.utm_content && c.utm_campaign) {
        const cand = conjuntosMeta.filter(x => x.campanha === c.utm_campaign && x.nome && c.utm_content.startsWith(`${x.nome}_`));
        if (cand.length) ids = cand.map(x => x.id);
      }
      // Só liga quando há UM conjunto possível; dois candidatos = não identificado (não chuta)
      if (ids && ids.length === 1) { conjuntoDa.set(c.id, ids[0]); aGravar.push({ id: c.id, meta_adset_id: ids[0] }); }
      else conjuntoDa.set(c.id, null);
    }
    // grava os IDs descobertos (próxima vez já vem pelo ID)
    for (const g of aGravar.slice(0, 300)) await supabase.from("conversas").update({ meta_adset_id: g.meta_adset_id }).eq("id", g.id).is("meta_adset_id", null);

    // 4. Mensagens das conversas
    const msgs = new Map<string, Msg[]>();
    const ids = convs.map(c => c.id);
    for (let i = 0; i < ids.length; i += 150) {
      const { data } = await supabase.from("mensagens")
        .select("conversa_id, de_mim, created_at, enviada_por_ia").in("conversa_id", ids.slice(i, i + 150)).limit(20000);
      for (const m of data || []) {
        const l = msgs.get(m.conversa_id) || []; l.push(m); msgs.set(m.conversa_id, l);
      }
    }

    // 5. Classificar e somar por conjunto
    const linhas = new Map<string, Linha>();
    const linha = (key: string, base: Partial<Linha>): Linha => {
      if (!linhas.has(key)) linhas.set(key, {
        conjunto_id: null, conjunto: "", campanha: "", investimento: 0, mensagens_meta: 0,
        contatos_reais: 0, desenvolveram: 0, nao_desenvolveram: 0, aberto: 0, sem_resposta: 0,
        tempos: [], por_ia: 0, respondidas: 0, ...base,
      });
      return linhas.get(key)!;
    };
    for (const c of conjuntosMeta) linha(c.id, { conjunto_id: c.id, conjunto: c.nome, campanha: c.campanha, investimento: c.investimento, mensagens_meta: c.mensagens });

    const agora = new Date();
    for (const c of convs) {
      const cid = conjuntoDa.get(c.id);
      const l = cid ? linha(cid, { conjunto_id: cid, conjunto: porId.get(cid)?.nome || "(conjunto fora do período)", campanha: porId.get(cid)?.campanha || "" })
        : linha("_sem", { conjunto: "Não identificado", campanha: "" });
      l.contatos_reais++;
      const r = classificar(msgs.get(c.id) || [], c.primeira_mensagem_at, agora);
      if (r.classe === "desenvolveu") l.desenvolveram++;
      else if (r.classe === "nao_desenvolveu") l.nao_desenvolveram++;
      else if (r.classe === "sem_resposta") l.sem_resposta++;
      else l.aberto++;
      // Tempo de resposta: fora o histórico importado (a conversa entrou no sistema bem depois da 1ª mensagem)
      const importada = new Date(c.created_at).getTime() - new Date(c.primeira_mensagem_at).getTime() > 60 * 60000;
      if (!importada && r.inicio && r.primeiraResposta) {
        l.tempos.push(minutosComerciais(r.inicio, r.primeiraResposta));
        l.respondidas++;
        if (r.respondidaPorIA) l.por_ia++;
      }
    }

    // 6. Indicadores
    const fechar = (l: Linha) => {
      const fechados = l.desenvolveram + l.nao_desenvolveram;
      const taxa = fechados ? l.desenvolveram / fechados : null;
      return {
        conjunto_id: l.conjunto_id, conjunto: l.conjunto, campanha: l.campanha,
        investimento: Math.round(l.investimento * 100) / 100,
        mensagens_meta: l.mensagens_meta, contatos_reais: l.contatos_reais,
        entrega: l.mensagens_meta ? l.contatos_reais / l.mensagens_meta : null,
        custo_mensagem_meta: l.mensagens_meta ? l.investimento / l.mensagens_meta : null,
        custo_contato_real: l.contatos_reais ? l.investimento / l.contatos_reais : null,
        desenvolveram: l.desenvolveram, nao_desenvolveram: l.nao_desenvolveram, aberto: l.aberto, sem_resposta: l.sem_resposta,
        taxa_qualificacao: taxa,
        custo_conversa_desenvolvida: l.desenvolveram ? l.investimento / l.desenvolveram : null,
        status: fechados < LOTE_MINIMO ? "aguardando" : (taxa! >= TAXA_QUALIFICADO ? "qualificado" : "desqualificado"),
        fechados,
        tempo_resposta_mediana_min: mediana(l.tempos),
        respondidas_ate_5min: l.tempos.length ? l.tempos.filter(t => t <= 5).length / l.tempos.length : null,
        respondidas_ate_15min: l.tempos.length ? l.tempos.filter(t => t <= 15).length / l.tempos.length : null,
        respondidas_ate_60min: l.tempos.length ? l.tempos.filter(t => t <= 60).length / l.tempos.length : null,
        pct_resposta_ia: l.respondidas ? l.por_ia / l.respondidas : null,
      };
    };
    const lista = [...linhas.values()].filter(l => l.contatos_reais > 0 || l.mensagens_meta > 0);
    const total: Linha = lista.reduce((t, l) => ({
      ...t, investimento: t.investimento + l.investimento, mensagens_meta: t.mensagens_meta + l.mensagens_meta,
      contatos_reais: t.contatos_reais + l.contatos_reais, desenvolveram: t.desenvolveram + l.desenvolveram,
      nao_desenvolveram: t.nao_desenvolveram + l.nao_desenvolveram, aberto: t.aberto + l.aberto, sem_resposta: t.sem_resposta + l.sem_resposta,
      tempos: [...t.tempos, ...l.tempos], por_ia: t.por_ia + l.por_ia, respondidas: t.respondidas + l.respondidas,
    }), { conjunto_id: null, conjunto: "Total", campanha: "", investimento: 0, mensagens_meta: 0, contatos_reais: 0, desenvolveram: 0, nao_desenvolveram: 0, aberto: 0, sem_resposta: 0, tempos: [], por_ia: 0, respondidas: 0 });

    return NextResponse.json({
      meta_ok: metaOk,
      total: fechar(total),
      conjuntos: lista.map(fechar).sort((a, b) => b.contatos_reais - a.contatos_reais || b.investimento - a.investimento),
      regras: { lote_minimo: LOTE_MINIMO, taxa_qualificado: TAXA_QUALIFICADO, horario: "seg–sex, 9h–18h (Brasília)" },
    });
  } catch (e: any) {
    console.error("[performance/qualidade]", e?.message);
    return NextResponse.json({ error: "Não foi possível calcular agora." }, { status: 500 });
  }
}
