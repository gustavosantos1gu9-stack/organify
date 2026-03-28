import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { dispararEventoMeta } from "@/lib/meta-pixel";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { agencia_id, conversa_id, etapa_nome, phone, fbclid, utm_campaign, utm_content, valor } = await req.json();

    // Buscar config da agência
    const { data: agencia } = await supabase.from("agencias")
      .select("meta_pixel_id, meta_token, meta_ativo")
      .eq("id", agencia_id).single();

    if (!agencia?.meta_ativo || !agencia?.meta_pixel_id || !agencia?.meta_token) {
      return NextResponse.json({ ok: false, motivo: "Meta Ads não configurado ou inativo" });
    }

    // Buscar evento da etapa na jornada
    const { data: etapa } = await supabase.from("jornada_etapas")
      .select("evento_conversao, eh_venda, valor_padrao")
      .eq("agencia_id", agencia_id)
      .eq("nome", etapa_nome)
      .single();

    if (!etapa?.evento_conversao) {
      return NextResponse.json({ ok: false, motivo: "Etapa sem evento de conversão configurado" });
    }

    // Disparar evento
    const resultado = await dispararEventoMeta({
      pixel_id: agencia.meta_pixel_id,
      access_token: agencia.meta_token,
      event_name: etapa.evento_conversao,
      phone,
      fbclid,
      utm_campaign,
      utm_content,
      valor: valor || etapa.valor_padrao || undefined,
    });

    // Salvar log do disparo
    await supabase.from("pixel_disparos").insert({
      agencia_id,
      conversa_id,
      etapa: etapa_nome,
      evento: etapa.evento_conversao,
      status: resultado.ok ? "sucesso" : "erro",
      retorno: resultado.error || "OK",
      created_at: new Date().toISOString(),
    });

    return NextResponse.json(resultado);
  } catch(e) {
    console.error("Pixel API erro:", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
