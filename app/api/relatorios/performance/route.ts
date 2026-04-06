import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const META_API = "https://graph.facebook.com/v21.0";

async function metaFetch(url: string, token: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return { data: [] };
  return res.json();
}

// Gerar semanas dom-sáb. Primeira semana: dia 1 até primeiro sábado.
function gerarSemanas(desde: string, ate: string): { inicio: string; fim: string }[] {
  const semanas: { inicio: string; fim: string }[] = [];
  const start = new Date(desde + "T12:00:00");
  const end = new Date(ate + "T12:00:00");
  const fmt = (d: Date) => d.toISOString().split("T")[0];

  // Começar do dia 1 do mês
  const primeiroDia = new Date(start.getFullYear(), start.getMonth(), 1);

  // Primeira semana: dia 1 até o primeiro sábado
  const primSab = new Date(primeiroDia);
  const dow = primSab.getDay(); // 0=dom, 6=sab
  if (dow !== 6) {
    primSab.setDate(primSab.getDate() + (6 - dow));
  }
  const ultimoDiaMes = new Date(primeiroDia.getFullYear(), primeiroDia.getMonth() + 1, 0);

  // Semana 1: dia 1 → primeiro sábado (ou fim do mês se for antes)
  const fimSem1 = primSab > ultimoDiaMes ? ultimoDiaMes : primSab;
  if (fimSem1 >= start && primeiroDia <= end) {
    semanas.push({
      inicio: fmt(primeiroDia < start ? start : primeiroDia),
      fim: fmt(fimSem1 > end ? end : fimSem1),
    });
  }

  // Semanas seguintes: dom-sáb
  const cursor = new Date(fimSem1);
  cursor.setDate(cursor.getDate() + 1); // próximo domingo

  while (cursor <= end && cursor <= ultimoDiaMes) {
    const semInicio = new Date(cursor);
    const semFim = new Date(cursor);
    semFim.setDate(semFim.getDate() + 6); // sábado

    // Não passar do último dia do mês
    if (semFim > ultimoDiaMes) semFim.setTime(ultimoDiaMes.getTime());
    // Não passar do end
    const fimReal = semFim > end ? end : semFim;

    if (semInicio <= end) {
      semanas.push({ inicio: fmt(semInicio), fim: fmt(fimReal) });
    }

    cursor.setDate(cursor.getDate() + 7);
  }

  return semanas;
}

function extractMensagens(actions: any[]): number {
  if (!Array.isArray(actions)) return 0;
  const found = actions.find((a: any) =>
    a.action_type === "onsite_conversion.messaging_conversation_started_7d" ||
    a.action_type === "offsite_conversion.fb_pixel_lead" ||
    a.action_type === "lead"
  );
  return found ? parseInt(found.value || "0") : 0;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // ─── GET: carregar dados das semanas ───
    if (action === "carregar") {
      const { relatorio_id, date_from, date_to } = body;

      if (!relatorio_id) {
        return NextResponse.json({ error: "relatorio_id obrigatório" }, { status: 400 });
      }

      // Buscar relatório
      const { data: rel } = await supabase.from("relatorios")
        .select("*").eq("id", relatorio_id).single();
      if (!rel) return NextResponse.json({ error: "Relatório não encontrado" }, { status: 404 });

      // Token
      const { data: con } = await supabase.from("relatorios_conexoes")
        .select("meta_token").eq("agencia_id", rel.agencia_id)
        .order("created_at", { ascending: false }).limit(1).single();
      const token = rel.meta_token || con?.meta_token;

      // Datas
      const desde = date_from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
      const ate = date_to || new Date().toISOString().split("T")[0];
      const semanas = gerarSemanas(desde, ate);
      const acId = rel.ad_account_id.startsWith("act_") ? rel.ad_account_id : `act_${rel.ad_account_id}`;

      // Buscar dados manuais salvos
      const { data: manuais } = await supabase.from("performance_semanal")
        .select("*")
        .eq("relatorio_id", relatorio_id)
        .gte("semana_inicio", desde)
        .lte("semana_inicio", ate);

      // Tudo manual — dados de agendamentos/comparecimentos/vendas preenchidos pelo usuário
      const resultado = [];
      for (const sem of semanas) {
        const manual = manuais?.find(m => m.semana_inicio === sem.inicio);

        // Meta API: mensagens e investimento da semana
        let metaMensagens = 0;
        let metaInvestimento = 0;
        if (token) {
          try {
            const timeRange = `{"since":"${sem.inicio}","until":"${sem.fim}"}`;
            const insRes = await metaFetch(
              `${META_API}/${acId}/insights?fields=spend,actions&time_range=${timeRange}`,
              token
            );
            const ins = insRes.data?.[0];
            if (ins) {
              metaMensagens = extractMensagens(ins.actions);
              metaInvestimento = parseFloat(ins.spend || "0");
            }
          } catch {}
        }

        resultado.push({
          semana_inicio: sem.inicio,
          semana_fim: sem.fim,
          mensagens: manual?.mensagens ?? metaMensagens,
          investimento: manual?.investimento ?? metaInvestimento,
          agendamentos: manual?.agendamentos ?? 0,
          comparecimentos: manual?.comparecimentos ?? 0,
          vendas: manual?.vendas ?? 0,
          modo: "manual",
          id: manual?.id || null,
        });
      }

      return NextResponse.json({
        semanas: resultado,
        temWhatsApp: false,
        nomeCliente: rel.nome_cliente,
        periodo: { desde, ate },
      });
    }

    // ─── POST: salvar dados manuais ───
    if (action === "salvar") {
      const { relatorio_id, semanas } = body;
      let { agencia_id } = body;
      if (!relatorio_id || !semanas) {
        return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
      }
      // Resolver agencia_id do relatório
      if (!agencia_id || agencia_id === "auto") {
        const { data: rel } = await supabase.from("relatorios").select("agencia_id").eq("id", relatorio_id).single();
        agencia_id = rel?.agencia_id;
      }
      if (!agencia_id) return NextResponse.json({ error: "agencia_id não encontrado" }, { status: 400 });

      for (const sem of semanas) {
        await supabase.from("performance_semanal").upsert({
          agencia_id,
          relatorio_id,
          semana_inicio: sem.semana_inicio,
          semana_fim: sem.semana_fim,
          mensagens: sem.mensagens || 0,
          agendamentos: sem.agendamentos || 0,
          comparecimentos: sem.comparecimentos || 0,
          vendas: sem.vendas || 0,
          investimento: sem.investimento || 0,
          modo: sem.modo || "manual",
          updated_at: new Date().toISOString(),
        }, { onConflict: "agencia_id,relatorio_id,semana_inicio" });
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "action inválida" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
