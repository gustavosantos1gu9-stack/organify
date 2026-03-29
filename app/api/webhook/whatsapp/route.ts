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
        .select("id, evolution_url, evolution_key, whatsapp_numero, meta_pixel_id, meta_token, meta_ativo")
        .eq("whatsapp_instancia", instanciaName).single();
      if (!agencia) {
        console.error("Webhook: agência não encontrada para instância:", instanciaName);
        return NextResponse.json({ ok: true });
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
        const { data: nova, error: insertErr } = await supabase.from("conversas").insert({
          agencia_id: agencia.id, instancia: instanciaName,
          contato_numero: numero, contato_nome: nome, contato_foto: foto,
          contato_jid: remoteJid,
          ultima_mensagem: conteudo, ultima_mensagem_at: timestamp,
          primeira_mensagem_at: timestamp, nao_lidas: 1,
          origem: isLid ? "Meta Ads" : "Não Rastreada",
        }).select().single();
        if (insertErr) {
          console.error("Webhook: erro ao criar conversa:", insertErr.message, { numero, nome });
          return NextResponse.json({ ok: false, error: insertErr.message }, { status: 500 });
        }
        conversa = nova;
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

      // 0. Se @lid (Click-to-WhatsApp), buscar rastreamento recente pelo número de destino
      if (isLid && eraNovaConversa) {
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

      // 1. Tentar por número do lead
      if (!tracking) {
        const { data: t1 } = await supabase.from("rastreamentos_pendentes")
          .select("*").eq("wa_numero", numero).single();
        if (t1) tracking = t1;
      }

      // 2. Buscar rastreamento recente (até 24h) — pelo wa_destino da agência
      // Sem restrição de isPrimeiraMsg para links (a janela de tempo já filtra)
      if (!tracking) {
        const vintQuatroHAtras = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: recentes } = await supabase.from("rastreamentos_pendentes")
          .select("*")
          .gt("created_at", vintQuatroHAtras)
          .or(`wa_destino.eq.${agencia.whatsapp_numero},wa_destino.is.null`)
          .order("created_at", { ascending: false })
          .limit(30);

        if (recentes && recentes.length > 0) {
          const candidato = recentes.find((r: any) => {
            if (!r.utm_campaign && !r.link_id && !r.fbclid) return false;
            // wa_numero não deve ser número de telefone real (já associado a outro lead)
            const isNumeroReal = /^\d{10,15}$/.test(r.wa_numero || "");
            return !isNumeroReal;
          });
          if (candidato) {
            tracking = candidato;
            // Marcar como usado (gravar o número do lead)
            await supabase.from("rastreamentos_pendentes")
              .update({ wa_numero: numero })
              .eq("wa_numero", candidato.wa_numero);
          }
        }
      }

      // 3. Tentar pelo fbclid/ctwaClid embutido na mensagem do WhatsApp (anúncios Meta)
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

        // 5. Se tem externalAdReply mas não achou rastreamento — criar inline
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

        // 6. Se veio via @lid mas não achou nenhum tracking
        if (!tracking && isLid) {
          tracking = {
            utm_source: "meta",
            utm_campaign: externalAdReply?.title || externalAdReply?.body || "",
            utm_content: sourceId || "",
            utm_medium: externalAdReply?.mediaType || "",
            fbclid: ctwaClid || "",
            origem: "Meta Ads",
            link_id: null,
          };
        }
      }

      // 7. FALLBACK: tentar match por conteúdo da mensagem com links_campanha
      if (!tracking && eraNovaConversa && conteudo) {
        const { data: links } = await supabase.from("links_campanha")
          .select("id, nome, wa_mensagem, utm_campaign, link_gerado")
          .eq("agencia_id", agencia.id);

        if (links?.length) {
          const msgNorm = conteudo.toLowerCase().replace(/[^\w\sáéíóúâêôãõàçü]/g, "").replace(/\s+/g, " ").trim();
          for (const link of links) {
            const linkMsgNorm = (link.wa_mensagem || "").toLowerCase().replace(/[^\w\sáéíóúâêôãõàçü]/g, "").replace(/\s+/g, " ").trim();
            if (!linkMsgNorm || linkMsgNorm.length < 5) continue;

            if (msgNorm === linkMsgNorm || msgNorm.includes(linkMsgNorm) || linkMsgNorm.includes(msgNorm)) {
              // Extrair UTMs do link gerado (suporta URL relativa)
              const params: Record<string, string> = {};
              try {
                const url = new URL(link.link_gerado);
                url.searchParams.forEach((v, k) => { params[k] = v; });
              } catch {
                const qIdx = (link.link_gerado || "").indexOf("?");
                if (qIdx >= 0) {
                  for (const pair of link.link_gerado.substring(qIdx + 1).split("&")) {
                    const [k, ...v] = pair.split("=");
                    if (k) params[decodeURIComponent(k)] = decodeURIComponent(v.join("=") || "");
                  }
                }
              }

              tracking = {
                utm_source: params.utm_source || "facebook",
                utm_medium: params.utm_medium || "cpc",
                utm_campaign: params.utm_campaign || link.utm_campaign || link.nome.toLowerCase().replace(/\s+/g, "-"),
                utm_content: params.utm_content || "",
                utm_term: params.utm_term || "",
                fbclid: "",
                origem: "Meta Ads",
                link_id: link.id,
                _link_nome: params.link_nome || link.nome,
              };
              break;
            }
          }
        }
      }

      // ============================================
      // APLICAR RASTREAMENTO
      // ============================================
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
