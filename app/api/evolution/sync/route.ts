import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { numero, conversa_id, jid_original, agencia_id } = await req.json();

    // Buscar config da agência
    const { data: agencia } = await supabase.from("agencias")
      .select("evolution_url, evolution_key, whatsapp_instancia")
      .eq("id", agencia_id).single();

    if (!agencia?.evolution_url) return NextResponse.json({ error: "Não configurado" }, { status: 400 });

    const EVO_URL = agencia.evolution_url;
    const EVO_KEY = agencia.evolution_key;
    const INSTANCIA = agencia.whatsapp_instancia;

    const jids = jid_original
      ? [jid_original, `${numero}@s.whatsapp.net`]
      : [`${numero}@s.whatsapp.net`];

    let todosRegistros: any[] = [];

    for (const jid of jids) {
      let pagina = 1;
      let temMais = true;
      while (temMais && pagina <= 20) {
        const res = await fetch(`${EVO_URL}/chat/findMessages/${INSTANCIA}`, {
          method: "POST",
          headers: { "apikey": EVO_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ where: { key: { remoteJid: jid } }, limit: 100, page: pagina }),
        });
        const data = await res.json();
        const records = data?.messages?.records || data?.records || [];
        if (!Array.isArray(records) || records.length === 0) { temMais = false; break; }
        todosRegistros = [...todosRegistros, ...records];
        temMais = records.length === 100;
        pagina++;
      }
      if (todosRegistros.length > 0) break;
    }

    if (todosRegistros.length === 0) return NextResponse.json({ ok: true, total: 0 });

    todosRegistros.sort((a, b) => Number(a.messageTimestamp) - Number(b.messageTimestamp));

    let salvos = 0;
    for (const msg of todosRegistros) {
      const fromMe = msg.key?.fromMe || false;
      const msgId = msg.key?.id;
      if (!msgId || !msg.message) continue;
      const timestamp = msg.messageTimestamp
        ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
        : new Date().toISOString();
      let tipo = "text"; let conteudo = "";
      const m = msg.message;
      if (m.conversation) conteudo = m.conversation;
      else if (m.extendedTextMessage?.text) conteudo = m.extendedTextMessage.text;
      else if (m.imageMessage) { tipo = "image"; conteudo = m.imageMessage.caption || "📷 Imagem"; }
      else if (m.audioMessage) { tipo = "audio"; conteudo = "🎵 Áudio"; }
      else if (m.videoMessage) { tipo = "video"; conteudo = "🎥 Vídeo"; }
      else if (m.documentMessage) { tipo = "document"; conteudo = m.documentMessage.fileName || "📄 Documento"; }
      else if (m.stickerMessage) { tipo = "sticker"; conteudo = "😄 Sticker"; }
      else continue;
      const { error } = await supabase.from("mensagens").upsert({
        conversa_id, agencia_id,
        mensagem_id: msgId, de_mim: fromMe, tipo, conteudo, created_at: timestamp,
      }, { onConflict: "mensagem_id" });
      if (!error) salvos++;
    }

    return NextResponse.json({ ok: true, total: salvos });
  } catch(e) {
    console.error("Sync erro:", e);
    return NextResponse.json({ error: "Erro ao sincronizar" }, { status: 500 });
  }
}
