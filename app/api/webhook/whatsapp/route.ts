import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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

  // Buscar etapa anterior para histórico
  const { data: convAtual } = await supabase.from("conversas")
    .select("etapa_jornada").eq("id", conversaId).single();

  await supabase.from("conversas").update({
    etapa_jornada: etapaEncontrada.nome,
    etapa_alterada_at: new Date().toISOString(),
  }).eq("id", conversaId);

  // Registrar histórico de transição
  await supabase.from("etapas_historico").insert({
    conversa_id: conversaId, agencia_id: agenciaId,
    etapa_anterior: convAtual?.etapa_jornada || null,
    etapa_nova: etapaEncontrada.nome, alterado_por: "automatico",
  });

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

    // ── CONNECTION_UPDATE: atualizar status e tentar reconectar ──
    if (event === "connection.update" || event === "CONNECTION_UPDATE") {
      const state = (data?.state || data?.status || "").toLowerCase();
      const instanciaName = instance || body.instanceName || "";

      if (instanciaName) {
        // Buscar agência por instância
        const { data: ag } = await supabase.from("agencias")
          .select("id, parent_id, evolution_url, evolution_key")
          .eq("whatsapp_instancia", instanciaName).single();

        if (ag) {
          const conectado = state === "open" || state === "connected";
          await supabase.from("agencias").update({ whatsapp_conectado: conectado }).eq("id", ag.id);

          // Se desconectou, tentar reconectar automaticamente
          if (!conectado && (state === "close" || state === "connecting")) {
            try {
              // Buscar Evolution URL (da própria agência ou do parent)
              let evoUrl = ag.evolution_url || "";
              let evoKey = ag.evolution_key || "";
              if (!evoUrl && ag.parent_id) {
                const { data: parent } = await supabase.from("agencias")
                  .select("evolution_url, evolution_key")
                  .eq("id", ag.parent_id).single();
                if (parent) { evoUrl = parent.evolution_url || ""; evoKey = parent.evolution_key || ""; }
              }
              if (evoUrl && evoKey) {
                // Tentar reconectar a instância
                await fetch(`${evoUrl}/instance/connect/${instanciaName}`, {
                  headers: { apikey: evoKey },
                });
              }
            } catch {}
          }
        }
      }
      return NextResponse.json({ ok: true });
    }

    if (event === "messages.upsert" || event === "MESSAGES_UPSERT") {
      const msg = data?.messages?.[0] || data;
      if (!msg) return NextResponse.json({ ok: true });

      const fromMe = msg.key?.fromMe || false;
      const remoteJid = msg.key?.remoteJid || "";

      if (!remoteJid || remoteJid.includes("@g.us") || remoteJid.includes("@broadcast")) {
        return NextResponse.json({ ok: true });
      }

      const isLid = remoteJid.includes("@lid");
      const instanciaName = instance || body.instanceName || "";
      const numero = isLid
        ? remoteJid.replace("@lid", "")
        : remoteJid.replace("@s.whatsapp.net", "");
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
            if (msgId && conteudo) {
              await supabase.from("mensagens").upsert({
                conversa_id: conv.id, agencia_id: ag.id,
                mensagem_id: msgId, de_mim: true, tipo, conteudo, created_at: timestamp,
              }, { onConflict: "mensagem_id" });
              await supabase.from("conversas").update({
                ultima_mensagem: conteudo, ultima_mensagem_at: timestamp,
              }).eq("id", conv.id);
            }
            if (conteudo) {
              await verificarTermoChave(ag.id, conv.id, conteudo, numero, conv.fbclid, conv.utm_campaign, conv.utm_content);
            }
          }
        }
        return NextResponse.json({ ok: true });
      }

      // Mensagens do lead — processar normalmente
      const { data: agencia } = await supabase.from("agencias")
        .select("id, evolution_url, evolution_key, whatsapp_numero, meta_pixel_id, meta_token, meta_ativo, meta_business_token")
        .eq("whatsapp_instancia", instanciaName).single();
      if (!agencia) {
        console.error("Webhook: agência não encontrada para instância:", instanciaName);
        return NextResponse.json({ ok: true });
      }

      // Auto-salvar whatsapp_numero se ainda não tem (pega do participant da msg)
      if (!agencia.whatsapp_numero) {
        const meuNumero = msg.key?.participant?.replace("@s.whatsapp.net", "").replace(/\D/g, "")
          || remoteJid.replace("@s.whatsapp.net", "").replace(/\D/g, "");
        // O número do dono é quem NÃO é o remetente (se !fromMe, o remetente é o lead)
        // Buscar da instância via Evolution
        try {
          const instRes = await fetch(`${agencia.evolution_url}/instance/fetchInstances`, {
            headers: { apikey: agencia.evolution_key },
          });
          const instances = await instRes.json();
          if (Array.isArray(instances)) {
            const inst = instances.find((i: any) => (i.name || i.instance?.instanceName) === instanciaName);
            const owner = inst?.owner?.replace("@s.whatsapp.net", "").replace(/\D/g, "")
              || inst?.instance?.owner?.replace("@s.whatsapp.net", "").replace(/\D/g, "");
            if (owner) {
              await supabase.from("agencias").update({ whatsapp_numero: owner }).eq("id", agencia.id);
              agencia.whatsapp_numero = owner;
            }
          }
        } catch {}
      }

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
      let eraNovaConversa = false;
      let { data: conversa } = await supabase.from("conversas")
        .select("*").eq("agencia_id", agencia.id).eq("contato_numero", numero).single();

      if (!conversa) {
        eraNovaConversa = true;
        // Tentar inserir — se já existe (race condition), buscar a existente
        const { data: nova, error: insertErr } = await supabase.from("conversas").insert({
          agencia_id: agencia.id, instancia: instanciaName,
          contato_numero: numero, contato_nome: nome, contato_foto: foto,
          contato_jid: remoteJid,
          ultima_mensagem: conteudo, ultima_mensagem_at: timestamp,
          primeira_mensagem_at: timestamp, nao_lidas: 1,
          origem: isLid ? "Meta Ads" : "Não Rastreada",
        }).select().single();
        if (insertErr) {
          // Race condition — conversa foi criada por outro request simultâneo
          const { data: existente } = await supabase.from("conversas")
            .select("*").eq("agencia_id", agencia.id).eq("contato_numero", numero).single();
          if (existente) {
            conversa = existente;
            eraNovaConversa = false;
          } else {
            console.error("Webhook: erro ao criar conversa:", insertErr.message, { numero, nome });
            return NextResponse.json({ ok: false, error: insertErr.message }, { status: 500 });
          }
        } else {
          conversa = nova;
        }
      } else {
        await supabase.from("conversas").update({
          ultima_mensagem: conteudo, ultima_mensagem_at: timestamp,
          contato_nome: nome,
          nao_lidas: (conversa.nao_lidas || 0) + 1,
        }).eq("id", conversa.id);
      }

      if (!conversa) return NextResponse.json({ ok: false, error: "Conversa não criada" }, { status: 500 });

      // Salvar mensagem
      if (msgId) {
        await supabase.from("mensagens").upsert({
          conversa_id: conversa.id, agencia_id: agencia.id,
          mensagem_id: msgId, de_mim: false, tipo, conteudo, created_at: timestamp,
        }, { onConflict: "mensagem_id" });
      }

      // ============================================
      // RASTREAMENTO — cruzar com dados pendentes
      // ============================================
      let tracking = null;

      // Detectar externalAdReply antecipadamente pra saber se é CTWA
      const _externalAdReply = msg.message?.extendedTextMessage?.contextInfo?.externalAdReply
        || msg.message?.imageMessage?.contextInfo?.externalAdReply
        || msg.message?.videoMessage?.contextInfo?.externalAdReply
        || msg.message?.documentMessage?.contextInfo?.externalAdReply
        || msg.message?.contactMessage?.contextInfo?.externalAdReply
        || msg.message?.locationMessage?.contextInfo?.externalAdReply
        || msg.message?.conversation?.contextInfo?.externalAdReply
        || msg.contextInfo?.externalAdReply
        || data?.contextInfo?.externalAdReply;
      const _isCTWA = !!_externalAdReply || !!(msg.message?.extendedTextMessage?.contextInfo?.ctwaClid);

      // 0. Se @lid (Click-to-WhatsApp) e NÃO é CTWA, buscar rastreamento pendente
      //    Se passou pela página de 5s, tem rastreamento pendente → associar
      if (isLid && eraNovaConversa && !_isCTWA) {
        const cincoMinAtras = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const { data: lidTrack } = await supabase.from("rastreamentos_pendentes")
          .select("*")
          .eq("wa_destino", agencia.whatsapp_numero)
          .gt("created_at", cincoMinAtras)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        if (lidTrack) tracking = lidTrack;
      }

      // 1. Tentar por número do lead (só se não é CTWA e sem tracking ainda)
      if (!tracking && !_isCTWA) {
        const { data: t1 } = await supabase.from("rastreamentos_pendentes")
          .select("*").eq("wa_numero", numero).single();
        if (t1) tracking = t1;
      }

      // 2. Detectar externalAdReply (CTWA) — prioridade máxima
      {
        const externalAdReply = _externalAdReply;
        const ctwaClid = externalAdReply?.ctwaClid || msg.message?.extendedTextMessage?.contextInfo?.ctwaClid || null;
        const sourceId = externalAdReply?.sourceId || null;
        const sourceUrl = externalAdReply?.sourceUrl || null;

        // Tentar por fbclid exato
        if (ctwaClid) {
          const { data: t2 } = await supabase.from("rastreamentos_pendentes")
            .select("*").eq("fbclid", ctwaClid).single();
          if (t2) { tracking = t2; }
          else {
            const { data: t2b } = await supabase.from("rastreamentos_pendentes")
              .select("*").eq("wa_numero", ctwaClid).single();
            if (t2b) tracking = t2b;
          }
        }

        // 4. Tentar por utm_campaign via sourceUrl
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

        // 5. Se tem externalAdReply — extrair campanha, conjunto e criativo
        if (!tracking && externalAdReply) {
          // Tentar buscar nomes reais da campanha/conjunto/criativo via Meta Ads API
          let campanha = "";
          let conjunto = "";
          let criativo = "";

          // Se tem sourceId, tentar buscar dados do anúncio
          const adsToken = agencia.meta_business_token || agencia.meta_token;
          if (sourceId && adsToken) {
            try {
              const adRes = await fetch(`https://graph.facebook.com/v21.0/${sourceId}?fields=name,adset{name},campaign{name}&access_token=${adsToken}`);
              const adData = await adRes.json();
              if (adData && !adData.error) {
                criativo = adData.name || "";
                conjunto = adData.adset?.name || "";
                campanha = adData.campaign?.name || "";
              }
            } catch {}
          }

          // sourceId via Meta API é a fonte mais confiável — confiar nos dados retornados
          // A pessoa pode ter mudado a mensagem mas veio pelo anúncio/link
          tracking = {
            utm_source: externalAdReply.mediaType || "meta",
            utm_campaign: campanha || externalAdReply.title || externalAdReply.body || "",
            utm_content: conjunto ? `${conjunto}_${criativo}` : sourceId || "",
            utm_medium: externalAdReply.mediaType || "",
            fbclid: ctwaClid || "",
            origem: "Meta Ads",
            link_id: null,
            _nome_anuncio: criativo || externalAdReply.title || "",
          };
        }

        // 6. Se veio via @lid mas não achou nenhum tracking
        if (!tracking && isLid) {
          tracking = {
            utm_source: "meta",
            utm_campaign: "",
            utm_content: sourceId || "",
            utm_medium: "",
            fbclid: ctwaClid || "",
            origem: "Meta Ads",
            link_id: null,
          };
        }
      }

      // 6b. Buscar rastreamento pendente genérico — só se CTWA não resolveu e NÃO é @lid
      //     Se é @lid, já sabemos que é Meta Ads (passo 6 tratou), não associar a link
      if (!tracking && !isLid) {
        const cincoMinAtras = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const { data: recentes } = await supabase.from("rastreamentos_pendentes")
          .select("*")
          .gt("created_at", cincoMinAtras)
          .or(`wa_destino.eq.${agencia.whatsapp_numero},wa_destino.is.null`)
          .order("created_at", { ascending: false })
          .limit(30);

        if (recentes && recentes.length > 0) {
          // Normalizar mensagem para comparação
          const msgNorm = (conteudo || "").toLowerCase().replace(/[^\w\sáéíóúâêôãõàçü]/g, "").replace(/\s+/g, " ").trim();

          let candidato = null;
          for (const r of recentes) {
            if (!r.utm_campaign && !r.link_id && !r.fbclid) continue;
            const isNumeroReal = /^\d{10,15}$/.test(r.wa_numero || "");
            if (isNumeroReal) continue;

            // Se o candidato veio de link rastreável, validar mensagem antes de associar
            if (r.link_id && msgNorm) {
              const { data: linkData } = await supabase.from("links_campanha")
                .select("wa_mensagem").eq("id", r.link_id).single();
              if (linkData?.wa_mensagem) {
                const linkMsgNorm = linkData.wa_mensagem.toLowerCase().replace(/[^\w\sáéíóúâêôãõàçü]/g, "").replace(/\s+/g, " ").trim();
                if (linkMsgNorm.length >= 5 && (msgNorm === linkMsgNorm || msgNorm.includes(linkMsgNorm))) {
                  candidato = r;
                  break;
                }
                // Mensagem não bate com o link — pular este candidato
                continue;
              }
            }

            // Candidato sem link_id (fbclid direto, utm sem link) — aceitar
            candidato = r;
            break;
          }

          if (candidato) {
            tracking = candidato;
            await supabase.from("rastreamentos_pendentes")
              .update({ wa_numero: numero })
              .eq("wa_numero", candidato.wa_numero);
          }
        }
      }

      // 7. REMOVIDO: match por conteúdo da mensagem com links_campanha
      //    Causava falsos positivos — associava ao link pessoas que nunca passaram pela página de 5s.
      //    Agora só associa ao link quem tem rastreamento pendente (prova que passou pela página).

      // ============================================
      // APLICAR RASTREAMENTO
      // ============================================

      // 8. ENRIQUECER: se tem sourceId no externalAdReply, resolver campanha/conjunto/criativo
      //    Independente de qual passo definiu o tracking
      if (tracking && _externalAdReply?.sourceId) {
        const _sourceId = _externalAdReply.sourceId;
        const _ctwaClid = _externalAdReply.ctwaClid || msg.message?.extendedTextMessage?.contextInfo?.ctwaClid || "";
        const adsToken = agencia.meta_business_token || agencia.meta_token;
        if (adsToken) {
          try {
            const adRes = await fetch(`https://graph.facebook.com/v21.0/${_sourceId}?fields=name,adset%7Bname%7D,campaign%7Bname%7D&access_token=${adsToken}`);
            const adData = await adRes.json();
            if (adData && !adData.error) {
              tracking.utm_campaign = adData.campaign?.name || tracking.utm_campaign;
              tracking.utm_content = adData.adset?.name ? `${adData.adset.name}_${adData.name}` : tracking.utm_content;
              tracking._nome_anuncio = adData.name || tracking._nome_anuncio;
            }
          } catch {}
        }
        // Garantir fbclid do CTWA
        if (_ctwaClid && !tracking.fbclid) tracking.fbclid = _ctwaClid;
      }

      if (tracking) {
        const linkIdFromTerm = tracking.utm_term && tracking.utm_term.match(/^[0-9a-f-]{36}$/)
          ? tracking.utm_term : tracking.link_id;

        const isPrimeiro = eraNovaConversa || !conversa.primeira_mensagem_at;
        const semRastreio = !conversa.origem || conversa.origem === "Não Rastreada";

        // Atualizar conversa se: é primeira mensagem OU conversa ainda não tem rastreamento
        if (isPrimeiro || semRastreio) {
          const updateData: any = {
            origem: tracking.origem || "Meta Ads",
            utm_source: tracking.utm_source,
            utm_medium: tracking.utm_medium,
            utm_campaign: tracking.utm_campaign,
            utm_content: tracking.utm_content,
            utm_term: tracking.utm_term,
            fbclid: tracking.fbclid,
            link_id: linkIdFromTerm,
          };

          if (isPrimeiro) {
            updateData.primeira_mensagem_at = timestamp;
          }

          if (tracking._link_nome) {
            updateData.link_nome = tracking._link_nome;
          }
          if (tracking._nome_anuncio) {
            updateData.nome_anuncio = tracking._nome_anuncio;
          }

          await supabase.from("conversas").update(updateData).eq("id", conversa.id);

          if (linkIdFromTerm && !tracking._link_nome) {
            const { data: linkData } = await supabase.from("links_campanha")
              .select("nome").eq("id", linkIdFromTerm).single();
            if (linkData?.nome) {
              await supabase.from("conversas").update({ link_nome: linkData.nome }).eq("id", conversa.id);
            }
          }
        } else {
          // Já tem rastreamento — salvar como rastreamento adicional (histórico)
          try {
            await supabase.from("rastreamentos_historico").insert({
              conversa_id: conversa.id,
              agencia_id: agencia.id,
              contato_numero: numero,
              origem: tracking.origem || "Meta Ads",
              utm_source: tracking.utm_source,
              utm_medium: tracking.utm_medium,
              utm_campaign: tracking.utm_campaign,
              utm_content: tracking.utm_content,
              fbclid: tracking.fbclid,
              link_id: linkIdFromTerm,
              created_at: timestamp,
            });
          } catch {}
        }

        // Limpar rastreamentos pendentes
        await supabase.from("rastreamentos_pendentes").delete().eq("wa_numero", numero);
        if (tracking.fbclid) {
          await supabase.from("rastreamentos_pendentes").delete().eq("fbclid", tracking.fbclid);
        }
      } else {
        // Sem tracking — marcar primeira mensagem e agendar retry
        await supabase.from("conversas").update({
          primeira_mensagem_at: timestamp,
          origem: conversa.origem || "Não Rastreada",
        }).eq("id", conversa.id).is("primeira_mensagem_at", null);

        if (eraNovaConversa) {
          fetch(`${APP_URL}/api/webhook/retentar-rastreamento`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ conversa_id: conversa.id, numero, agencia_id: agencia.id, timestamp }),
          }).catch(() => {});
        }
      }

      // Verificar termo-chave na mensagem do lead
      await verificarTermoChave(
        agencia.id, conversa.id, conteudo, numero,
        conversa.fbclid || tracking?.fbclid, conversa.utm_campaign || tracking?.utm_campaign, conversa.utm_content || tracking?.utm_content
      );

      // Disparar pixel se veio de anúncio
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

    return NextResponse.json({ ok: true });
  } catch(e) {
    console.error("Webhook erro:", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "webhook ativo" });
}
