import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://salxconvert-blond.vercel.app";

export async function GET(req: NextRequest) {
  // Proteger com secret do Vercel Cron
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Vercel roda em UTC — converter para horário de Brasília (America/Sao_Paulo)
    const agora = new Date();
    const brFormatter = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const brParts = brFormatter.formatToParts(agora);
    const brHora = brParts.find(p => p.type === "hour")!.value;
    const brMinuto = brParts.find(p => p.type === "minute")!.value;
    const horaAtual = `${brHora}:${brMinuto}`;

    // Dia da semana em Brasília
    const brDayFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      weekday: "short",
    });
    const brDayStr = brDayFormatter.format(agora);
    const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const diaAtual = dayMap[brDayStr]; // 0=dom, 6=sab

    // Data de hoje em Brasília (para checar ultimo_envio)
    const brDateFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const hojeBR = brDateFormatter.format(agora); // YYYY-MM-DD

    // Buscar relatórios ativos
    const { data: relatorios } = await supabase
      .from("relatorios")
      .select("id, frequencia, horario_envio, dia_semana, ultimo_envio")
      .eq("ativo", true)
      .neq("frequencia", "manual");

    if (!relatorios?.length) {
      return NextResponse.json({ ok: true, msg: "Nenhum relatório agendado", enviados: 0 });
    }

    const resultados: { id: string; status: string; error?: string }[] = [];

    for (const rel of relatorios) {
      const horario = rel.horario_envio || "17:30";

      // Checar se está na janela de 30min do cron
      const [hRel, mRel] = horario.split(":").map(Number);
      const [hAgora, mAgora] = horaAtual.split(":").map(Number);
      const minRel = hRel * 60 + mRel;
      const minAgora = hAgora * 60 + mAgora;

      // Cron roda a cada 30min. Dispara se o horário do relatório
      // cai dentro da janela atual (ex: cron às 17:00 pega 17:00-17:29, cron às 17:30 pega 17:30-17:59)
      if (minRel < minAgora || minRel >= minAgora + 30) continue;

      // Checar frequência
      if (rel.frequencia === "semanal") {
        if (rel.dia_semana !== null && rel.dia_semana !== diaAtual) continue;
      }

      // Checar se já enviou hoje (evitar duplicatas) — comparar em horário de Brasília
      if (rel.ultimo_envio) {
        const ultimoEnvioBR = new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Sao_Paulo",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(rel.ultimo_envio)); // YYYY-MM-DD
        if (ultimoEnvioBR >= hojeBR) continue; // já enviou hoje
      }

      // Enviar
      try {
        const res = await fetch(`${APP_URL}/api/relatorios/enviar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ relatorio_id: rel.id }),
        });
        const data = await res.json();

        if (data.success) {
          resultados.push({ id: rel.id, status: "enviado" });
        } else {
          resultados.push({ id: rel.id, status: "erro", error: data.error });
        }
      } catch (err: any) {
        resultados.push({ id: rel.id, status: "erro", error: err.message });
      }
    }

    return NextResponse.json({
      ok: true,
      hora: horaAtual,
      dia: diaAtual,
      total_verificados: relatorios.length,
      enviados: resultados.filter(r => r.status === "enviado").length,
      erros: resultados.filter(r => r.status === "erro").length,
      resultados,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
