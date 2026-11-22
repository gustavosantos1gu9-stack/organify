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
  // Prioridade: conversas iniciadas (CTWA) > total_messaging_connection > lead
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

      // Buscar relatório e datas simultaneamente
      const { data: rel } = await supabase.from("relatorios")
        .select("*").eq("id", relatorio_id).single();
      if (!rel) return NextResponse.json({ error: "Relatório não encontrado" }, { status: 404 });

      const desde = date_from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
      const ate = date_to || new Date().toISOString().split("T")[0];
      const semanas = gerarSemanas(desde, ate);
      const acId = rel.ad_account_id.startsWith("act_") ? rel.ad_account_id : `act_${rel.ad_account_id}`;

      // Buscar token e dados manuais em paralelo
      const [conResult, manuaisResult] = await Promise.all([
        supabase.from("relatorios_conexoes")
          .select("meta_token").eq("agencia_id", rel.agencia_id)
          .order("created_at", { ascending: false }).limit(1).single(),
        supabase.from("performance_semanal")
          .select("*")
          .eq("relatorio_id", relatorio_id)
          .gte("semana_inicio", desde)
          .lte("semana_inicio", ate),
      ]);
      const token = rel.meta_token || conResult.data?.meta_token;
      const manuais = manuaisResult.data;

      // Buscar todas as semanas na Meta API em paralelo
      const metaResultados: { mensagens: number; investimento: number }[] = await Promise.all(
        semanas.map(async (sem) => {
          if (!token) return { mensagens: 0, investimento: 0 };
          try {
            const timeRange = `{"since":"${sem.inicio}","until":"${sem.fim}"}`;
            const insRes = await metaFetch(
              `${META_API}/${acId}/insights?fields=spend,actions&time_range=${timeRange}`,
              token
            );
            const ins = insRes.data?.[0];
            if (ins) {
              return { mensagens: extractMensagens(ins.actions), investimento: parseFloat(ins.spend || "0") };
            }
          } catch {}
          return { mensagens: 0, investimento: 0 };
        })
      );

      const resultado = semanas.map((sem, i) => {
        const manual = manuais?.find(m => (m.semana_inicio || "").split("T")[0] === sem.inicio);
        const meta = metaResultados[i];
        return {
          semana_inicio: sem.inicio,
          semana_fim: sem.fim,
          mensagens: manual?.mensagens ?? meta.mensagens,
          investimento: manual?.investimento ?? meta.investimento,
          agendamentos: manual?.agendamentos ?? 0,
          comparecimentos: manual?.comparecimentos ?? 0,
          vendas: manual?.vendas ?? 0,
          valor_vendas: manual?.valor_vendas ?? 0,
          faturamento: manual?.faturamento ?? 0,
          modo: "manual",
          id: manual?.id || null,
        };
      });

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

      await supabase.from("performance_semanal").upsert(
        semanas.map((sem: any) => ({
          agencia_id,
          relatorio_id,
          semana_inicio: sem.semana_inicio,
          semana_fim: sem.semana_fim,
          mensagens: sem.mensagens || 0,
          agendamentos: sem.agendamentos || 0,
          comparecimentos: sem.comparecimentos || 0,
          vendas: sem.vendas || 0,
          valor_vendas: sem.valor_vendas || 0,
          faturamento: sem.faturamento || 0,
          investimento: sem.investimento || 0,
          modo: sem.modo || "manual",
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "agencia_id,relatorio_id,semana_inicio" }
      );

      return NextResponse.json({ ok: true });
    }

    // ─── Criativos: carregar dados Meta + agendamentos manuais ───
    if (action === "criativos_carregar") {
      const { relatorio_id, date_from, date_to } = body;
      if (!relatorio_id) return NextResponse.json({ error: "relatorio_id obrigatório" }, { status: 400 });

      const { data: rel } = await supabase.from("relatorios")
        .select("*").eq("id", relatorio_id).single();
      if (!rel) return NextResponse.json({ error: "Relatório não encontrado" }, { status: 404 });

      const { data: con } = await supabase.from("relatorios_conexoes")
        .select("meta_token").eq("agencia_id", rel.agencia_id)
        .order("created_at", { ascending: false }).limit(1).single();
      const token = rel.meta_token || con?.meta_token;

      const desde = date_from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
      const ate = date_to || new Date().toISOString().split("T")[0];
      const acId = rel.ad_account_id.startsWith("act_") ? rel.ad_account_id : `act_${rel.ad_account_id}`;

      // Buscar criativos da Meta com breakdown por campanha
      let criativos: any[] = [];
      if (token) {
        try {
          const timeRange = `{"since":"${desde}","until":"${ate}"}`;
          const adRes = await metaFetch(
            `${META_API}/${acId}/insights?fields=ad_name,campaign_name,adset_name,impressions,clicks,spend,actions,ctr&level=ad&time_range=${timeRange}&limit=200`,
            token
          );
          criativos = (adRes.data || []).map((a: any) => ({
            ad_name: a.ad_name,
            campaign_name: a.campaign_name,
            adset_name: a.adset_name,
            impressions: parseInt(a.impressions || "0"),
            clicks: parseInt(a.clicks || "0"),
            spend: parseFloat(a.spend || "0"),
            mensagens: extractMensagens(a.actions),
            ctr: parseFloat(a.ctr || "0"),
          }));
        } catch {}
      }

      // Buscar agendamentos manuais salvos
      const { data: manuais } = await supabase.from("performance_criativos")
        .select("*")
        .eq("relatorio_id", relatorio_id)
        .gte("periodo_inicio", desde)
        .lte("periodo_inicio", desde + "T23:59:59Z");

      // Merge por ad_name + adset_name + campaign_name
      for (const c of criativos) {
        const manual = manuais?.find(m => m.ad_name === c.ad_name && m.adset_name === (c.adset_name || "") && (m.campaign_name || "") === (c.campaign_name || ""));
        c.agendamentos = manual?.agendamentos ?? 0;
        c.id = manual?.id ?? null;
      }

      return NextResponse.json({ criativos, periodo: { desde, ate } });
    }

    // ─── Criativos: salvar agendamentos manuais ───
    if (action === "criativos_salvar") {
      const { relatorio_id, criativos, date_from, date_to } = body;
      let { agencia_id } = body;
      if (!relatorio_id || !criativos) return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });

      if (!agencia_id || agencia_id === "auto") {
        const { data: rel } = await supabase.from("relatorios").select("agencia_id").eq("id", relatorio_id).single();
        agencia_id = rel?.agencia_id;
      }

      for (const c of criativos) {
        await supabase.from("performance_criativos").upsert({
          agencia_id,
          relatorio_id,
          periodo_inicio: date_from,
          periodo_fim: date_to,
          ad_name: c.ad_name,
          adset_name: c.adset_name || "",
          campaign_name: c.campaign_name || "",
          agendamentos: c.agendamentos || 0,
          updated_at: new Date().toISOString(),
        }, { onConflict: "agencia_id,relatorio_id,periodo_inicio,ad_name,adset_name,campaign_name" });
      }

      return NextResponse.json({ ok: true });
    }

    // ─── Sincronizar da planilha Google Sheets ───
    if (action === "sync_planilha") {
      const { relatorio_id } = body;
      if (!relatorio_id) return NextResponse.json({ error: "relatorio_id obrigatório" }, { status: 400 });

      // Buscar agencia_id e link_planilha via controle_clientes
      const { data: rel } = await supabase.from("relatorios").select("agencia_id").eq("id", relatorio_id).single();
      if (!rel) return NextResponse.json({ error: "Relatório não encontrado" }, { status: 404 });

      const { data: ctrl } = await supabase.from("controle_clientes")
        .select("link_planilha").eq("relatorio_id", relatorio_id).maybeSingle();
      const linkPlanilha = ctrl?.link_planilha;
      if (!linkPlanilha) return NextResponse.json({ error: "Nenhuma planilha vinculada a este cliente" }, { status: 400 });

      // Extrair spreadsheet ID e gid da URL
      const idMatch = linkPlanilha.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
      if (!idMatch) return NextResponse.json({ error: "URL da planilha inválida" }, { status: 400 });
      const spreadsheetId = idMatch[1];
      const gidMatch = linkPlanilha.match(/[?&#]gid=(\d+)/);

      // Baixar CSV — se não tiver gid, tentar encontrar a aba com "DASHBOARD MENSAL"
      let csv = "";
      if (gidMatch) {
        const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gidMatch[1]}`;
        const csvRes = await fetch(csvUrl);
        if (!csvRes.ok || (await csvRes.headers.get("content-type") || "").includes("html")) {
          return NextResponse.json({ error: "Não foi possível acessar a planilha. Verifique se ela está pública (Compartilhar → Qualquer pessoa com o link → Visualizador)." }, { status: 400 });
        }
        csv = await csvRes.text();
      } else {
        // Sem gid: tentar extrair todas as abas via feed de metadados
        const feedUrl = `https://spreadsheets.google.com/feeds/worksheets/${spreadsheetId}/public/basic?alt=json`;
        const feedRes = await fetch(feedUrl);
        if (feedRes.ok) {
          const feedData = await feedRes.json();
          const entries = feedData?.feed?.entry || [];
          for (const entry of entries) {
            const title: string = entry.title?.["$t"] || "";
            const gid = entry.link?.find((l: any) => l.rel?.includes("exportcsv"))?.href?.match(/gid=(\d+)/)?.[1];
            if (!gid) continue;
            const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
            const csvRes = await fetch(csvUrl);
            if (!csvRes.ok) continue;
            const text = await csvRes.text();
            if (text.includes("DASHBOARD MENSAL")) { csv = text; break; }
          }
        }
        if (!csv) {
          return NextResponse.json({ error: "Planilha sem gid na URL. Abra a aba 'Dashboard Mensal' e copie a URL completa (com #gid=...) no campo Planilha do cliente." }, { status: 400 });
        }
      }

      // Parsear CSV linha por linha
      const linhas = csv.split("\n").map(l => l.trim());

      // Extrair ano do título "DASHBOARD MENSAL — 2026"
      const anoMatch = linhas[0]?.match(/(\d{4})/);
      const ano = anoMatch ? parseInt(anoMatch[1]) : new Date().getFullYear();

      // Parsear número BR: "R$ 1.234,56" → 1234.56
      const parseBR = (s: string): number => {
        const clean = (s || "0").replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
        return parseFloat(clean) || 0;
      };

      // Parsear CSV respeitando campos entre aspas
      const parseCSVRow = (row: string): string[] => {
        const result: string[] = [];
        let current = "";
        let inQuotes = false;
        for (const ch of row) {
          if (ch === '"') { inQuotes = !inQuotes; continue; }
          if (ch === "," && !inQuotes) { result.push(current.trim()); current = ""; continue; }
          current += ch;
        }
        result.push(current.trim());
        return result;
      };

      // Coletar semanas com dados
      const semanasSinc: any[] = [];
      for (const linha of linhas) {
        const cols = parseCSVRow(linha);
        // Linha de dados: começa com S1..S5
        if (!/^S[1-5]$/.test(cols[0])) continue;
        const periodo = cols[1]; // "01/01 até 03/01"
        const partes = periodo.match(/(\d{2})\/(\d{2})\s+até\s+(\d{2})\/(\d{2})/);
        if (!partes) continue;
        const [, d1, m1, d2, m2] = partes;
        const semana_inicio = `${ano}-${m1}-${d1}`;
        const semana_fim = `${ano}-${m2}-${d2}`;
        const agendamentos = parseInt(cols[2]) || 0;
        const comparecimentos = parseInt(cols[3]) || 0;
        const vendas = parseInt(cols[4]) || 0;
        const faturamento = parseBR(cols[5]);

        // Só sincronizar semanas com algum dado preenchido
        if (agendamentos === 0 && comparecimentos === 0 && vendas === 0 && faturamento === 0) continue;

        semanasSinc.push({ semana_inicio, semana_fim, agendamentos, comparecimentos, vendas, faturamento });
      }

      if (semanasSinc.length === 0) {
        return NextResponse.json({ ok: true, sincronizadas: 0, msg: "Nenhuma semana com dados encontrada na planilha." });
      }

      // Sync — nunca sobrescreve mensagens/investimento (vêm do Meta/manual)
      // faturamento também preenche valor_vendas (mesmo valor)
      for (const sem of semanasSinc) {
        const { data: existing } = await supabase.from("performance_semanal")
          .select("id").eq("relatorio_id", relatorio_id)
          .eq("semana_inicio", sem.semana_inicio).maybeSingle();

        const camposPlanilha = {
          agendamentos: sem.agendamentos,
          comparecimentos: sem.comparecimentos,
          vendas: sem.vendas,
          faturamento: sem.faturamento,
          valor_vendas: sem.faturamento, // mesmo valor do faturamento
          semana_fim: sem.semana_fim,
          modo: "planilha",
          updated_at: new Date().toISOString(),
        };

        if (existing?.id) {
          // Registro já existe: atualiza só campos da planilha, preserva mensagens/investimento
          await supabase.from("performance_semanal").update(camposPlanilha).eq("id", existing.id);
        } else {
          // Registro novo: mensagens/investimento ficam null (carregar pega do Meta)
          await supabase.from("performance_semanal").insert({
            agencia_id: rel.agencia_id,
            relatorio_id,
            semana_inicio: sem.semana_inicio,
            mensagens: null,
            investimento: null,
            ...camposPlanilha,
          });
        }
      }

      return NextResponse.json({ ok: true, sincronizadas: semanasSinc.length });
    }

    return NextResponse.json({ error: "action inválida" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
