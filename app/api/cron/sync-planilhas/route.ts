import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export const maxDuration = 300;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const parseBR = (s: string): number => {
  const clean = (s || "0").replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
  return parseFloat(clean) || 0;
};

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

async function syncPlanilha(relatorio_id: string, agencia_id: string, linkPlanilha: string): Promise<{ ok: boolean; sincronizadas: number; erro?: string }> {
  const idMatch = linkPlanilha.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!idMatch) return { ok: false, sincronizadas: 0, erro: "URL inválida" };
  const spreadsheetId = idMatch[1];
  const gidMatch = linkPlanilha.match(/[?&#]gid=(\d+)/);

  let csv = "";
  try {
    if (gidMatch) {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gidMatch[1]}`;
      const csvRes = await fetch(csvUrl);
      if (!csvRes.ok) return { ok: false, sincronizadas: 0, erro: "Planilha inacessível" };
      const ct = csvRes.headers.get("content-type") || "";
      if (ct.includes("html")) return { ok: false, sincronizadas: 0, erro: "Planilha não pública" };
      csv = await csvRes.text();
    } else {
      const feedUrl = `https://spreadsheets.google.com/feeds/worksheets/${spreadsheetId}/public/basic?alt=json`;
      const feedRes = await fetch(feedUrl);
      if (feedRes.ok) {
        const feedData = await feedRes.json();
        const entries = feedData?.feed?.entry || [];
        for (const entry of entries) {
          const gid = entry.link?.find((l: any) => l.rel?.includes("exportcsv"))?.href?.match(/gid=(\d+)/)?.[1];
          if (!gid) continue;
          const csvRes = await fetch(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`);
          if (!csvRes.ok) continue;
          const text = await csvRes.text();
          if (text.includes("DASHBOARD MENSAL")) { csv = text; break; }
        }
      }
      if (!csv) return { ok: false, sincronizadas: 0, erro: "Sem gid na URL e aba DASHBOARD MENSAL não encontrada" };
    }
  } catch (e: any) {
    return { ok: false, sincronizadas: 0, erro: e.message };
  }

  const linhas = csv.split("\n").map((l: string) => l.trim());
  const anoMatch = linhas[0]?.match(/(\d{4})/);
  const ano = anoMatch ? parseInt(anoMatch[1]) : new Date().getFullYear();

  const semanasSinc: any[] = [];
  for (const linha of linhas) {
    const cols = parseCSVRow(linha);
    if (!/^S[1-5]$/.test(cols[0])) continue;
    const periodo = cols[1];
    const partes = periodo.match(/(\d{2})\/(\d{2})\s+até\s+(\d{2})\/(\d{2})/);
    if (!partes) continue;
    const [, d1, m1, d2, m2] = partes;
    const semana_inicio = `${ano}-${m1}-${d1}`;
    const semana_fim = `${ano}-${m2}-${d2}`;
    const agendamentos = parseInt(cols[2]) || 0;
    const comparecimentos = parseInt(cols[3]) || 0;
    const vendas = parseInt(cols[4]) || 0;
    const faturamento = parseBR(cols[5]);
    if (agendamentos === 0 && comparecimentos === 0 && vendas === 0 && faturamento === 0) continue;
    semanasSinc.push({ semana_inicio, semana_fim, agendamentos, comparecimentos, vendas, faturamento });
  }

  if (semanasSinc.length === 0) return { ok: true, sincronizadas: 0 };

  for (const sem of semanasSinc) {
    const { data: existing } = await supabase.from("performance_semanal")
      .select("id").eq("relatorio_id", relatorio_id)
      .eq("semana_inicio", sem.semana_inicio).maybeSingle();

    const campos = {
      agendamentos: sem.agendamentos,
      comparecimentos: sem.comparecimentos,
      vendas: sem.vendas,
      faturamento: sem.faturamento,
      valor_vendas: sem.faturamento,
      semana_fim: sem.semana_fim,
      modo: "planilha",
      updated_at: new Date().toISOString(),
    };

    if (existing?.id) {
      await supabase.from("performance_semanal").update(campos).eq("id", existing.id);
    } else {
      await supabase.from("performance_semanal").insert({
        agencia_id,
        relatorio_id,
        semana_inicio: sem.semana_inicio,
        mensagens: null,
        investimento: null,
        ...campos,
      });
    }
  }

  return { ok: true, sincronizadas: semanasSinc.length };
}

export async function GET() {
  try {
    // Buscar todos controle_clientes com planilha e relatorio vinculados
    const { data: clientes } = await supabase
      .from("controle_clientes")
      .select("relatorio_id, link_planilha, agencia_id")
      .not("link_planilha", "is", null)
      .neq("link_planilha", "")
      .not("relatorio_id", "is", null)
      .neq("status", "saiu");

    if (!clientes?.length) return NextResponse.json({ ok: true, total: 0 });

    // Buscar agencia_id dos relatorios para quem não tem
    const semAgencia = clientes.filter((c: any) => !c.agencia_id);
    const relIds = [...new Set(semAgencia.map((c: any) => c.relatorio_id))];
    const agenciaMap: Record<string, string> = {};
    if (relIds.length) {
      const { data: rels } = await supabase.from("relatorios").select("id, agencia_id").in("id", relIds);
      (rels || []).forEach((r: any) => { agenciaMap[r.id] = r.agencia_id; });
    }

    let totalSinc = 0;
    let erros = 0;

    // Processar em lotes de 5 para não sobrecarregar
    const batch = 5;
    for (let i = 0; i < clientes.length; i += batch) {
      const chunk = clientes.slice(i, i + batch);
      await Promise.all(chunk.map(async (c: any) => {
        const agId = c.agencia_id || agenciaMap[c.relatorio_id];
        if (!agId) return;
        const result = await syncPlanilha(c.relatorio_id, agId, c.link_planilha);
        if (result.ok) totalSinc += result.sincronizadas;
        else erros++;
        if (result.erro) console.log(`[sync-planilhas] Erro ${c.relatorio_id}: ${result.erro}`);
      }));
    }

    console.log(`[sync-planilhas] ${clientes.length} clientes, ${totalSinc} semanas sincronizadas, ${erros} erros`);
    return NextResponse.json({ ok: true, clientes: clientes.length, semanas: totalSinc, erros });
  } catch (e: any) {
    console.error("[sync-planilhas]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
