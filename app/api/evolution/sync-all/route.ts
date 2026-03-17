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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const limite = body.limite || 200;

    // Buscar todos os chats
    const resChats = await fetch(`${EVO_URL}/chat/findChats/${INSTANCIA}`, {
      method: "POST",
      headers: { "apikey": EVO_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const chatsData = await resChats.json();
    const chats = Array.isArray(chatsData) ? chatsData : (chatsData?.chats || []);

    // Filtrar só individuais
    const individuais = chats.filter((c: any) => {
      const jid = c.id || c.remoteJid || "";
      return jid.includes("@s.whatsapp.net");
    });

    let conversasSalvas = 0;
    let mensagensSalvas = 0;

    for (const chat of individuais.slice(0, limite)) {
      const jid = chat.id || chat.remoteJid || "";
      const numero = jid.replace("@s.whatsapp.net", "").replace(/\D/g, "");
      if (!numero) continue;

      // Buscar mensagens primeiro para pegar o pushName real
      const resMsgs = await fetch(`${EVO_URL}/chat/findMessages/${INSTANCIA}`, {
        method: "POST",
        headers: { "apikey": EVO_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          where: { key: { remoteJid: jid } },
          limit: 100,
        }),
      });
      const msgsData = await resMsgs.json();
      const msgs = (msgsData?.messages?.records || msgsData?.records || []);

      // Pegar pushName da mensagem mais recente que não é fromMe
      const msgRecebida = msgs.find((m: any) => !m.key?.fromMe && m.pushName);
      const pushName = msgRecebida?.pushName || chat.name || chat.pushName || numero;

      // Buscar foto do contato
      let foto = null;
      try {
        const resPerfil = await fetch(`${EVO_URL}/chat/fetchProfile/${INSTANCIA}`, {
          method: "POST",
          headers: { "apikey": EVO_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ number: numero }),
        });
        const perfil = await resPerfil.json();
        if (perfil?.picture) foto = perfil.picture;
      } catch {}

      const ultimaMsg = chat.lastMessage?.message?.conversation ||
                        chat.lastMessage?.message?.extendedTextMessage?.text || "";
      const ultimaAt = chat.lastMessage?.messageTimestamp
        ? new Date(Number(chat.lastMessage.messageTimestamp) * 1000).toISOString()
        : new Date().toISOString();

      // Criar ou atualizar conversa
      let { data: conversa } = await supabase.from("conversas")
        .select("id").eq("agencia_id", AGENCIA_ID).eq("contato_numero", numero).single();

      if (!conversa) {
        const { data: nova } = await supabase.from("conversas").insert({
          agencia_id: AGENCIA_ID, instancia: INSTANCIA,
          contato_numero: numero, contato_nome: pushName, contato_foto: foto,
          ultima_mensagem: ultimaMsg, ultima_mensagem_at: ultimaAt, nao_lidas: 0,
        }).select("id").single();
        conversa = nova;
        conversasSalvas++;
      } else {
        // Atualizar nome e foto
        await supabase.from("conversas").update({
          contato_nome: pushName, contato_foto: foto,
          ultima_mensagem: ultimaMsg, ultima_mensagem_at: ultimaAt,
        }).eq("id", conversa.id);
      }

      if (!conversa?.id) continue;

      // Ordenar mensagens por timestamp (mais antigas primeiro)
      const msgsOrdenadas = msgs
        .filter((m: any) => m.key?.id && m.message)
        .sort((a: any, b: any) => Number(a.messageTimestamp) - Number(b.messageTimestamp));

      for (const msg of msgsOrdenadas) {
        const msgId = msg.key?.id;
        if (!msgId) continue;
        const fromMe = msg.key?.fromMe || false;
        const timestamp = msg.messageTimestamp
          ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
          : new Date().toISOString();

        let tipo = "text"; let conteudo = "";
        const m = msg.message;
        if (!m) continue;
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

    return NextResponse.json({ ok: true, conversas: conversasSalvas, mensagens: mensagensSalvas, total_chats: individuais.length });
  } catch(e) {
    console.error("Sync all erro:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
