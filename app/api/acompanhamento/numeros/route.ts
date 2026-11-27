import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
const META_API = "https://graph.facebook.com/v21.0";
export const maxDuration = 60;

const TIPOS_MSG = ["onsite_conversion.messaging_conversation_started_7d", "onsite_conversion.total_messaging_connection", "onsite_conversion.messaging_first_reply"];
const TIPOS_LEAD = ["offsite_conversion.fb_pixel_lead", "lead", "onsite_conversion.lead_grouped", "leadgen_grouped"];
function contar(actions: any[], tipos: string[]) {
  if (!Array.isArray(actions)) return 0;
  for (const t of tipos) { const f = actions.find((a: any) => a.action_type === t); if (f) return parseInt(f.value || "0"); }
  return 0;
}
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Números dos últimos 28 dias e dos 28 anteriores: Meta (investimento, mensagens, leads) + planilha (agendamentos, comparecimentos, vendas, faturamento). */
async function calcular(relatorio_ids: string[], hoje: string, de?: string | null, ate?: string | null) {
  // Período escolhido na ficha (de/ate) ou, por padrão, os últimos 28 dias. O "anterior" tem o mesmo tamanho.
  const fim = new Date((ate || hoje) + "T12:00:00");
  const iniAtual = de ? new Date(de + "T12:00:00") : new Date(fim);
  if (!de) iniAtual.setDate(iniAtual.getDate() - 27);
  const dias = Math.round((+fim - +iniAtual) / 864e5);
  const fimAnt = new Date(iniAtual); fimAnt.setDate(fimAnt.getDate() - 1);
  const iniAnt = new Date(fimAnt); iniAnt.setDate(iniAnt.getDate() - dias);
  const janelas = { atual: [iso(iniAtual), iso(fim)], anterior: [iso(iniAnt), iso(fimAnt)] } as const;

  const [{ data: rels }, { data: plan }] = await Promise.all([
    supabase.from("relatorios").select("id, ad_account_id, meta_token, agencia_id").in("id", relatorio_ids),
    supabase.from("performance_semanal").select("relatorio_id, semana_inicio, agendamentos, comparecimentos, vendas, faturamento")
      .in("relatorio_id", relatorio_ids).gte("semana_inicio", janelas.anterior[0]).lte("semana_inicio", janelas.atual[1]),
  ]);
  const agencias = Array.from(new Set((rels || []).map((r: any) => r.agencia_id)));
  const tokens: Record<string, string> = {};
  if (agencias.length) {
    const { data: cons } = await supabase.from("relatorios_conexoes").select("agencia_id, meta_token").in("agencia_id", agencias).order("created_at", { ascending: false });
    (cons || []).forEach((c: any) => { if (!tokens[c.agencia_id] && c.meta_token) tokens[c.agencia_id] = c.meta_token; });
  }

  const out: Record<string, any> = {};
  await Promise.all((rels || []).map(async (rel: any) => {
    const token = rel.meta_token || tokens[rel.agencia_id];
    const acId = rel.ad_account_id ? (String(rel.ad_account_id).startsWith("act_") ? rel.ad_account_id : `act_${rel.ad_account_id}`) : null;
    const res: any = { meta_ok: false };
    for (const [nome, [de, ate]] of Object.entries(janelas)) {
      const linhas = (plan || []).filter((p: any) => p.relatorio_id === rel.id && p.semana_inicio >= de && p.semana_inicio <= ate);
      const n = {
        investimento: 0, mensagens: 0, leads: 0, contatos: 0,
        agendamentos: linhas.reduce((s: number, l: any) => s + (Number(l.agendamentos) || 0), 0),
        comparecimentos: linhas.reduce((s: number, l: any) => s + (Number(l.comparecimentos) || 0), 0),
        vendas: linhas.reduce((s: number, l: any) => s + (Number(l.vendas) || 0), 0),
        faturamento: linhas.reduce((s: number, l: any) => s + (Number(l.faturamento) || 0), 0),
        semanas: linhas.length,
      };
      if (token && acId) {
        try {
          const r = await fetch(`${META_API}/${acId}/insights?fields=spend,actions&time_range=${encodeURIComponent(JSON.stringify({ since: de, until: ate }))}`,
            { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(9000) });
          if (r.ok) {
            const ins = (await r.json())?.data?.[0];
            n.investimento = parseFloat(ins?.spend || "0") || 0;
            n.mensagens = contar(ins?.actions, TIPOS_MSG);
            n.leads = contar(ins?.actions, TIPOS_LEAD);
            res.meta_ok = true;
          }
        } catch { /* sem Meta nessa janela */ }
      }
      n.contatos = n.mensagens > 0 ? n.mensagens : n.leads;
      res[nome] = n;
    }
    res.tipo_contato = res.atual.mensagens > 0 ? "mensagem" : res.atual.leads > 0 ? "lead" : null;
    out[rel.id] = res;
  }));
  return out;
}
const calcularCache = unstable_cache(calcular, ["acompanhamento-numeros-v1"], { revalidate: 3600 });

export async function POST(req: NextRequest) {
  try {
    const { relatorio_ids, de, ate } = await req.json();
    if (!Array.isArray(relatorio_ids) || !relatorio_ids.length) return NextResponse.json({});
    const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    const data = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
    const d1 = data(de), d2 = data(ate);
    if (d1 && d2 && d1 <= d2) return NextResponse.json(await calcularCache([...relatorio_ids].sort(), hoje, d1, d2));
    return NextResponse.json(await calcularCache([...relatorio_ids].sort(), hoje));
  } catch (e: any) {
    console.error("[acompanhamento/numeros]", e?.message);
    return NextResponse.json({});
  }
}
