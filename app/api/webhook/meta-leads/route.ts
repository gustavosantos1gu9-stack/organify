import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { dispararEventoMeta } from "@/lib/meta-pixel";

export const dynamic = "force-dynamic";

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

        // Rotear para a agência correta pelo ad_account_id do anúncio
        // 1. Buscar todas as agências com pixel configurado
        const { data: todasAgencias } = await supabase.from("agencias")
          .select("id, nome, parent_id, meta_ad_account_id, meta_business_token, meta_token, meta_pixel_id, whatsapp_numero")
          .not("meta_pixel_id", "is", null);

        // 2. Usar token do master para buscar o ad e descobrir o account_id
        const master = todasAgencias?.find(a => !a.parent_id);
        const masterToken = master?.meta_business_token || master?.meta_token;

        let agenciaId = master?.id || "32cdce6e-4664-4ac6-979d-6d68a1a68745";
        let ag = master;

        // 3. Se veio ad_id no webhook, descobrir a qual conta pertence
        if (adId && masterToken) {
          try {
            const adAccountRes = await fetch(
              `https://graph.facebook.com/v21.0/${adId}?fields=account_id&access_token=${masterToken}`
            );
            const adAccountData = await adAccountRes.json();
            if (!adAccountData.error && adAccountData.account_id) {
              const accountId = adAccountData.account_id; // ex: "1482478279328236"
              const agenciaMatch = todasAgencias?.find(a =>
                a.meta_ad_account_id === accountId || a.meta_ad_account_id === `act_${accountId}`
              );
              if (agenciaMatch) {
                agenciaId = agenciaMatch.id;
                ag = agenciaMatch;
                console.log(`[meta-leads] Roteado para agência: ${agenciaMatch.nome} (${agenciaId})`);
              }
            }
          } catch (e) {
            console.error("[meta-leads] Erro ao descobrir account_id do ad:", e);
          }
        }

        // Para buscar leads: meta_token (leads_retrieval). Para buscar campanha/ad: meta_business_token (ads_read).
        const token = ag?.meta_token || ag?.meta_business_token || masterToken;
        const adsToken = ag?.meta_business_token || masterToken || ag?.meta_token;
        if (!token) {
          console.error("[meta-leads] Sem token para agência", agenciaId);
          continue;
        }

        // Buscar dados do lead na API do Meta (incluindo ad_id, campaign, adset)
        const leadRes = await fetch(
          `https://graph.facebook.com/v21.0/${leadgenId}?fields=field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,platform,created_time&access_token=${adsToken}`
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

        const nome = fields.full_name || fields.nome || fields.first_name
          || fields.name || fields.full_name || "Lead Formulário";
        const email = fields.email || fields.e_mail || null;
        // Extrair telefone de qualquer nome de campo comum em formulários Meta
        const telefone = fields.phone_number || fields.whatsapp || fields.telefone
          || fields.celular || fields.phone || fields.mobile || fields.numero
          || fields.tel || fields.contato || null;
        const cidade = fields.city || fields.cidade || null;

        // utm_source baseado na plataforma do formulário
        const utmSourceLead = leadData.platform === "ig" ? "ig" : "facebook";

        // Buscar nome da campanha/conjunto/anúncio
        // Primeiro tenta usar os dados que vieram direto do lead
        let campanhaNome = leadData.campaign_name || "";
        let conjuntoNome = leadData.adset_name || "";
        let criativoNome = leadData.ad_name || "";
        const resolvedAdId = adId || leadData.ad_id;

        // Se não veio direto do lead, buscar pelo ad_id
        if ((!campanhaNome || !conjuntoNome || !criativoNome) && resolvedAdId && adsToken) {
          try {
            const adRes = await fetch(
              `https://graph.facebook.com/v21.0/${resolvedAdId}?fields=name,adset{id,name},campaign{id,name}&access_token=${adsToken}`
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

        // Buscar nome do formulário para identificar qual form originou o lead
        const resolvedFormId = formId || leadData.form_id;
        let formNome = "";
        if (resolvedFormId && adsToken) {
          try {
            const formRes = await fetch(
              `https://graph.facebook.com/v21.0/${resolvedFormId}?fields=name&access_token=${adsToken}`
            );
            const formData = await formRes.json();
            if (!formData.error && formData.name) formNome = formData.name;
          } catch (e) {
            console.error("[meta-leads] Erro ao buscar form name:", e);
          }
        }

        console.log("[meta-leads] Tracking:", { campanhaNome, conjuntoNome, criativoNome, adId, resolvedAdId, formNome });

        // Deduplicação: verificar se este leadgen_id já foi processado
        const { data: leadExistente } = await supabase
          .from("leads")
          .select("id")
          .eq("agencia_id", agenciaId)
          .eq("leadgen_id", leadgenId)
          .maybeSingle();

        if (leadExistente) {
          console.log("[meta-leads] Lead duplicado ignorado — leadgen_id já existe:", leadgenId);
          continue;
        }

        // Criar lead no CRM — antes do bloco de conversa para ter leadCrmId disponível
        const { data: leadCriado, error: errLead } = await supabase.from("leads").insert({
          agencia_id: agenciaId,
          nome,
          email,
          telefone,
          etapa: "novo",
          utm_source: utmSourceLead,
          utm_medium: "leadform",
          utm_campaign: campanhaNome || formNome,
          utm_content: conjuntoNome,
          utm_term: criativoNome || formNome,
          leadgen_id: leadgenId,
          meta_campaign_id: leadData.campaign_id || null,
          meta_adset_id:    leadData.adset_id    || null,
          meta_ad_id:       leadData.ad_id       || null,
          whatsapp_mensagem_inicial: `Formulário: ${formNome || resolvedFormId || formId} | Campanha: ${campanhaNome || "—"} | Conjunto: ${conjuntoNome || "—"} | Anúncio: ${criativoNome || "—"}`,
          observacoes: Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join("\n"),
        }).select("id").single();

        const leadCrmId = leadCriado?.id || null;

        if (errLead) {
          console.error("[meta-leads] Erro ao criar lead:", JSON.stringify(errLead));
        } else {
          console.log("[meta-leads] Lead criado:", nome, telefone, "leadgen:", leadgenId, "lead_id:", leadCrmId);
        }

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
              utm_campaign: campanhaNome || formNome,
              utm_content: conjuntoNome,
              utm_term: criativoNome || formNome,
              origem: "Formulário Meta",
              leadgen_id: leadgenId,
              wa_destino: ag?.whatsapp_numero || null,
            });
            console.log("[meta-leads] Rastreamento pendente salvo:", phoneNorm);
          } catch (e) {
            console.error("[meta-leads] Erro ao salvar rastreamento:", e);
          }

          // ── ATUALIZAR CONVERSA EXISTENTE COM leadgen_id ──
          // Caso o lead já tenha entrado em contato antes de preencher o formulário,
          // ou a mensagem chegou antes do webhook do Meta (webhook pode atrasar horas).
          // Garantir que a conversa tenha leadgen_id para que eventos CAPI futuros
          // usem action_source:"crm" + lead_id e sejam atribuídos à campanha.
          try {
            // Gerar variantes do número para match robusto
            const variantesPhone: string[] = [phoneNorm];
            const semCC = phoneNorm.startsWith("55") ? phoneNorm.slice(2) : phoneNorm;
            if (!variantesPhone.includes(semCC)) variantesPhone.push(semCC);
            // com 9° dígito (12→13)
            if (semCC.length === 10) {
              variantesPhone.push("55" + semCC.slice(0,2) + "9" + semCC.slice(2));
              variantesPhone.push(semCC.slice(0,2) + "9" + semCC.slice(2));
            }
            // sem 9° dígito (13→12 ou 11→10)
            if (semCC.length === 11) {
              variantesPhone.push("55" + semCC.slice(0,2) + semCC.slice(3));
              variantesPhone.push(semCC.slice(0,2) + semCC.slice(3));
            }

            const { data: convExistente } = await supabase.from("conversas")
              .select("id, leadgen_id, utm_campaign, contato_nome")
              .eq("agencia_id", agenciaId)
              .in("contato_numero", variantesPhone)
              .is("leadgen_id", null)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (convExistente?.id) {
              // Atualizar contato_nome se a conversa só tem número como nome
              if (nome && nome !== "Lead Formulário" && /^\d+$/.test((convExistente as any).contato_nome?.trim() || "")) {
                await supabase.from("conversas").update({ contato_nome: nome }).eq("id", convExistente.id);
              }
              // Atualizar TODOS os campos de rastreamento (não só leadgen_id)
              const updateConv: Record<string, any> = {
                leadgen_id: leadgenId,
                lead_id: leadCrmId,       // permite pixel buscar email do lead
                origem: "Formulário Meta",
                utm_source: utmSourceLead,
                utm_medium: "leadform",
                utm_term: criativoNome || formNome || null,
                meta_campaign_id: leadData.campaign_id || null,
                meta_adset_id:    leadData.adset_id    || null,
                meta_ad_id:       leadData.ad_id       || null,
              };
              if ((campanhaNome || formNome) && (!convExistente.utm_campaign || convExistente.utm_campaign === "Formulário Instantâneo")) {
                updateConv.utm_campaign = campanhaNome || formNome;
                updateConv.utm_content = conjuntoNome;
              }
              await supabase.from("conversas").update(updateConv).eq("id", convExistente.id);
              console.log("[meta-leads] Conversa atualizada com rastreamento completo:", convExistente.id, leadgenId);

              // Disparar evento Fez Contato no CAPI (lead já foi contactado)
              // O evento Lead já foi disparado acima; Contact sinaliza que o contato foi feito
              const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.salxconvert.com.br";
              fetch(`${APP_URL}/api/pixel`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  agencia_id: agenciaId,
                  conversa_id: convExistente.id,
                  etapa_nome: "Fez Contato",
                  phone: telefone || undefined,
                  contato_nome: nome,
                  utm_campaign: campanhaNome,
                  utm_content: conjuntoNome,
                }),
              }).catch(() => {});
            }
          } catch (e) {
            console.error("[meta-leads] Erro ao atualizar conversa:", e);
          }
        }

        // Disparar evento "Lead" no CAPI com lead_id para atribuição nas colunas da campanha
        // IMPORTANTE: event_name deve ser "Lead" (não "Contact") para a campanha de formulário aprender
        // action_source "crm" + lead_id é obrigatório para Lead Ads (formulário)
        try {
          await dispararEventoMeta({
            pixel_id: ag!.meta_pixel_id || "",
            access_token: token!,
            event_name: "Lead",
            phone: telefone || undefined,
            contato_nome: nome,
            utm_campaign: campanhaNome,
            utm_content: conjuntoNome,
            lead_id: leadgenId,
            action_source: "crm",
            event_id: `leadform_${leadgenId}`,
          });
          console.log("[meta-leads] Evento Lead CAPI enviado para:", nome, telefone);
        } catch (e) {
          console.error("[meta-leads] Erro ao disparar CAPI Lead:", e);
        }

        // Salvar resposta no formulários_respostas (se tiver formulário vinculado)
        try {
          await supabase.from("formularios_respostas").insert({
            agencia_id: agenciaId,
            respostas: fields,
            created_at: createdTime ? new Date(createdTime * 1000).toISOString() : new Date().toISOString(),
          });
        } catch {}

        // Notificar grupo WhatsApp com TODAS as respostas do formulário (sem campanha/conjunto)
        try {
          // Campos fixos principais (nome, telefone, email, cidade) + todos os extras do form
          const camposFixos = [
            { label: "Origem", valor: "Formulário Instantâneo Meta" },
            { label: "Nome", valor: nome },
            { label: "Telefone", valor: telefone || "" },
            { label: "Email", valor: email || "" },
            { label: "Cidade", valor: cidade || "" },
          ].filter(c => c.valor);

          // Nomes de campos que já foram capturados nos fixos — evitar repetição
          const camposJaUsados = new Set([
            "full_name","nome","first_name","name","email","e_mail",
            "phone_number","whatsapp","telefone","celular","phone","mobile","numero",
            "tel","contato","city","cidade",
          ]);
          const camposExtras = Object.entries(fields)
            .filter(([k]) => !camposJaUsados.has(k))
            .map(([k, v]) => ({ label: k, valor: String(v) }));

          const camposMsg = [...camposFixos, ...camposExtras];

          await fetch(`https://www.salxconvert.com.br/api/notificar-grupo`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              agencia_id: agenciaId,
              titulo: "Meta Lead Ads",
              campos: camposMsg,
              telefone: telefone || "",
            }),
          }).catch(() => {});
        } catch {}
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[meta-leads] Erro:", e);
    return NextResponse.json({ ok: true }); // Sempre retornar 200 pro Meta não retentar
  }
}
