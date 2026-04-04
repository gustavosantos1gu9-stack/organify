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

// Gerar semanas (seg-dom) que cobrem o período
function gerarSemanas(desde: string, ate: string): { inicio: string; fim: string }[] {
  const semanas: { inicio: string; fim: string }[] = [];
  const start = new Date(desde + "T12:00:00");
  const end = new Date(ate + "T12:00:00");

  // Ir pra segunda-feira anterior ou igual
  const dia = start.getDay();
  const diffSeg = dia === 0 ? -6 : 1 - dia;
  const seg = new Date(start);
  seg.setDate(seg.getDate() + diffSeg);

  while (seg <= end) {
    const dom = new Date(seg);
    dom.setDate(dom.getDate() + 6);
    const fmt = (d: Date) => d.toISOString().split("T")[0];
    semanas.push({ inicio: fmt(seg), fim: fmt(dom) });
    seg.setDate(seg.getDate() + 7);
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

      // Verificar se agência tem WhatsApp conectado (modo automático)
      const { data: agencia } = await supabase.from("agencias")
        .select("whatsapp_conectado, meta_business_token").eq("id", rel.agencia_id).single();
      const temWhatsApp = agencia?.whatsapp_conectado || false;

      // Buscar dados automáticos do etapas_historico (se tem WhatsApp)
      let historicoMap: Record<string, { agendamentos: number; comparecimentos: number; vendas: number }> = {};
      if (temWhatsApp) {
        const { data: historico } = await supabase.from("etapas_historico")
          .select("etapa_nova, created_at")
          .eq("agencia_id", rel.agencia_id)
          .gte("created_at", desde)
          .lte("created_at", ate + "T23:59:59");

        if (historico) {
          for (const h of historico) {
            const hDate = new Date(h.created_at);
            // Encontrar a semana correspondente
            for (const sem of semanas) {
              if (hDate >= new Date(sem.inicio + "T00:00:00") && hDate <= new Date(sem.fim + "T23:59:59")) {
                const key = sem.inicio;
                if (!historicoMap[key]) historicoMap[key] = { agendamentos: 0, comparecimentos: 0, vendas: 0 };
                if (/agend|reuni/i.test(h.etapa_nova)) historicoMap[key].agendamentos++;
                else if (/comparec|realiz/i.test(h.etapa_nova)) historicoMap[key].comparecimentos++;
                else if (/comprou|fechou|ganho|vend/i.test(h.etapa_nova)) historicoMap[key].vendas++;
                break;
              }
            }
          }
        }
      }

      // Buscar dados da Meta por semana (mensagens + investimento)
      const resultado = [];
      for (const sem of semanas) {
        const manual = manuais?.find(m => m.semana_inicio === sem.inicio);
        const autoHist = historicoMap[sem.inicio] || { agendamentos: 0, comparecimentos: 0, vendas: 0 };

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
          mensagens: metaMensagens,
          investimento: metaInvestimento,
          agendamentos: manual?.agendamentos ?? autoHist.agendamentos,
          comparecimentos: manual?.comparecimentos ?? autoHist.comparecimentos,
          vendas: manual?.vendas ?? autoHist.vendas,
          modo: temWhatsApp ? (manual ? "manual" : "auto") : "manual",
          id: manual?.id || null,
        });
      }

      return NextResponse.json({
        semanas: resultado,
        temWhatsApp,
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
