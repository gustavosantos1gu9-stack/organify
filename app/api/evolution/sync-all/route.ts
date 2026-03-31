import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

    const resChats = await fetch(`${EVO_URL}/chat/findChats/${INSTANCIA}`, {
      method: "POST",
      headers: { "apikey": EVO_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const chats = await resChats.json();
    const lista = Array.isArray(chats) ? chats : [];

    const individuais = lista.filter((c: any) => {
      const jid = c.remoteJid || "";
      if (jid.includes("@g.us") || jid.includes("@broadcast")) return false;
      return jid.includes("@s.whatsapp.net") || jid.includes("@lid");
    });

    const loteAtual = individuais.slice(offset, offset + lote);
    let conversasSalvas = 0;
    let mensagensSalvas = 0;

    for (const chat of loteAtual) {
      const jid = chat.remoteJid || "";
      const isLid = jid.includes("@lid");

      let numeroReal = "";
      if (isLid) {
        const alt = chat.lastMessage?.key?.remoteJidAlt || "";
        if (alt && alt.includes("@s.whatsapp.net")) {
          numeroReal = alt.replace("@s.whatsapp.net", "");
        } else continue;
      } else {
        numeroReal = jid.replace("@s.whatsapp.net", "");
      }

      numeroReal = numeroReal.replace(/\D/g, "");
      if (!numeroReal || numeroReal === MEU_NUMERO) continue;
      if (numeroReal.length < 10 || numeroReal.length > 15) continue;

      const nome = chat.pushName || numeroReal;
      const foto = chat.profilePicUrl || null;
      const lm = chat.lastMessage;
      const ultimaMsg = lm?.message?.conversation || lm?.message?.extendedTextMessage?.text || "";
      const ultimaAt = lm?.messageTimestamp ? new Date(Number(lm.messageTimestamp) * 1000).toISOString() : new Date().toISOString();
      const naoLidas = chat.unreadCount || 0;

      let { data: conversa } = await supabase.from("conversas")
        .select("id").eq("agencia_id", agencia.id).eq("contato_numero", numeroReal).single();

      if (!conversa) {
        const { data: nova } = await supabase.from("conversas").insert({
          agencia_id: agencia.id, instancia: INSTANCIA,
          contato_numero: numeroReal, contato_nome: nome, contato_foto: foto,
          contato_jid: jid,
          ultima_mensagem: ultimaMsg, ultima_mensagem_at: ultimaAt, nao_lidas: naoLidas,
        }).select("id").single();
        conversa = nova;
        conversasSalvas++;
      } else {
        await supabase.from("conversas").update({
          contato_nome: nome, contato_foto: foto, contato_jid: jid,
          ultima_mensagem: ultimaMsg, ultima_mensagem_at: ultimaAt, nao_lidas: naoLidas,
        }).eq("id", conversa.id);
      }

      if (!com_mensagens || !conversa?.id) continue;

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
          conversa_id: conversa.id, agencia_id: agencia.id,
          mensagem_id: msgId, de_mim: fromMe, tipo, conteudo, created_at: timestamp,
        }, { onConflict: "mensagem_id" });
        if (!error) mensagensSalvas++;
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
