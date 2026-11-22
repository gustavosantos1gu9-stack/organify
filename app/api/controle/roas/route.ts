import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const META_API = "https://graph.facebook.com/v21.0";

function getMesAnterior() {
  const now = new Date(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()));
  const ano = now.getFullYear();
  const mes = now.getMonth();
  const mesAnterior = mes === 0 ? 12 : mes;
  const anoAnterior = mes === 0 ? ano - 1 : ano;
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const mm = String(mesAnterior).padStart(2, "0");
  const dd = String(ultimoDia).padStart(2, "0");
  return { since: `${anoAnterior}-${mm}-01`, until: `${anoAnterior}-${mm}-${dd}` };
}

// Gera as mesmas semanas que o dashboard de performance usa
function gerarSemanas(desde: string, ate: string): { inicio: string; fim: string }[] {
  const semanas: { inicio: string; fim: string }[] = [];
  const start = new Date(desde + "T12:00:00");
  const end = new Date(ate + "T12:00:00");
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const primeiroDia = new Date(start.getFullYear(), start.getMonth(), 1);
  const primSab = new Date(primeiroDia);
  const dow = primSab.getDay();
  if (dow !== 6) primSab.setDate(primSab.getDate() + (6 - dow));
  const ultimoDiaMes = new Date(primeiroDia.getFullYear(), primeiroDia.getMonth() + 1, 0);
  const fimSem1 = primSab > ultimoDiaMes ? ultimoDiaMes : primSab;
  if (fimSem1 >= start && primeiroDia <= end) {
    semanas.push({ inicio: fmt(primeiroDia < start ? start : primeiroDia), fim: fmt(fimSem1 > end ? end : fimSem1) });
  }
  const cursor = new Date(fimSem1);
  cursor.setDate(cursor.getDate() + 1);
  while (cursor <= end && cursor <= ultimoDiaMes) {
    const semInicio = new Date(cursor);
    const semFim = new Date(cursor);
    semFim.setDate(semFim.getDate() + 6);
    if (semFim > ultimoDiaMes) semFim.setTime(ultimoDiaMes.getTime());
    const fimReal = semFim > end ? end : semFim;
    if (semInicio <= end) semanas.push({ inicio: fmt(semInicio), fim: fmt(fimReal) });
    cursor.setDate(cursor.getDate() + 7);
  }
  return semanas;
}

export async function POST(req: NextRequest) {
  try {
    const { relatorio_ids } = await req.json();
    if (!relatorio_ids?.length) return NextResponse.json({ results: [] });

    const { since, until } = getMesAnterior();
    const semanas = gerarSemanas(since, until);

    // 1. Dados performance_semanal (investimento + faturamento) do mês anterior
    const { data: perfRows } = await supabase
      .from("performance_semanal")
      .select("relatorio_id, semana_inicio, investimento, faturamento")
      .in("relatorio_id", relatorio_ids)
      .gte("semana_inicio", since)
      .lte("semana_inicio", until);

    // Indexar por relatorio_id + semana_inicio
    const perfIndex: Record<string, Record<string, any>> = {};
    for (const row of perfRows || []) {
      if (!perfIndex[row.relatorio_id]) perfIndex[row.relatorio_id] = {};
      perfIndex[row.relatorio_id][row.semana_inicio] = row;
    }

    // Faturamento: soma do performance_semanal
    const fatByRelId: Record<string, number> = {};
    for (const row of perfRows || []) {
      if (row.faturamento !== null && Number(row.faturamento) > 0) {
        fatByRelId[row.relatorio_id] = (fatByRelId[row.relatorio_id] || 0) + Number(row.faturamento);
      }
    }

    // 2. Tokens Meta
    const { data: rels } = await supabase
      .from("relatorios")
      .select("id, ad_account_id, meta_token, agencia_id")
      .in("id", relatorio_ids);

    const agenciaIds = [...new Set((rels || []).filter((r: any) => !r.meta_token).map((r: any) => r.agencia_id))];
    const conexoesMap: Record<string, string> = {};
    if (agenciaIds.length) {
      const { data: cons } = await supabase
        .from("relatorios_conexoes")
        .select("agencia_id, meta_token")
        .in("agencia_id", agenciaIds)
        .order("created_at", { ascending: false });
      (cons || []).forEach((c: any) => {
        if (!conexoesMap[c.agencia_id] && c.meta_token) conexoesMap[c.agencia_id] = c.meta_token;
      });
    }

    const results = await Promise.all((rels || []).map(async (rel: any) => {
      const faturamento = fatByRelId[rel.id] ?? null;
      const token = rel.meta_token || conexoesMap[rel.agencia_id];
      const acId = rel.ad_account_id?.startsWith("act_") ? rel.ad_account_id : `act_${rel.ad_account_id}`;

      // Investimento: somar semana a semana (performance_semanal se tiver, Meta API se não tiver)
      // Igual ao dashboard de performance
      let totalSpend = 0;
      let temAlgumDado = false;

      for (const sem of semanas) {
        const stored = perfIndex[rel.id]?.[sem.inicio];
        if (stored && stored.investimento !== null) {
          totalSpend += Number(stored.investimento);
          temAlgumDado = true;
        } else if (token && rel.ad_account_id) {
          // Semana sem dado armazenado: buscar na Meta API
          try {
            const res = await fetch(
              `${META_API}/${acId}/insights?fields=spend&time_range={"since":"${sem.inicio}","until":"${sem.fim}"}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.ok) {
              const data = await res.json();
              const s = data.data?.[0]?.spend ? parseFloat(data.data[0].spend) : 0;
              totalSpend += s;
              if (s > 0) temAlgumDado = true;
            }
          } catch {}
        }
      }

      const spend = temAlgumDado ? totalSpend : null;
      return { relatorio_id: rel.id, spend, faturamento };
    }));

    return NextResponse.json({ results });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
