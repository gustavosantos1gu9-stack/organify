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
    const agora = new Date();
    const horaAtual = `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;
    const diaAtual = agora.getDay(); // 0=dom, 6=sab

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

      // Checar se está na hora (dentro da janela de 1h do cron)
      const [hCron, mCron] = horario.split(":").map(Number);
      const [hAgora, mAgora] = horaAtual.split(":").map(Number);

      // O cron roda a cada hora (:00), então checa se o horário do relatório
      // cai dentro dessa hora (ex: cron roda às 17:00, relatório é 17:30)
      if (hCron !== hAgora) continue;

      // Checar frequência
      if (rel.frequencia === "semanal") {
        if (rel.dia_semana !== null && rel.dia_semana !== diaAtual) continue;
      }

      // Checar se já enviou hoje (evitar duplicatas)
      if (rel.ultimo_envio) {
        const ultimoEnvio = new Date(rel.ultimo_envio);
        const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
        if (ultimoEnvio >= hoje) continue; // já enviou hoje
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
