import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { agencia_id, conversa_id, contato_numero, contato_jid } = await req.json();
    if (!agencia_id || !conversa_id) {
      return NextResponse.json({ ok: false, motivo: "Dados incompletos" });
    }

    // 1. Verificar se follow-up está ativo
    const { data: ag } = await supabase.from("agencias")
      .select("followup_ativo")
      .eq("id", agencia_id).single();

    if (!ag?.followup_ativo) {
      return NextResponse.json({ ok: false, motivo: "Follow-up não ativo" });
    }

    // 2. Buscar etapas ativas ordenadas
    const { data: etapas } = await supabase.from("followup_etapas")
      .select("*")
      .eq("agencia_id", agencia_id)
      .eq("ativo", true)
      .order("ordem", { ascending: true });

    if (!etapas?.length) {
      return NextResponse.json({ ok: false, motivo: "Sem etapas configuradas" });
    }

    // 3. Cancelar follow-ups pendentes anteriores desta conversa
    await supabase.from("followup_fila")
      .update({ status: "cancelado" })
      .eq("conversa_id", conversa_id)
      .eq("status", "pendente");

    // 4. Calcular horários e inserir na fila
    const agora = Date.now();
    let acumulado = 0;
    const registros = etapas.map((etapa) => {
      acumulado += etapa.delay_minutos;
      return {
        agencia_id,
        conversa_id,
        etapa_id: etapa.id,
        contato_numero: contato_numero || "",
        contato_jid: contato_jid || null,
        agendar_para: new Date(agora + acumulado * 60 * 1000).toISOString(),
        status: "pendente",
      };
    });

    const { error } = await supabase.from("followup_fila").insert(registros);
    if (error) {
      console.error("[followup] Erro ao agendar:", error);
      return NextResponse.json({ ok: false, motivo: error.message });
    }

    console.log(`[followup] ${registros.length} etapas agendadas para conversa ${conversa_id}`);
    return NextResponse.json({ ok: true, agendados: registros.length });
  } catch (e: any) {
    console.error("[followup] Exceção agendar:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
