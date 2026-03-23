import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://salxconvert-blond.vercel.app";

async function verificarTermoChave(agenciaId: string, conversaId: string, conteudo: string, numero: string, fbclid?: string, utmCampaign?: string, utmContent?: string) {
  const { data: etapas } = await supabase.from("jornada_etapas")
    .select("nome, termo_chave, evento_conversao")
    .eq("agencia_id", agenciaId)
    .not("termo_chave", "is", null);

  if (!etapas?.length) return;

  const conteudoLower = conteudo.toLowerCase();
  const etapaEncontrada = etapas.find((e: any) =>
    e.termo_chave && conteudoLower.includes(e.termo_chave.toLowerCase())
  );

  if (!etapaEncontrada) return;

  await supabase.from("conversas").update({
    etapa_jornada: etapaEncontrada.nome,
    etapa_alterada_at: new Date().toISOString(),
  }).eq("id", conversaId);

  if (etapaEncontrada.evento_conversao) {
    fetch(`${APP_URL}/api/pixel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agencia_id: agenciaId,
        conversa_id: conversaId,
        etapa_nome: etapaEncontrada.nome,
        phone: numero,
        fbclid, utm_campaign: utmCampaign, utm_content: utmContent,
      }),
    }).catch(() => {});
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event, data, instance } = body;

    if (event === "messages.upsert" || event === "MESSAGES_UPSERT") {
      const msg = data?.messages?.[0] || data;
      if (!msg) return NextResponse.json({ ok: true });

      const fromMe = msg.key?.fromMe || false;
      const remoteJid = msg.key?.remoteJid || "";

      if (!remoteJid || remoteJid.includes("@g.us") || remoteJid.includes("@lid")) {
        return NextResponse.json({ ok: true });
      }

      const instanciaName = instance || body.instanceName || "";
      const numero = remoteJid.replace("@s.whatsapp.net", "");
      const msgId = msg.key?.id;
      const timestamp = msg.messageTimestamp
        ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
        : new Date().toISOString();

      // Extrair conteúdo
      let tipo = "text"; let conteudo = "";
      const m = msg.message;
      if (m?.conversation) conteudo = m.conversation;
      else if (m?.extendedTextMessage?.text) conteudo = m.extendedTextMessage.text;
      else if (m?.imageMessage) { tipo = "image"; conteudo = m.imageMessage.caption || "📷 Imagem"; }
      else if (m?.audioMessage) { tipo = "audio"; conteudo = "🎵 Áudio"; }
      else if (m?.videoMessage) { tipo = "video"; conteudo = m.videoMessage.caption || "🎥 Vídeo"; }
      else if (m?.documentMessage) { tipo = "document"; conteudo = m.documentMessage.fileName || "📄 Documento"; }
      else if (m?.stickerMessage) { tipo = "sticker"; conteudo = "😄 Sticker"; }
      else conteudo = "Mensagem";

      // Mensagens fromMe — salvar no banco e verificar termo-chave
      if (fromMe) {
        const { data: ag } = await supabase.from("agencias")
          .select("id").eq("whatsapp_instancia", instanciaName).single();
        if (ag) {
          const { data: conv } = await supabase.from("conversas")
            .select("id, fbclid, utm_campaign, utm_content")
            .eq("agencia_id", ag.id).eq("contato_numero", numero).single();
          if (conv) {
            // Salvar mensagem enviada no banco
            if (msgId && conteudo) {
              await supabase.from("mensagens").upsert({
                conversa_id: conv.id, agencia_id: ag.id,
                mensagem_id: msgId, de_mim: true, tipo, conteudo, created_at: timestamp,
              }, { onConflict: "mensagem_id" });
              // Atualizar última mensagem da conversa
              await supabase.from("conversas").update({
                ultima_mensagem: conteudo, ultima_mensagem_at: timestamp,
              }).eq("id", conv.id);
            }
            // Verificar termo-chave
            if (conteudo) {
              await verificarTermoChave(ag.id, conv.id, conteudo, numero, conv.fbclid, conv.utm_campaign, conv.utm_content);
            }
          }
        }
        return NextResponse.json({ ok: true });
      }

      // Mensagens do lead — processar normalmente
      const { data: agencia } = await supabase.from("agencias")
        .select("id, evolution_url, evolution_key, whatsapp_numero, meta_pixel_id, meta_token, meta_ativo")
        .eq("whatsapp_instancia", instanciaName).single();
      if (!agencia) return NextResponse.json({ ok: true });

      const nome = msg.pushName || numero;

      // Buscar foto
      let foto = null;
      try {
        const resPerfil = await fetch(`${agencia.evolution_url}/chat/fetchProfile/${instanciaName}`, {
          method: "POST",
          headers: { "apikey": agencia.evolution_key, "Content-Type": "application/json" },
          body: JSON.stringify({ number: numero }),
        });
        const perfil = await resPerfil.json();
        if (perfil?.picture) foto = perfil.picture;
      } catch {}

      // Buscar ou criar conversa
      let { data: conversa } = await supabase.from("conversas")
        .select("*").eq("agencia_id", agencia.id).eq("contato_numero", numero).single();

      if (!conversa) {
        const { data: nova } = await supabase.from("conversas").insert({
          agencia_id: agencia.id, instancia: instanciaName,
          contato_numero: numero, contato_nome: nome, contato_foto: foto,
          ultima_mensagem: conteudo, ultima_mensagem_at: timestamp,
          primeira_mensagem_at: timestamp, nao_lidas: 1, origem: "Não Rastreada",
        }).select().single();
        conversa = nova;
      } else {
        await supabase.from("conversas").update({
          ultima_mensagem: conteudo, ultima_mensagem_at: timestamp,
          contato_nome: nome,
          nao_lidas: (conversa.nao_lidas || 0) + 1,
        }).eq("id", conversa.id);
      }

      // Salvar mensagem
      if (conversa && msgId) {
        await supabase.from("mensagens").upsert({
          conversa_id: conversa.id, agencia_id: agencia.id,
          mensagem_id: msgId, de_mim: false, tipo, conteudo, created_at: timestamp,
        }, { onConflict: "mensagem_id" });

        // Cruzar com rastreamento pendente
        let tracking = null;

        // 1. Tentar por número do lead
        const { data: t1 } = await supabase.from("rastreamentos_pendentes")
          .select("*").eq("wa_numero", numero).single();
        if (t1) tracking = t1;

        // 2. Buscar rastreamento recente (até 60 min) — lead passou pelo link e mandou mensagem
        if (!tracking) {
          const umHoraAtras = new Date(Date.now() - 60 * 60 * 1000).toISOString();
          const { data: recentes } = await supabase.from("rastreamentos_pendentes")
            .select("*")
            .gt("created_at", umHoraAtras)
            .not("wa_numero", "like", "55%") // excluir números de telefone já associados
            .order("created_at", { ascending: false })
            .limit(10);

          if (recentes && recentes.length > 0) {
            const candidato = recentes.find((r: any) =>
              r.utm_campaign || r.link_id || r.fbclid
            );
            if (candidato) {
              tracking = candidato;
              // Atualizar com o número real do lead para não associar a outro
              await supabase.from("rastreamentos_pendentes")
                .update({ wa_numero: numero })
                .eq("wa_numero", candidato.wa_numero);
            }
          }
        }

        // 2. Tentar pelo fbclid/ctwaClid que vem embutido na mensagem do WhatsApp
        if (!tracking) {
          const externalAdReply = msg.message?.extendedTextMessage?.contextInfo?.externalAdReply
            || msg.message?.imageMessage?.contextInfo?.externalAdReply
            || msg.message?.videoMessage?.contextInfo?.externalAdReply;

          const ctwaClid = externalAdReply?.ctwaClid || null;
          const sourceId = externalAdReply?.sourceId || null;
          const sourceUrl = externalAdReply?.sourceUrl || null;

          // Tentar por fbclid exato
          if (ctwaClid) {
            const { data: t2 } = await supabase.from("rastreamentos_pendentes")
              .select("*").eq("fbclid", ctwaClid).single();
            if (t2) { tracking = t2; }
            else {
              // Tentar por wa_numero = ctwaClid (salvo pela API captura)
              const { data: t2b } = await supabase.from("rastreamentos_pendentes")
                .select("*").eq("wa_numero", ctwaClid).single();
              if (t2b) tracking = t2b;
            }
          }

          // 3. Tentar por utm_campaign via sourceUrl
          if (!tracking && sourceUrl) {
            try {
              const refUrl = new URL(sourceUrl);
              const refCampaign = refUrl.searchParams.get("utm_campaign");
              const refSource = refUrl.searchParams.get("utm_source");
              const refFbclid = refUrl.searchParams.get("fbclid");
              if (refFbclid) {
                const { data: t3 } = await supabase.from("rastreamentos_pendentes")
                  .select("*").eq("fbclid", refFbclid).single();
                if (t3) tracking = t3;
              }
              if (!tracking && refCampaign) {
                const { data: t4 } = await supabase.from("rastreamentos_pendentes")
                  .select("*").eq("utm_campaign", refCampaign)
                  .order("created_at", { ascending: false }).limit(1).single();
                if (t4) tracking = t4;
              }
              // Se achou sourceUrl mas não rastreamento, criar inline
              if (!tracking && (refSource || refCampaign)) {
                tracking = {
                  utm_source: refSource || externalAdReply?.mediaType || "ig",
                  utm_campaign: refCampaign || "",
                  utm_content: refUrl.searchParams.get("utm_content") || sourceId || "",
                  utm_medium: refUrl.searchParams.get("utm_medium") || "",
                  fbclid: refFbclid || ctwaClid || "",
                  origem: "Meta Ads",
                  link_id: null,
                };
              }
            } catch {}
          }

          // 4. Se tem externalAdReply mas não achou rastreamento — criar inline com dados disponíveis
          if (!tracking && externalAdReply && (externalAdReply.title || externalAdReply.body)) {
            tracking = {
              utm_source: "ig",
              utm_campaign: externalAdReply.title || externalAdReply.body || "",
              utm_content: sourceId || "",
              utm_medium: "Instagram_Feed",
              fbclid: ctwaClid || "",
              origem: "Meta Ads",
              link_id: null,
            };
          }
        }

        if (tracking) {
          // Se utm_term contém um UUID, é o link_id
          const linkIdFromTerm = tracking.utm_term && tracking.utm_term.match(/^[0-9a-f-]{36}$/)
            ? tracking.utm_term : tracking.link_id;

          await supabase.from("conversas").update({
            origem: tracking.origem || "Meta Ads",
            utm_source: tracking.utm_source,
            utm_medium: tracking.utm_medium,
            utm_campaign: tracking.utm_campaign,
            utm_content: tracking.utm_content,
            utm_term: tracking.utm_term,
            fbclid: tracking.fbclid,
            link_id: linkIdFromTerm,
            primeira_mensagem_at: timestamp,
          }).eq("id", conversa.id);

          // Buscar nome do link se tiver link_id
          if (linkIdFromTerm) {
            const { data: linkData } = await supabase.from("links_campanha")
              .select("nome").eq("id", linkIdFromTerm).single();
            if (linkData?.nome) {
              await supabase.from("conversas").update({ link_nome: linkData.nome }).eq("id", conversa.id);
            }
            // Incrementar cliques
            await supabase.rpc("incrementar_cliques", { link_uuid: linkIdFromTerm }).catch(() => {});
          }
          // Limpar rastreamento por número e fbclid
          await supabase.from("rastreamentos_pendentes").delete().eq("wa_numero", numero);
          if (tracking.fbclid) {
            await supabase.from("rastreamentos_pendentes").delete().eq("fbclid", tracking.fbclid);
          }
          if (tracking.link_id) {
            await supabase.rpc("incrementar_cliques", { link_uuid: tracking.link_id });
          }
        } else {
          await supabase.from("conversas").update({
            primeira_mensagem_at: timestamp,
            origem: conversa.origem || "Não Rastreada",
          }).eq("id", conversa.id).is("primeira_mensagem_at", null);
        }

        // Verificar termo-chave na mensagem do lead
        await verificarTermoChave(
          agencia.id, conversa.id, conteudo, numero,
          conversa.fbclid, conversa.utm_campaign, conversa.utm_content
        );

        // Disparar pixel SOMENTE se veio de anúncio
        // Dispara para novo contato E para quem voltou por anúncio (tem tracking novo)
        const veioDeAnuncio = tracking?.fbclid || tracking?.utm_source ||
          tracking?.origem === "Meta Ads" || tracking?.origem === "Google Ads";

        if (veioDeAnuncio) {
          const { data: etapaPrimeiro } = await supabase.from("jornada_etapas")
            .select("nome").eq("agencia_id", agencia.id).eq("eh_primeiro_contato", true).single();
          const nomeEtapa = etapaPrimeiro?.nome || "Entrou em contato";
          fetch(`${APP_URL}/api/pixel`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              agencia_id: agencia.id,
              conversa_id: conversa.id,
              etapa_nome: nomeEtapa,
              phone: numero,
              fbclid: tracking?.fbclid,
              utm_campaign: tracking?.utm_campaign,
              utm_content: tracking?.utm_content,
            }),
          }).catch(() => {});
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch(e) {
    console.error("Webhook erro:", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "webhook ativo" });
}
