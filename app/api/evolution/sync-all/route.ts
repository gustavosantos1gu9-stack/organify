import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const maxDuration = 300;

// ─── Helpers ─────────────────────────────────────────────────

function extrairConteudo(msg: any): { tipo: string; conteudo: string } | null {
  const m = msg.message;
  if (!m) return null;
  if (m.conversation) return { tipo: "text", conteudo: m.conversation };
  if (m.extendedTextMessage?.text) return { tipo: "text", conteudo: m.extendedTextMessage.text };
  if (m.imageMessage) return { tipo: "image", conteudo: m.imageMessage.caption || "📷 Imagem" };
  if (m.audioMessage) return { tipo: "audio", conteudo: "🎵 Áudio" };
  if (m.videoMessage) return { tipo: "video", conteudo: "🎥 Vídeo" };
  if (m.documentMessage) return { tipo: "document", conteudo: m.documentMessage.fileName || "📄 Documento" };
  if (m.stickerMessage) return { tipo: "sticker", conteudo: "🏷️ Sticker" };
  if (m.contactMessage) return { tipo: "text", conteudo: `👤 ${m.contactMessage.displayName || "Contato"}` };
  if (m.locationMessage) return { tipo: "text", conteudo: "📍 Localização" };
  if (m.buttonsResponseMessage) return { tipo: "text", conteudo: m.buttonsResponseMessage.selectedDisplayText || "Botão" };
  if (m.listResponseMessage) return { tipo: "text", conteudo: m.listResponseMessage.title || "Lista" };
  if (m.templateButtonReplyMessage) return { tipo: "text", conteudo: m.templateButtonReplyMessage.selectedDisplayText || "Botão" };
  if (m.viewOnceMessage?.message) return extrairConteudo({ message: m.viewOnceMessage.message });
  if (m.viewOnceMessageV2?.message) return extrairConteudo({ message: m.viewOnceMessageV2.message });
  if (m.reactionMessage) return null;
  if (m.protocolMessage) return null;
  if (m.ephemeralMessage?.message) return extrairConteudo({ message: m.ephemeralMessage.message });
  return null;
}

async function buscarTodasMensagens(evoUrl: string, evoKey: string, instancia: string, jid: string): Promise<any[]> {
  const todas: any[] = [];
  let page = 1;
  const MAX_PAGES = 50; // até 5000 mensagens (100 por página)

  while (page <= MAX_PAGES) {
    try {
      const res = await fetch(`${evoUrl}/chat/findMessages/${instancia}`, {
        method: "POST",
        headers: { "apikey": evoKey, "Content-Type": "application/json" },
        body: JSON.stringify({ where: { key: { remoteJid: jid } }, limit: 100, page }),
      });
      const data = await res.json();
      const records = data?.messages?.records || data?.records || [];
      if (!Array.isArray(records) || records.length === 0) break;
      todas.push(...records);
      if (records.length < 100) break; // última página
      page++;
    } catch {
      break;
    }
  }

  return todas;
}

function resolverNumeroLid(chat: any, msgs: any[]): string {
  // Tentar vários caminhos para encontrar o número real de um @lid
  const tentativas = [
    chat.lastMessage?.key?.remoteJidAlt,
    chat.participant,
  ];

  for (const t of tentativas) {
    if (typeof t === "string" && t.includes("@s.whatsapp.net")) {
      return t.replace("@s.whatsapp.net", "").replace(/\D/g, "");
    }
  }

  // Buscar nas mensagens
  for (const msg of msgs) {
    const alt = msg.key?.remoteJidAlt || msg.participant || "";
    if (typeof alt === "string" && alt.includes("@s.whatsapp.net")) {
      return alt.replace("@s.whatsapp.net", "").replace(/\D/g, "");
    }
  }

  return "";
}

function resolverNome(chat: any, msgs: any[]): string {
  // 1. Campos do chat
  const campos = [
    chat.pushName,
    chat.name,
    chat.contact?.pushName,
    chat.contact?.name,
    chat.notify,
    chat.verifiedName,
    chat.formattedTitle,
  ];
  for (const c of campos) {
    if (c && typeof c === "string" && c.trim()) return c.trim();
  }

  // 2. pushName de mensagens RECEBIDAS (não fromMe)
  for (const msg of msgs) {
    if (!msg.key?.fromMe && msg.pushName && typeof msg.pushName === "string" && msg.pushName.trim()) {
      return msg.pushName.trim();
    }
  }

  return "";
}

