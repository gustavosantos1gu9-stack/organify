import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const INSTANCIAS_IGNORADAS = new Set(["jeci-soares", "mayara-costa", "teste-ia"]);
const INSTANCIAS_PAUSADAS = new Set(["rafaela-costa", "katy", "lidia-takaki-botox"]);

export async function GET(_req: NextRequest) {
  const { data: agencias } = await supabase.from("agencias")
    .select("id, nome, whatsapp_instancia")
    .not("whatsapp_instancia", "is", null);

  const monitored = (agencias || []).filter(a =>
    !INSTANCIAS_IGNORADAS.has(a.whatsapp_instancia) &&
    !INSTANCIAS_PAUSADAS.has(a.whatsapp_instancia)
  );

  const instancias = await Promise.all(monitored.map(async (ag) => {
    // Alertas abertos por tipo
    const { data: alertas } = await supabase.from("instancia_alertas")
      .select("tipo, mensagem, created_at, email_enviado, canal")
      .eq("instancia", ag.whatsapp_instancia)
      .eq("resolvido", false)
      .order("created_at", { ascending: false });

    // Último alerta resolvido (para histórico)
    const { data: ultimoResolvido } = await supabase.from("instancia_alertas")
      .select("tipo, resolvido_at, mensagem, canal")
      .eq("instancia", ag.whatsapp_instancia)
      .eq("resolvido", true)
      .order("resolvido_at", { ascending: false })
      .limit(1).maybeSingle();

    // Última mensagem recebida via SQL function (evita array grande)
    const { data: atividadeRows } = await supabase
      .rpc("instancia_tem_atividade_recente", { p_agencia_id: ag.id });

    const ultimaMsgAt = atividadeRows?.[0]?.ultima_msg_at || null;

    return {
      instancia: ag.whatsapp_instancia,
      nome: ag.nome,
      alertas_abertos: alertas || [],
      ultimo_resolvido: ultimoResolvido || null,
      ultima_msg_recebida: ultimaMsgAt,
    };
  }));

  const alertasAbertos = instancias.reduce((n, i) => n + i.alertas_abertos.length, 0);

  return NextResponse.json({ instancias, alertas_abertos: alertasAbertos });
}
