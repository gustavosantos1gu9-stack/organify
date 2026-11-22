import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Mapear etapas da jornada para eventos do Meta
const ETAPA_EVENTO: Record<string, string> = {
  "Entrou em contato": "Contact",
  "Fez Contato": "Contact",
  "Qualificado": "ViewContent",
  "Agendou": "InitiateCheckout",
  "Compareceu": "AddToCart",
  "Fechou": "Purchase",
  "Comprou": "Purchase",
};

export async function POST(req: NextRequest) {
  try {
    const { conversa_id, etapa_nova, agencia_id } = await req.json();
    if (!conversa_id || !etapa_nova) {
      return NextResponse.json({ ok: false, motivo: "Dados incompletos" });
    }

    const eventName = ETAPA_EVENTO[etapa_nova];
    if (!eventName) {
      return NextResponse.json({ ok: false, motivo: "Etapa não mapeada para evento Meta" });
    }

    // Buscar dados da conversa
    const { data: conv } = await supabase.from("conversas")
      .select("contato_numero, contato_nome, leadgen_id, fbclid, agencia_id, origem")
      .eq("id", conversa_id).single();

    if (!conv) return NextResponse.json({ ok: false, motivo: "Conversa não encontrada" });

    const agId = agencia_id || conv.agencia_id;

    // Se não tem leadgen_id, tentar buscar pelo número no lead ou rastreamento pendente
    if (!conv.leadgen_id && conv.contato_numero) {
      const numClean = conv.contato_numero.replace(/\D/g, "");
      const variantes = [numClean];
      if (!numClean.startsWith("55")) variantes.push(`55${numClean}`);
      if (numClean.startsWith("55")) variantes.push(numClean.slice(2));

      // Buscar no lead
      for (const v of variantes) {
        const { data: lead } = await supabase.from("leads")
          .select("leadgen_id").eq("telefone", v).not("leadgen_id", "is", null).limit(1).single();
        if (lead?.leadgen_id) {
          conv.leadgen_id = lead.leadgen_id;
          await supabase.from("conversas").update({ leadgen_id: lead.leadgen_id }).eq("id", conversa_id);
          break;
        }
      }

      // Fallback: buscar no rastreamento pendente
      if (!conv.leadgen_id) {
        for (const v of variantes) {
          const { data: rp } = await supabase.from("rastreamentos_pendentes")
            .select("leadgen_id").eq("wa_numero", v).not("leadgen_id", "is", null).limit(1).single();
          if (rp?.leadgen_id) {
            conv.leadgen_id = rp.leadgen_id;
            await supabase.from("conversas").update({ leadgen_id: rp.leadgen_id, origem: conv.origem || "Formulário Meta" }).eq("id", conversa_id);
            break;
          }
        }
      }
    }

    // Buscar token e pixel da agência
    const { data: ag } = await supabase.from("agencias")
      .select("meta_pixel_id, meta_token, meta_business_token, parent_id")
      .eq("id", agId).single();

    let pixelId = ag?.meta_pixel_id;
    let token = ag?.meta_business_token || ag?.meta_token;

    // Se filha não tem, buscar da master
    if ((!pixelId || !token) && ag?.parent_id) {
      const { data: parent } = await supabase.from("agencias")
        .select("meta_pixel_id, meta_token, meta_business_token")
        .eq("id", ag.parent_id).single();
      if (parent) {
        pixelId = pixelId || parent.meta_pixel_id;
        token = token || parent.meta_business_token || parent.meta_token;
      }
    }

    if (!pixelId || !token) {
      return NextResponse.json({ ok: false, motivo: "Pixel ou token não configurado" });
    }

    // Montar payload da Conversions API (CRM integration pra Central de Leads)
    const phone = conv.contato_numero?.replace(/\D/g, "") || "";
    const phoneNorm = phone.startsWith("55") ? phone : `55${phone}`;
    const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
    const userData: Record<string, any> = {};
    if (phone) userData.ph = [sha256(phoneNorm)];
    if (conv.fbclid) userData.fbc = `fb.1.${Date.now()}.${conv.fbclid}`;
    // lead_id é o campo que move na Central de Leads do Meta
    if (conv.leadgen_id) userData.lead_id = conv.leadgen_id;

    const eventData: Record<string, any> = {
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      // action_source "crm" é obrigatório pra Conversion Leads
      action_source: conv.leadgen_id ? "crm" : "system_generated",
      user_data: userData,
    };

    const payload = {
      data: [eventData],
    };

    console.log(`[conversion-lead] Enviando ${eventName} para pixel ${pixelId}`, JSON.stringify(payload).slice(0, 300));

    const res = await fetch(
      `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    const result = await res.json();

    if (result.error) {
      console.error("[conversion-lead] Erro Meta:", result.error);
      return NextResponse.json({ ok: false, error: result.error });
    }

    console.log(`[conversion-lead] Sucesso: ${eventName} para ${conv.contato_nome}`);
    return NextResponse.json({ ok: true, event: eventName, events_received: result.events_received });
  } catch (e: any) {
    console.error("[conversion-lead] Erro:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
