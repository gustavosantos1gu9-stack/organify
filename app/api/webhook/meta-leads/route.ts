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

        // Buscar dados do lead na API do Meta
        const leadRes = await fetch(
          `https://graph.facebook.com/v21.0/${leadgenId}?access_token=${token}`
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

        // Buscar nome da campanha/anúncio
        let campanhaNome = "";
        let conjuntoNome = "";
        let criativoNome = "";
        if (adId && token) {
          try {
            const adRes = await fetch(
              `https://graph.facebook.com/v21.0/${adId}?fields=name,adset{name},campaign{name}&access_token=${token}`
            );
            const adData = await adRes.json();
            if (!adData.error) {
              campanhaNome = adData.campaign?.name || "";
              conjuntoNome = adData.adset?.name || "";
              criativoNome = adData.name || "";
            }
          } catch {}
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
          whatsapp_mensagem_inicial: `Formulário: ${formId} | Campanha: ${campanhaNome || "—"}`,
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
