import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const VERIFY_TOKEN = "salxconvert_leads_2026";

// GET — verificação do webhook pelo Meta
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// POST — receber leads do Meta Lead Ads
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("[meta-leads] Webhook recebido:", JSON.stringify(body).slice(0, 500));

    const entries = body.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        if (change.field !== "leadgen") continue;

        const leadgenId = change.value?.leadgen_id;
        const formId = change.value?.form_id;
        const pageId = change.value?.page_id;
        const adId = change.value?.ad_id;
        const createdTime = change.value?.created_time;

        if (!leadgenId) continue;

        // Buscar agência pelo page_id ou pela conta de anúncio
        // Por padrão, usar o master
        const agenciaId = "32cdce6e-4664-4ac6-979d-6d68a1a68745";

        // Buscar token para puxar os dados do lead
        const { data: ag } = await supabase.from("agencias")
          .select("meta_business_token, meta_token")
          .eq("id", agenciaId).single();

        const token = ag?.meta_business_token || ag?.meta_token;
        if (!token) {
          console.error("[meta-leads] Sem token para agência", agenciaId);
          continue;
        }

        // Buscar dados do lead na API do Meta (incluindo ad_id, campaign, adset)
        const leadRes = await fetch(
          `https://graph.facebook.com/v21.0/${leadgenId}?fields=field_data,ad_id,ad_name,campaign_id,campaign_name,adset_id,adset_name,form_id&access_token=${token}`
        );
        const leadData = await leadRes.json();

        if (leadData.error) {
          console.error("[meta-leads] Erro ao buscar lead:", leadData.error);
          continue;
        }

        // Extrair campos do formulário
        const fields: Record<string, string> = {};
        for (const f of leadData.field_data || []) {
          fields[f.name] = Array.isArray(f.values) ? f.values[0] : f.values;
        }

        const nome = fields.full_name || fields.nome || fields.first_name || "Lead Formulário";
        const email = fields.email || null;
        const telefone = fields.phone_number || fields.whatsapp || fields.telefone || null;
        const cidade = fields.city || null;

        // Buscar nome da campanha/conjunto/anúncio
        // Primeiro tenta usar os dados que vieram direto do lead
        let campanhaNome = leadData.campaign_name || "";
        let conjuntoNome = leadData.adset_name || "";
        let criativoNome = leadData.ad_name || "";
        const resolvedAdId = adId || leadData.ad_id;

        // Se não veio direto do lead, buscar pelo ad_id
        if ((!campanhaNome || !conjuntoNome || !criativoNome) && resolvedAdId && token) {
          try {
            const adRes = await fetch(
              `https://graph.facebook.com/v21.0/${resolvedAdId}?fields=name,adset{id,name},campaign{id,name}&access_token=${token}`
            );
            const adData = await adRes.json();
            if (!adData.error) {
              campanhaNome = campanhaNome || adData.campaign?.name || "";
              conjuntoNome = conjuntoNome || adData.adset?.name || "";
              criativoNome = criativoNome || adData.name || "";
            } else {
              console.error("[meta-leads] Erro ao buscar ad:", adData.error);
            }
          } catch (e) {
            console.error("[meta-leads] Erro fetch ad:", e);
          }
        }

        console.log("[meta-leads] Tracking:", { campanhaNome, conjuntoNome, criativoNome, adId, resolvedAdId });

        // Salvar rastreamento pendente para match automático no WhatsApp
        // Quando o lead mandar msg no WhatsApp, o webhook cruza pelo número
        if (telefone) {
          const phoneClean = telefone.replace(/\D/g, "");
          // Normalizar: garantir formato 55DDDNNNNNNNNN
          const phoneNorm = phoneClean.startsWith("55") ? phoneClean
            : phoneClean.length >= 10 ? `55${phoneClean}` : phoneClean;
          try {
            await supabase.from("rastreamentos_pendentes").insert({
              wa_numero: phoneNorm,
              utm_source: "meta",
              utm_medium: "leadform",
              utm_campaign: campanhaNome,
              utm_content: conjuntoNome,
              utm_term: criativoNome,
              origem: "Formulário Meta",
              wa_destino: agenciaId === "32cdce6e-4664-4ac6-979d-6d68a1a68745" ? "555193694003" : null,
            });
            console.log("[meta-leads] Rastreamento pendente salvo:", phoneNorm);
          } catch (e) {
            console.error("[meta-leads] Erro ao salvar rastreamento:", e);
          }
        }

        // Criar lead no CRM
        const { data: lead, error: errLead } = await supabase.from("leads").insert({
          agencia_id: agenciaId,
          nome,
          email,
          telefone,
          etapa: "novo",
          utm_source: "facebook",
          utm_medium: "leadform",
          utm_campaign: campanhaNome,
          utm_content: conjuntoNome,
          utm_term: criativoNome,
          whatsapp_mensagem_inicial: `Formulário: ${formId} | Campanha: ${campanhaNome || "—"} | Conjunto: ${conjuntoNome || "—"} | Anúncio: ${criativoNome || "—"}`,
          observacoes: Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join("\n"),
        }).select().single();

        if (errLead) {
          console.error("[meta-leads] Erro ao criar lead:", errLead);
        } else {
          console.log("[meta-leads] Lead criado:", nome, telefone);
        }

        // Disparar pixel (ViewContent) se tiver pixel configurado
        const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://salxconvert-blond.vercel.app";
        try {
          await fetch(`${APP_URL}/api/pixel`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              agencia_id: agenciaId,
              etapa_nome: "Entrou em contato",
              phone: telefone,
              contato_nome: nome,
              utm_campaign: campanhaNome,
              utm_content: conjuntoNome,
              is_ctwa: false,
            }),
          });
        } catch {}

        // Salvar resposta no formulários_respostas (se tiver formulário vinculado)
        try {
          await supabase.from("formularios_respostas").insert({
            agencia_id: agenciaId,
            respostas: fields,
            created_at: createdTime ? new Date(createdTime * 1000).toISOString() : new Date().toISOString(),
          });
        } catch {}
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[meta-leads] Erro:", e);
    return NextResponse.json({ ok: true }); // Sempre retornar 200 pro Meta não retentar
  }
}
