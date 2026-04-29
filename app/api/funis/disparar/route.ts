import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://salxconvert-blond.vercel.app";

export async function POST(req: NextRequest) {
  try {
    const { agencia_id, funil_id, conversa_id, contato_numero, contato_jid, disparado_por } = await req.json();

    if (!agencia_id || !funil_id || !conversa_id || !contato_numero) {
      return NextResponse.json({ ok: false, motivo: "Campos obrigatórios faltando" }, { status: 400 });
    }

    // 1. Buscar etapas ativas do funil ordenadas
    const { data: etapas, error: etapasErr } = await supabase.from("funil_etapas")
      .select("*")
      .eq("funil_id", funil_id)
      .eq("ativo", true)
      .order("ordem", { ascending: true });

    if (etapasErr || !etapas?.length) {
      return NextResponse.json({ ok: false, motivo: "Funil sem etapas ativas" });
    }

    // 2. Cancelar pendentes anteriores desta conversa
    await supabase.from("funil_fila")
      .update({ status: "cancelado" })
      .eq("conversa_id", conversa_id)
      .eq("status", "pendente");

    // 3. Calcular agendar_para acumulando delays e inserir na fila
    const agora = new Date();
    let acumulado = 0;
    const rows = etapas.map((etapa) => {
      acumulado += etapa.delay_minutos || 0;
      const agendarPara = new Date(agora.getTime() + acumulado * 60 * 1000);
      return {
        agencia_id,
        funil_id,
        etapa_id: etapa.id,
        conversa_id,
        contato_numero,
        contato_jid: contato_jid || null,
        agendar_para: agendarPara.toISOString(),
        status: "pendente",
        disparado_por: disparado_por || "manual",
      };
    });

    const { data: inseridos, error: insertErr } = await supabase.from("funil_fila")
      .insert(rows)
      .select("id, etapa_id, agendar_para");

    if (insertErr) {
      console.error("[funis/disparar] Erro insert:", insertErr);
      return NextResponse.json({ ok: false, motivo: "Erro ao agendar etapas" }, { status: 500 });
    }

    // 4. Se primeira etapa tem delay=0, processar imediatamente
    const primeiraEtapa = etapas[0];
    if ((primeiraEtapa.delay_minutos || 0) === 0 && inseridos?.length) {
      const primeiroItem = inseridos[0];
      try {
        await fetch(`${APP_URL}/api/funis/enviar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ funil_fila_id: primeiroItem.id }),
        });
      } catch (e) {
        console.error("[funis/disparar] Erro ao enviar primeira etapa:", e);
      }
    }

    return NextResponse.json({ ok: true, etapas_agendadas: inseridos?.length || 0 });
  } catch (e: any) {
    console.error("[funis/disparar] Exceção:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
