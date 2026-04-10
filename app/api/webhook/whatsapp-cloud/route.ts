import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const VERIFY_TOKEN = process.env.WHATSAPP_CLOUD_VERIFY_TOKEN || "salxconvert_verify_2026";

// GET: Verificação do webhook (Meta manda um challenge na configuração)
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// POST: Receber mensagens e status updates
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Meta envia o payload dentro de entry[].changes[]
    const entries = body.entry || [];

    for (const entry of entries) {
      const changes = entry.changes || [];

      for (const change of changes) {
        if (change.field !== "messages") continue;

        const value = change.value;
        const metadata = value.metadata || {};
        const phoneNumberId = metadata.phone_number_id; // ID do número que recebeu
        const displayPhone = metadata.display_phone_number; // Número exibido

        // Mensagens recebidas
        const messages = value.messages || [];
        const contacts = value.contacts || [];

        for (const msg of messages) {
          const from = msg.from; // Número de quem enviou (formato: 5511999999999)
          const msgId = msg.id;
          const timestamp = msg.timestamp;
          const tipo = msg.type; // text, image, audio, video, document, sticker, etc
          const contactInfo = contacts.find((c: any) => c.wa_id === from);
          const nome = contactInfo?.profile?.name || "";

          // Extrair conteúdo baseado no tipo
          let conteudo = "";
          if (tipo === "text") {
            conteudo = msg.text?.body || "";
          } else if (tipo === "image") {
            conteudo = msg.image?.caption || "[Imagem]";
          } else if (tipo === "video") {
            conteudo = msg.video?.caption || "[Vídeo]";
          } else if (tipo === "audio") {
            conteudo = "[Áudio]";
          } else if (tipo === "document") {
            conteudo = msg.document?.filename || "[Documento]";
          } else if (tipo === "sticker") {
            conteudo = "[Sticker]";
          } else if (tipo === "reaction") {
            conteudo = msg.reaction?.emoji || "[Reação]";
          } else if (tipo === "location") {
            conteudo = `[Localização: ${msg.location?.latitude},${msg.location?.longitude}]`;
          } else if (tipo === "contacts") {
            conteudo = "[Contato]";
          } else if (tipo === "interactive") {
            conteudo = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || "[Interativo]";
          } else if (tipo === "button") {
            conteudo = msg.button?.text || "[Botão]";
          }

          // Referral: dados de anúncio (CTWA - Click to WhatsApp Ad)
          const referral = msg.referral;
          let fbclid: string | null = null;
          let utmSource: string | null = null;
          let utmCampaign: string | null = null;
          let utmContent: string | null = null;
          let nomeAnuncio: string | null = null;
          let origem = "Não Rastreada";

          if (referral) {
            // CTWA: anúncio de Click-to-WhatsApp
            fbclid = referral.ctwa_clid || null;
            utmSource = referral.source_type || "Meta Ads";
            origem = "Meta Ads";
            // Buscar dados da campanha se possível
            if (referral.headline) nomeAnuncio = referral.headline;
            if (referral.body) utmContent = referral.body;
            if (referral.source_url) utmCampaign = referral.source_url;
          }

          // Buscar agência pelo phone_number_id
          const { data: agencia } = await supabase
            .from("agencias")
            .select("id, meta_pixel_id, meta_token, meta_ativo")
            .eq("whatsapp_cloud_phone_id", phoneNumberId)
            .single();

          if (!agencia) {
            console.log(`[cloud-webhook] phone_number_id ${phoneNumberId} não vinculado a nenhuma agência`);
            continue;
          }

          // Verificar se conversa já existe
          const numero = from.startsWith("55") ? from : `55${from}`;
          const { data: convExistente } = await supabase
            .from("conversas")
            .select("id, etapa_jornada, fbclid, utm_campaign, utm_content, origem")
            .eq("agencia_id", agencia.id)
            .eq("contato_numero", numero)
            .single();

          const agora = new Date().toISOString();
          let conversaId: string;
          let eraNovaConversa = false;

          if (convExistente) {
            conversaId = convExistente.id;
            // Atualizar última mensagem
            const updateData: Record<string, any> = {
              ultima_mensagem: conteudo,
              ultima_mensagem_at: agora,
              contato_nome: nome || undefined,
            };
            // Se tinha referral e conversa não tinha rastreamento, atualizar
            if (referral && (!convExistente.fbclid && !convExistente.utm_campaign)) {
              updateData.fbclid = fbclid;
              updateData.utm_source = utmSource;
              updateData.utm_campaign = utmCampaign;
              updateData.utm_content = utmContent;
              updateData.nome_anuncio = nomeAnuncio;
              updateData.origem = origem;
            }
            await supabase.from("conversas").update(updateData).eq("id", conversaId);
          } else {
            // Criar nova conversa
            eraNovaConversa = true;
            const { data: novaConv, error: convErr } = await supabase.from("conversas").insert({
              agencia_id: agencia.id,
              instancia: `cloud-${phoneNumberId}`,
              contato_numero: numero,
              contato_nome: nome,
              contato_jid: `${from}@s.whatsapp.net`,
              ultima_mensagem: conteudo,
              ultima_mensagem_at: agora,
              primeira_mensagem_at: agora,
              nao_lidas: 1,
              origem,
              fbclid,
              utm_source: utmSource,
              utm_campaign: utmCampaign,
              utm_content: utmContent,
              nome_anuncio: nomeAnuncio,
            }).select("id").single();

            if (convErr) {
              console.error("[cloud-webhook] Erro ao criar conversa:", convErr.message);
              continue;
            }
            if (!novaConv) continue;
            conversaId = novaConv.id;
          }

          // Salvar mensagem
          await supabase.from("mensagens").insert({
            conversa_id: conversaId,
            agencia_id: agencia.id,
            mensagem_id: msgId,
            de_mim: false,
            tipo,
            conteudo,
            created_at: new Date(parseInt(timestamp) * 1000).toISOString(),
          });

          // Incrementar não lidas
          if (convExistente) {
            await supabase.from("conversas")
              .update({ nao_lidas: ((convExistente as any).nao_lidas || 0) + 1 })
              .eq("id", conversaId);
          }

          // Disparar pixel se veio de anúncio e é nova conversa
          if (referral && eraNovaConversa && agencia.meta_pixel_id && agencia.meta_token && agencia.meta_ativo) {
            const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://salxconvert-blond.vercel.app";
            const { data: etapaPrimeiro } = await supabase.from("jornada_etapas")
              .select("nome").eq("agencia_id", agencia.id).eq("eh_primeiro_contato", true).single();
            const nomeEtapa = etapaPrimeiro?.nome || "Entrou em contato";

            fetch(`${APP_URL}/api/pixel`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                agencia_id: agencia.id,
                conversa_id: conversaId,
                etapa_nome: nomeEtapa,
                phone: numero,
                contato_nome: nome,
                fbclid,
                utm_campaign: utmCampaign,
                utm_content: utmContent,
                is_ctwa: true,
              }),
            }).catch(() => {});
          }
        }

        // Status updates (sent, delivered, read)
        const statuses = value.statuses || [];
        for (const status of statuses) {
          // Pode usar pra atualizar status de entrega das mensagens enviadas
          // status.id, status.status (sent/delivered/read), status.recipient_id
          console.log(`[cloud-webhook] Status: ${status.status} para ${status.recipient_id}`);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[cloud-webhook] Erro:", e.message);
    return NextResponse.json({ ok: true }); // Sempre retornar 200 pra Meta não reenviar
  }
}
