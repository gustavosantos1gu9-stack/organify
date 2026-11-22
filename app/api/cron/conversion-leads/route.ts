import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ETAPA_EVENTO: Record<string, string> = {
  "Entrou em contato": "Contact",
  "Fez Contato": "Contact",
  "Qualificado": "ViewContent",
  "Agendou": "InitiateCheckout",
  "Compareceu": "AddToCart",
  "Fechou": "Purchase",
  "Comprou": "Purchase",
};

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Buscar mudanças de etapa dos últimos 15 minutos que ainda não foram enviadas
    const quinzeMinAtras = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const { data: historico } = await supabase.from("etapas_historico")
      .select("id, conversa_id, etapa_nova, agencia_id, enviado_meta")
      .gt("created_at", quinzeMinAtras)
      .is("enviado_meta", null)
      .order("created_at", { ascending: true })
      .limit(50);

    if (!historico?.length) {
      return NextResponse.json({ ok: true, processados: 0 });
    }

    let enviados = 0;
    let erros = 0;

    for (const h of historico) {
      const eventName = ETAPA_EVENTO[h.etapa_nova];
      if (!eventName) {
        await supabase.from("etapas_historico").update({ enviado_meta: false }).eq("id", h.id);
        continue;
      }

      // Buscar conversa
      const { data: conv } = await supabase.from("conversas")
        .select("contato_numero, leadgen_id, fbclid, origem")
        .eq("id", h.conversa_id).single();

      if (!conv || (!conv.leadgen_id && !conv.fbclid && conv.origem !== "Meta Ads" && conv.origem !== "Formulário Meta")) {
        await supabase.from("etapas_historico").update({ enviado_meta: false }).eq("id", h.id);
        continue;
      }

      // Se não tem leadgen_id, tentar buscar pelo número
      if (!conv.leadgen_id && conv.contato_numero) {
        const numClean = conv.contato_numero.replace(/\D/g, "");
        const variantes = [numClean];
        if (!numClean.startsWith("55")) variantes.push(`55${numClean}`);
        if (numClean.startsWith("55")) variantes.push(numClean.slice(2));

        for (const v of variantes) {
          const { data: rp } = await supabase.from("rastreamentos_pendentes")
            .select("leadgen_id").eq("wa_numero", v).not("leadgen_id", "is", null).limit(1).single();
          if (rp?.leadgen_id) {
            conv.leadgen_id = rp.leadgen_id;
            await supabase.from("conversas").update({ leadgen_id: rp.leadgen_id }).eq("id", h.conversa_id);
            break;
          }
        }
      }

      // Buscar token e pixel
      const { data: ag } = await supabase.from("agencias")
        .select("meta_pixel_id, meta_token, meta_business_token, parent_id")
        .eq("id", h.agencia_id).single();

      let pixelId = ag?.meta_pixel_id;
      let token = ag?.meta_business_token || ag?.meta_token;
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
        await supabase.from("etapas_historico").update({ enviado_meta: false }).eq("id", h.id);
        continue;
      }

      // Montar payload
      const phone = conv.contato_numero?.replace(/\D/g, "") || "";
      const phoneNorm = phone.startsWith("55") ? phone : `55${phone}`;
      const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

      const userData: Record<string, any> = {};
      if (phone) userData.ph = [sha256(phoneNorm)];
      if (conv.fbclid) userData.fbc = `fb.1.${Date.now()}.${conv.fbclid}`;
      if (conv.leadgen_id) userData.lead_id = conv.leadgen_id;

      const payload = {
        data: [{
          event_name: eventName,
          event_time: Math.floor(Date.now() / 1000),
          action_source: conv.leadgen_id ? "crm" : "system_generated",
          user_data: userData,
        }],
      };

      try {
        const res = await fetch(
          `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${token}`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
        );
        const result = await res.json();

        if (result.events_received) {
          await supabase.from("etapas_historico").update({ enviado_meta: true }).eq("id", h.id);
          enviados++;
          console.log(`[cron/conversion] ${eventName} enviado para ${conv.contato_numero}`);
        } else {
          await supabase.from("etapas_historico").update({ enviado_meta: false }).eq("id", h.id);
          erros++;
          console.error(`[cron/conversion] Erro:`, result.error?.message);
        }
      } catch (e: any) {
        await supabase.from("etapas_historico").update({ enviado_meta: false }).eq("id", h.id);
        erros++;
      }
    }

    return NextResponse.json({ ok: true, processados: historico.length, enviados, erros });
  } catch (e: any) {
    console.error("[cron/conversion] Erro:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
