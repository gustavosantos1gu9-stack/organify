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
    const { numero, conversa_id, limite } = await req.json();

    // Buscar mensagens da Evolution API
    const res = await fetch(`${EVO_URL}/chat/findMessages/${INSTANCIA}`, {
      method: "POST",
      headers: { "apikey": EVO_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        where: { key: { remoteJid: `${numero}@s.whatsapp.net` } },
        limit: limite || 50,
      }),
    });

    const data = await res.json();
    const msgs = data?.messages?.records || data?.records || data || [];

    if (!Array.isArray(msgs) || msgs.length === 0) {
      return NextResponse.json({ ok: true, total: 0 });
    }

    let salvos = 0;
    for (const msg of msgs) {
      const fromMe = msg.key?.fromMe || false;
      const msgId = msg.key?.id;
      if (!msgId) continue;

      const timestamp = msg.messageTimestamp
        ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
        : new Date().toISOString();

      let tipo = "text";
      let conteudo = "";
      const m = msg.message;
      if (!m) continue;
      if (m.conversation) conteudo = m.conversation;
      else if (m.extendedTextMessage?.text) conteudo = m.extendedTextMessage.text;
      else if (m.imageMessage) { tipo = "image"; conteudo = m.imageMessage.caption || "📷 Imagem"; }
      else if (m.audioMessage) { tipo = "audio"; conteudo = "🎵 Áudio"; }
      else if (m.videoMessage) { tipo = "video"; conteudo = m.videoMessage.caption || "🎥 Vídeo"; }
      else if (m.documentMessage) { tipo = "document"; conteudo = m.documentMessage.fileName || "📄 Documento"; }
      else if (m.stickerMessage) { tipo = "sticker"; conteudo = "😄 Sticker"; }
      else continue;

      const { error } = await supabase.from("mensagens").upsert({
        conversa_id,
        agencia_id: AGENCIA_ID,
        mensagem_id: msgId,
        de_mim: fromMe,
        tipo,
        conteudo,
        created_at: timestamp,
      }, { onConflict: "mensagem_id" });

      if (!error) salvos++;
    }

    return NextResponse.json({ ok: true, total: salvos });
  } catch(e) {
    console.error("Sync erro:", e);
    return NextResponse.json({ error: "Erro ao sincronizar" }, { status: 500 });
  }
}
