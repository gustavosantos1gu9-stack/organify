import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const EVO_URL = "https://evolution-api-production-e0b8.up.railway.app";
const EVO_KEY = "6656711fd37b4eadc6a9d6a31b84c8648e19708f55e7f09b85b7b61d9660d6ad";
const AGENCIA_ID = "32cdce6e-4664-4ac6-979d-6d68a1a68745";
const INSTANCIA = "salxdigital";

// Número do próprio WhatsApp conectado — mensagens fromMe não criam conversa
const MEU_NUMERO = "555189840990"; // ajuste se necessário

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const pagina = body.pagina || 1;
    const porPagina = 50;

    // Buscar chats com paginação
    const resChats = await fetch(`${EVO_URL}/chat/findChats/${INSTANCIA}`, {
      method: "POST",
      headers: { "apikey": EVO_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ limit: porPagina, page: pagina }),
    });
    const chats = await resChats.json();
    const lista = Array.isArray(chats) ? chats : [];

    // Filtrar individuais (excluir grupos @g.us e meu próprio número)
    const individuais = lista.filter((c: any) => {
      const jid = c.remoteJid || "";
      if (jid.includes("@g.us")) return false;
      if (jid.includes("@broadcast")) return false;
      const num = jid.replace("@s.whatsapp.net","").replace("@lid","").replace(/\D/g,"");
      if (num === MEU_NUMERO) return false;
      return jid.includes("@s.whatsapp.net") || jid.includes("@lid");
    });

    let conversasSalvas = 0;
    let mensagensSalvas = 0;

    for (const chat of individuais) {
      const jid = chat.remoteJid || "";
      const numero = jid.replace("@s.whatsapp.net","").replace("@lid","").replace(/\D/g,"");
      if (!numero || numero === MEU_NUMERO) continue;

      const nome = chat.pushName || numero;
      const foto = chat.profilePicUrl || null;

      const lm = chat.lastMessage;
      const ultimaMsg = lm?.message?.conversation ||
                        lm?.message?.extendedTextMessage?.text ||
                        lm?.messageType || "";
      const ultimaAt = lm?.messageTimestamp
        ? new Date(Number(lm.messageTimestamp) * 1000).toISOString()
        : new Date().toISOString();
      const naoLidas = chat.unreadCount || 0;

      let { data: conversa } = await supabase.from("conversas")
        .select("id").eq("agencia_id", AGENCIA_ID).eq("contato_numero", numero).single();

      if (!conversa) {
        const { data: nova } = await supabase.from("conversas").insert({
          agencia_id: AGENCIA_ID, instancia: INSTANCIA,
          contato_numero: numero, contato_nome: nome, contato_foto: foto,
          ultima_mensagem: ultimaMsg, ultima_mensagem_at: ultimaAt, nao_lidas: naoLidas,
        }).select("id").single();
        conversa = nova;
        conversasSalvas++;
      } else {
        await supabase.from("conversas").update({
          contato_nome: nome, contato_foto: foto,
          ultima_mensagem: ultimaMsg, ultima_mensagem_at: ultimaAt, nao_lidas: naoLidas,
        }).eq("id", conversa.id);
      }

      if (!conversa?.id) continue;

      // Buscar mensagens
      const resMsgs = await fetch(`${EVO_URL}/chat/findMessages/${INSTANCIA}`, {
        method: "POST",
        headers: { "apikey": EVO_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ where: { key: { remoteJid: jid } }, limit: 100 }),
      });
      const msgsData = await resMsgs.json();
      const msgs = (msgsData?.messages?.records || msgsData?.records || [])
        .filter((m: any) => m.key?.id && m.message)
        .sort((a: any, b: any) => Number(a.messageTimestamp) - Number(b.messageTimestamp));

      for (const msg of msgs) {
        const msgId = msg.key?.id;
        if (!msgId) continue;
        const fromMe = msg.key?.fromMe || false;
        const ts = Number(msg.messageTimestamp);
        if (!ts) continue;
        const timestamp = new Date(ts * 1000).toISOString();

        // Atualizar nome se veio da mensagem
        if (!chat.pushName && msg.pushName && !fromMe) {
          await supabase.from("conversas").update({ contato_nome: msg.pushName }).eq("id", conversa.id);
        }

        let tipo = "text"; let conteudo = "";
        const m = msg.message;
        if (m.conversation) conteudo = m.conversation;
        else if (m.extendedTextMessage?.text) conteudo = m.extendedTextMessage.text;
        else if (m.imageMessage) { tipo = "image"; conteudo = m.imageMessage.caption || "📷 Imagem"; }
        else if (m.audioMessage) { tipo = "audio"; conteudo = "🎵 Áudio"; }
        else if (m.videoMessage) { tipo = "video"; conteudo = "🎥 Vídeo"; }
        else if (m.documentMessage) { tipo = "document"; conteudo = m.documentMessage.fileName || "📄 Documento"; }
        else continue;

        const { error } = await supabase.from("mensagens").upsert({
          conversa_id: conversa.id, agencia_id: AGENCIA_ID,
          mensagem_id: msgId, de_mim: fromMe, tipo, conteudo, created_at: timestamp,
        }, { onConflict: "mensagem_id" });
        if (!error) mensagensSalvas++;
      }
    }

    return NextResponse.json({
      ok: true,
      conversas: conversasSalvas,
      mensagens: mensagensSalvas,
      pagina,
      total_pagina: lista.length,
      tem_mais: lista.length === porPagina,
    });
  } catch(e) {
    console.error(e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
