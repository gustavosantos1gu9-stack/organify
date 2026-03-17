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
    const body = await req.json();
    const { event, data } = body;

    if (event === "messages.upsert" || event === "MESSAGES_UPSERT") {
      const msg = data?.messages?.[0] || data;
      if (!msg) return NextResponse.json({ ok: true });

      const fromMe = msg.key?.fromMe || false;
      const remoteJid = msg.key?.remoteJid || "";
      const remoteJidAlt = msg.key?.remoteJidAlt || "";
      
      // Ignorar grupos e mensagens enviadas por mim
      if (!remoteJid || remoteJid.includes("@g.us")) return NextResponse.json({ ok: true });
      if (fromMe) return NextResponse.json({ ok: true });

      // Usar número real: remoteJidAlt (@s.whatsapp.net) tem prioridade sobre @lid
      const jidReal = remoteJidAlt.includes("@s.whatsapp.net") ? remoteJidAlt : remoteJid;
      const numero = jidReal.replace("@s.whatsapp.net", "").replace("@lid", "").replace(/\D/g, "");
      const nome = msg.pushName || numero;
      const msgId = msg.key?.id;
      const timestamp = msg.messageTimestamp
        ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
        : new Date().toISOString();

      // Extrair conteúdo
      let tipo = "text";
      let conteudo = "";
      const m = msg.message;
      if (m?.conversation) conteudo = m.conversation;
      else if (m?.extendedTextMessage?.text) conteudo = m.extendedTextMessage.text;
      else if (m?.imageMessage) { tipo = "image"; conteudo = m.imageMessage.caption || ""; }
      else if (m?.audioMessage) { tipo = "audio"; conteudo = "🎵 Áudio"; }
      else if (m?.videoMessage) { tipo = "video"; conteudo = m.videoMessage.caption || "🎥 Vídeo"; }
      else if (m?.documentMessage) { tipo = "document"; conteudo = m.documentMessage.fileName || "📄 Documento"; }
      else if (m?.stickerMessage) { tipo = "sticker"; conteudo = "😄 Sticker"; }
      else conteudo = "Mensagem";

      // Buscar foto do contato se não tiver conversa ainda
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

      // Buscar ou criar conversa
      let { data: conversa } = await supabase
        .from("conversas")
        .select("*")
        .eq("agencia_id", AGENCIA_ID)
        .eq("instancia", INSTANCIA)
        .eq("contato_numero", numero)
        .single();

      if (!conversa) {
        const { data: nova } = await supabase.from("conversas").insert({
          agencia_id: AGENCIA_ID, instancia: INSTANCIA,
          contato_numero: numero, contato_nome: nome, contato_foto: foto,
          ultima_mensagem: conteudo, ultima_mensagem_at: timestamp,
          nao_lidas: fromMe ? 0 : 1,
        }).select().single();
        conversa = nova;
      } else {
        await supabase.from("conversas").update({
          ultima_mensagem: conteudo, ultima_mensagem_at: timestamp,
          contato_nome: nome,
          nao_lidas: fromMe ? conversa.nao_lidas : (conversa.nao_lidas || 0) + 1,
        }).eq("id", conversa.id);
      }

      if (conversa && msgId) {
        await supabase.from("mensagens").upsert({
          conversa_id: conversa.id,
          agencia_id: AGENCIA_ID,
          mensagem_id: msgId,
          de_mim: fromMe,
          tipo,
          conteudo,
          created_at: timestamp,
        }, { onConflict: "mensagem_id" });
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
