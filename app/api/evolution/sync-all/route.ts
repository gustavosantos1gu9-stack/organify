import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const maxDuration = 300; // 5 min para Vercel

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { agencia_id, offset = 0, lote = 50, com_mensagens = false } = body;

    // Buscar config da agência
    let { data: agencia } = await supabase.from("agencias")
      .select("id, evolution_url, evolution_key, whatsapp_instancia, whatsapp_numero, parent_id")
      .eq("id", agencia_id).single();

    // Se a agência filha não tem Evolution, herdar da mãe
    if (agencia && !agencia.evolution_url && agencia.parent_id) {
      const { data: parent } = await supabase.from("agencias")
        .select("evolution_url, evolution_key")
        .eq("id", agencia.parent_id).single();
      if (parent) {
        agencia = { ...agencia, evolution_url: parent.evolution_url, evolution_key: parent.evolution_key };
      }
    }

    if (!agencia?.evolution_url) return NextResponse.json({ error: "Agência não configurada" }, { status: 400 });

    const EVO_URL = agencia.evolution_url;
    const EVO_KEY = agencia.evolution_key;
    const INSTANCIA = agencia.whatsapp_instancia;
    const MEU_NUMERO = (agencia.whatsapp_numero || "").replace(/\D/g, "");

    // findChats — buscar TODOS (sem limite)
    const resChats = await fetch(`${EVO_URL}/chat/findChats/${INSTANCIA}`, {
      method: "POST",
      headers: { "apikey": EVO_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const chats = await resChats.json();
    const lista = Array.isArray(chats) ? chats : [];

    const individuais = lista.filter((c: any) => {
      const jid = c.remoteJid || c.id || "";
      if (jid.includes("@g.us") || jid.includes("@broadcast") || jid === "status@broadcast") return false;
      return jid.includes("@s.whatsapp.net") || jid.includes("@lid");
    });

    const loteAtual = individuais.slice(offset, offset + lote);
    let conversasSalvas = 0;
    let mensagensSalvas = 0;

    for (const chat of loteAtual) {
      const jid = chat.remoteJid || chat.id || "";
      const isLid = jid.includes("@lid");

      let numeroReal = "";
      if (isLid) {
        // Click-to-WhatsApp: buscar número real
        const alt = chat.lastMessage?.key?.remoteJidAlt
          || chat.participant
          || chat.name?.match?.(/\d{10,15}/)?.[0]
          || "";
        const altStr = typeof alt === "string" ? alt : "";
        if (altStr.includes("@s.whatsapp.net")) {
          numeroReal = altStr.replace("@s.whatsapp.net", "");
        } else if (/^\d{10,15}$/.test(altStr.replace(/\D/g, ""))) {
          numeroReal = altStr.replace(/\D/g, "");
        } else {
          // Tentar buscar via mensagens para descobrir o número
          try {
            const resMsgs = await fetch(`${EVO_URL}/chat/findMessages/${INSTANCIA}`, {
              method: "POST",
              headers: { "apikey": EVO_KEY, "Content-Type": "application/json" },
              body: JSON.stringify({ where: { key: { remoteJid: jid } }, limit: 5 }),
            });
            const msgsData = await resMsgs.json();
            const records = msgsData?.messages?.records || msgsData?.records || [];
            for (const r of records) {
              const rAlt = r.key?.remoteJidAlt || r.participant || "";
              if (rAlt.includes("@s.whatsapp.net")) {
                numeroReal = rAlt.replace("@s.whatsapp.net", "");
                break;
              }
            }
          } catch {}
          if (!numeroReal) continue;
        }
      } else {
        numeroReal = jid.replace("@s.whatsapp.net", "");
      }

      numeroReal = numeroReal.replace(/\D/g, "");
      if (!numeroReal || numeroReal === MEU_NUMERO) continue;
      if (numeroReal.length < 10 || numeroReal.length > 15) continue;

      // Nome: tentar vários campos possíveis
      const nome = chat.pushName
        || chat.name
        || chat.contact?.pushName
        || chat.contact?.name
        || chat.notify
        || chat.verifiedName
        || chat.formattedTitle
        || "";

      const foto = chat.profilePicUrl || chat.contact?.profilePicUrl || null;
      const lm = chat.lastMessage;
      const ultimaMsg = lm?.message?.conversation || lm?.message?.extendedTextMessage?.text || "";
      const ultimaAt = lm?.messageTimestamp
        ? new Date(Number(lm.messageTimestamp) * 1000).toISOString()
        : new Date().toISOString();
      const naoLidas = chat.unreadCount || 0;

      let { data: conversa } = await supabase.from("conversas")
        .select("id").eq("agencia_id", agencia.id).eq("contato_numero", numeroReal).single();

      if (!conversa) {
        const { data: nova } = await supabase.from("conversas").insert({
          agencia_id: agencia.id, instancia: INSTANCIA,
          contato_numero: numeroReal, contato_nome: nome || numeroReal, contato_foto: foto,
          contato_jid: jid,
          ultima_mensagem: ultimaMsg, ultima_mensagem_at: ultimaAt, nao_lidas: naoLidas,
        }).select("id").single();
        conversa = nova;
        conversasSalvas++;
      } else {
        // Atualizar nome só se veio um nome real (não sobrescrever com número)
        const updateData: any = {
          contato_foto: foto, contato_jid: jid,
          ultima_mensagem: ultimaMsg, ultima_mensagem_at: ultimaAt, nao_lidas: naoLidas,
        };
        if (nome) updateData.contato_nome = nome;
        await supabase.from("conversas").update(updateData).eq("id", conversa.id);
      }

      if (!com_mensagens || !conversa?.id) continue;

      // Buscar mensagens — paginar para pegar TODAS (ou até 500)
      let allMsgs: any[] = [];
      let page = 1;
      const PAGE_LIMIT = 100;
      const MAX_MSGS = 500;
      while (allMsgs.length < MAX_MSGS) {
        const resMsgs = await fetch(`${EVO_URL}/chat/findMessages/${INSTANCIA}`, {
          method: "POST",
          headers: { "apikey": EVO_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ where: { key: { remoteJid: jid } }, limit: PAGE_LIMIT, page }),
        });
        const msgsData = await resMsgs.json();
        const records = msgsData?.messages?.records || msgsData?.records || [];
        if (!records.length) break;
        allMsgs = allMsgs.concat(records);
        if (records.length < PAGE_LIMIT) break;
        page++;
      }

      const msgs = allMsgs
        .filter((m: any) => m.key?.id && (m.message || m.messageType))
        .sort((a: any, b: any) => Number(a.messageTimestamp) - Number(b.messageTimestamp));

      // Calcular primeira_mensagem_at a partir da mensagem mais antiga
      let primeiraMsgAt: string | null = null;
      let ultimaMsgAt: string | null = null;

      for (const msg of msgs) {
        const msgId = msg.key?.id;
        if (!msgId) continue;
        const fromMe = msg.key?.fromMe || false;
        const ts = Number(msg.messageTimestamp);
        if (!ts) continue;
        const timestamp = new Date(ts * 1000).toISOString();

        if (!primeiraMsgAt || timestamp < primeiraMsgAt) primeiraMsgAt = timestamp;
        if (!ultimaMsgAt || timestamp > ultimaMsgAt) ultimaMsgAt = timestamp;

        let tipo = "text"; let conteudo = "";
        const m = msg.message;
        if (!m) continue;
        if (m.conversation) conteudo = m.conversation;
        else if (m.extendedTextMessage?.text) conteudo = m.extendedTextMessage.text;
        else if (m.imageMessage) { tipo = "image"; conteudo = m.imageMessage.caption || "📷 Imagem"; }
        else if (m.audioMessage) { tipo = "audio"; conteudo = "🎵 Áudio"; }
        else if (m.videoMessage) { tipo = "video"; conteudo = "🎥 Vídeo"; }
        else if (m.documentMessage) { tipo = "document"; conteudo = m.documentMessage.fileName || "📄 Documento"; }
        else if (m.stickerMessage) { tipo = "sticker"; conteudo = "🏷️ Sticker"; }
        else if (m.contactMessage) { tipo = "text"; conteudo = `👤 ${m.contactMessage.displayName || "Contato"}`; }
        else if (m.locationMessage) { tipo = "text"; conteudo = "📍 Localização"; }
        else if (m.reactionMessage) continue; // ignorar reações
        else continue;

        const { error } = await supabase.from("mensagens").upsert({
          conversa_id: conversa.id, agencia_id: agencia.id,
          mensagem_id: msgId, de_mim: fromMe, tipo, conteudo, created_at: timestamp,
        }, { onConflict: "mensagem_id" });
        if (!error) mensagensSalvas++;
      }

      // Atualizar datas reais na conversa
      const conversaUpdate: any = {};
      if (primeiraMsgAt) conversaUpdate.primeira_mensagem_at = primeiraMsgAt;
      if (ultimaMsgAt) {
        conversaUpdate.ultima_mensagem_at = ultimaMsgAt;
        // Pegar conteúdo da última mensagem real
        const ultimaReal = msgs[msgs.length - 1];
        if (ultimaReal?.message) {
          const m = ultimaReal.message;
          conversaUpdate.ultima_mensagem = m.conversation || m.extendedTextMessage?.text
            || (m.imageMessage ? "📷 Imagem" : "")
            || (m.audioMessage ? "🎵 Áudio" : "")
            || (m.videoMessage ? "🎥 Vídeo" : "")
            || (m.documentMessage ? "📄 Documento" : "")
            || "";
        }
      }
      // Tentar pegar nome do contato das mensagens recebidas (se ainda sem nome)
      if (!nome) {
        const msgComNome = msgs.find((m: any) => !m.key?.fromMe && m.pushName);
        if (msgComNome?.pushName) {
          conversaUpdate.contato_nome = msgComNome.pushName;
        }
      }
      if (Object.keys(conversaUpdate).length > 0) {
        await supabase.from("conversas").update(conversaUpdate).eq("id", conversa.id);
      }
    }

    return NextResponse.json({
      ok: true, conversas: conversasSalvas, mensagens: mensagensSalvas,
      offset, processados: loteAtual.length, total: individuais.length,
      proximo_offset: offset + lote, tem_mais: offset + lote < individuais.length,
    });
  } catch(e) {
    console.error(e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