// ─── Endpoint principal ──────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { agencia_id, offset = 0, lote = 10 } = body;

    // Buscar config da agência
    let { data: agencia } = await supabase.from("agencias")
      .select("id, evolution_url, evolution_key, whatsapp_instancia, whatsapp_numero, parent_id")
      .eq("id", agencia_id).single();

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

    // Buscar todos os chats da instância
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
    let conversasProcessadas = 0;
    let mensagensSalvas = 0;

    for (const chat of loteAtual) {
      const jid = chat.remoteJid || chat.id || "";
      const isLid = jid.includes("@lid");

      // ─── 1. Buscar TODAS as mensagens primeiro ───
      const todasMsgs = await buscarTodasMensagens(EVO_URL, EVO_KEY, INSTANCIA, jid);

      // ─── 2. Resolver número ───
      let numeroReal = "";
      if (isLid) {
        numeroReal = resolverNumeroLid(chat, todasMsgs);
        if (!numeroReal) continue;
      } else {
        numeroReal = jid.replace("@s.whatsapp.net", "");
      }

      numeroReal = numeroReal.replace(/\D/g, "");
      if (!numeroReal || numeroReal === MEU_NUMERO) continue;
      if (numeroReal.length < 10 || numeroReal.length > 15) continue;

      // ─── 3. Resolver nome ───
      const nome = resolverNome(chat, todasMsgs);
      const foto = chat.profilePicUrl || chat.contact?.profilePicUrl || null;

      // ─── 4. Processar mensagens ───
      const msgsValidas = todasMsgs
        .filter((m: any) => m.key?.id && Number(m.messageTimestamp) > 0)
        .sort((a: any, b: any) => Number(a.messageTimestamp) - Number(b.messageTimestamp));

      let primeiraMsgAt: string | null = null;
      let ultimaMsgAt: string | null = null;
      let ultimaMsgConteudo = "";
      let msgsSalvasConversa = 0;

      // Batch upsert para performance
      const batch: any[] = [];

      for (const msg of msgsValidas) {
        const msgId = msg.key?.id;
        if (!msgId) continue;

        const ts = Number(msg.messageTimestamp);
        const timestamp = new Date(ts * 1000).toISOString();

        if (!primeiraMsgAt || timestamp < primeiraMsgAt) primeiraMsgAt = timestamp;
        if (!ultimaMsgAt || timestamp > ultimaMsgAt) {
          ultimaMsgAt = timestamp;
          const ext = extrairConteudo(msg);
          if (ext) ultimaMsgConteudo = ext.conteudo;
        }

        const ext = extrairConteudo(msg);
        if (!ext) continue;

        batch.push({
          conversa_id: "__PLACEHOLDER__",
          agencia_id: agencia.id,
          mensagem_id: msgId,
          de_mim: msg.key?.fromMe || false,
          tipo: ext.tipo,
          conteudo: ext.conteudo,
          created_at: timestamp,
        });
      }

      // ─── 5. Criar ou atualizar conversa ───
      let { data: conversa } = await supabase.from("conversas")
        .select("id").eq("agencia_id", agencia.id).eq("contato_numero", numeroReal).single();

      const conversaData: any = {
        contato_foto: foto,
        contato_jid: jid,
        ultima_mensagem: ultimaMsgConteudo,
        ultima_mensagem_at: ultimaMsgAt || new Date().toISOString(),
        nao_lidas: chat.unreadCount || 0,
      };
      if (nome) conversaData.contato_nome = nome;
      if (primeiraMsgAt) conversaData.primeira_mensagem_at = primeiraMsgAt;

      if (!conversa) {
        const { data: nova } = await supabase.from("conversas").insert({
          agencia_id: agencia.id,
          instancia: INSTANCIA,
          contato_numero: numeroReal,
          contato_nome: nome || numeroReal,
          ...conversaData,
        }).select("id").single();
        conversa = nova;
      } else {
        await supabase.from("conversas").update(conversaData).eq("id", conversa.id);
      }

      if (!conversa?.id) continue;

      // ─── 6. Salvar mensagens em lotes de 50 ───
      for (let i = 0; i < batch.length; i += 50) {
        const chunk = batch.slice(i, i + 50).map(m => ({
          ...m,
          conversa_id: conversa!.id,
        }));
        const { error } = await supabase.from("mensagens").upsert(chunk, { onConflict: "mensagem_id" });
        if (!error) msgsSalvasConversa += chunk.length;
      }

      mensagensSalvas += msgsSalvasConversa;
      conversasProcessadas++;
    }

    return NextResponse.json({
      ok: true,
      conversas: conversasProcessadas,
      mensagens: mensagensSalvas,
      offset,
      processados: loteAtual.length,
      total: individuais.length,
      proximo_offset: offset + lote,
      tem_mais: offset + lote < individuais.length,
    });
  } catch(e) {
    console.error("sync-all erro:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
