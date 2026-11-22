import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { dispararEventoMeta } from "@/lib/meta-pixel";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    // Buscar config da agência master
    const { data: ag } = await supabase.from("agencias")
      .select("meta_pixel_id, meta_token, meta_business_token")
      .eq("id", "32cdce6e-4664-4ac6-979d-6d68a1a68745")
      .single();

    const pixelId = ag?.meta_pixel_id;
    const token = ag?.meta_token || ag?.meta_business_token;

    if (!pixelId || !token) {
      return NextResponse.json({ ok: false, error: "Pixel ou token não configurado" });
    }

    // Buscar todas as conversas com leadgen_id e etapa definida
    const { data: conversas } = await supabase.from("conversas")
      .select("id, contato_numero, contato_nome, leadgen_id, etapa_jornada")
      .eq("agencia_id", "32cdce6e-4664-4ac6-979d-6d68a1a68745")
      .not("leadgen_id", "is", null)
      .not("etapa_jornada", "is", null);

    if (!conversas?.length) {
      return NextResponse.json({ ok: true, enviados: 0, msg: "Nenhuma conversa com leadgen_id" });
    }

    // Buscar mapa de etapas → eventos
    const { data: etapas } = await supabase.from("jornada_etapas")
      .select("nome, evento_conversao")
      .eq("agencia_id", "32cdce6e-4664-4ac6-979d-6d68a1a68745");

    const mapaEtapas: Record<string, string> = {};
    for (const e of etapas || []) {
      if (e.evento_conversao) mapaEtapas[e.nome] = e.evento_conversao;
    }

    let enviados = 0;
    let ignorados = 0;
    const erros: string[] = [];

    for (const conv of conversas) {
      const eventName = mapaEtapas[conv.etapa_jornada];

      // Só reenvia etapas com evento configurado (ignora "Entrou em contato" → Contact pois não é conversão de campanha)
      if (!eventName || eventName === "Contact" || eventName === "ViewContent") {
        ignorados++;
        continue;
      }

      const phone = (conv.contato_numero || "").replace(/\D/g, "");
      const phoneNorm = phone.startsWith("55") ? phone : `55${phone}`;

      try {
        const res = await dispararEventoMeta({
          pixel_id: pixelId,
          access_token: token,
          event_name: eventName,
          phone: phoneNorm,
          contato_nome: conv.contato_nome,
          lead_id: conv.leadgen_id,
          action_source: "crm",
          event_id: `resend_${conv.id}_${eventName}`,
        });

        if (res.ok) {
          enviados++;
          console.log(`[pixel-resend] ${conv.contato_nome} → ${eventName} ✓`);
        } else {
          erros.push(`${conv.contato_nome}: ${res.error}`);
        }
      } catch (e: any) {
        erros.push(`${conv.contato_nome}: ${e.message}`);
      }

      // Pequena pausa para não estourar rate limit da API
      await new Promise(r => setTimeout(r, 50));
    }

    return NextResponse.json({
      ok: true,
      total: conversas.length,
      enviados,
      ignorados,
      erros: erros.slice(0, 10),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
