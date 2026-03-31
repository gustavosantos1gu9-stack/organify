import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const maxDuration = 60;

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
  if (m.viewOnceMessage?.message) return extrairConteudo({ message: m.viewOnceMessage.message });
  if (m.viewOnceMessageV2?.message) return extrairConteudo({ message: m.viewOnceMessageV2.message });
  if (m.ephemeralMessage?.message) return extrairConteudo({ message: m.ephemeralMessage.message });
  if (m.reactionMessage || m.protocolMessage) return null;
  return null;
}

function resolverNome(chat: any, contact: any, msgs: any[]): string {
  const campos = [
    chat?.pushName, chat?.name, contact?.pushName, contact?.name,
    contact?.notify, contact?.verifiedName, chat?.formattedTitle,
  ];
  for (const c of campos) {
    if (c && typeof c === "string" && c.trim() && !/^\d+$/.test(c.trim())) return c.trim();
  }
  for (const msg of msgs) {
    if (!msg.key?.fromMe && msg.pushName && typeof msg.pushName === "string" && msg.pushName.trim()) {
      return msg.pushName.trim();
    }
  }
  return "";
}

async function getEvoConfig(agenciaId: string) {
  let { data: agencia } = await supabase.from("agencias")
    .select("id, evolution_url, evolution_key, whatsapp_instancia, whatsapp_numero, parent_id")
    .eq("id", agenciaId).single();
  if (agencia && !agencia.evolution_url && agencia.parent_id) {
    const { data: parent } = await supabase.from("agencias")
      .select("evolution_url, evolution_key").eq("id", agencia.parent_id).single();
    if (parent) agencia = { ...agencia, evolution_url: parent.evolution_url, evolution_key: parent.evolution_key };
  }
  return agencia;
}

// ─── Etapa 1: Listar chats (rápido, sem mensagens) ──────────

async function listarChats(agencia: any) {
  const EVO_URL = agencia.evolution_url;
  const EVO_KEY = agencia.evolution_key;
  const INST = agencia.whatsapp_instancia;
  const MEU = (agencia.whatsapp_numero || "").replace(/\D/g, "");

  const [resChats, resContacts] = await Promise.all([
    fetch(`${EVO_URL}/chat/findChats/${INST}`, {
      method: "POST", headers: { "apikey": EVO_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }),
    fetch(`${EVO_URL}/chat/findContacts/${INST}`, {
      method: "POST", headers: { "apikey": EVO_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }).catch(() => null),
  ]);

  const chatsRaw = await resChats.json().catch(() => []);
  const chatList = Array.isArray(chatsRaw) ? chatsRaw : [];
  const contactMap = new Map<string, any>();
  if (resContacts?.ok) {
    const contacts = await resContacts.json().catch(() => []);
    if (Array.isArray(contacts)) {
      for (const c of contacts) {
        const id = c.id || c.remoteJid || "";
        if (id) contactMap.set(id, c);
      }
    }
  }

  // Combinar chats + contatos
  const jidSet = new Set<string>();
  const items: { jid: string; chat: any; contact: any }[] = [];

  for (const chat of chatList) {
    const jid = chat.remoteJid || chat.id || "";
    if (jid.includes("@g.us") || jid.includes("@broadcast") || jid === "status@broadcast") continue;
    if (!jid.includes("@s.whatsapp.net") && !jid.includes("@lid")) continue;
    jidSet.add(jid);

    // Resolver número inline (rápido)
    let numero = "";
    if (jid.includes("@lid")) {
      // Tentar resolver número real do @lid
      const alt = chat.lastMessage?.key?.remoteJidAlt || chat.participant || "";
      if (typeof alt === "string" && alt.includes("@s.whatsapp.net")) {
        numero = alt.replace("@s.whatsapp.net", "").replace(/\D/g, "");
      }
      // Se não conseguiu, usar o lid como identificador (não descartar)
      if (!numero) numero = jid.replace("@lid", "").replace(/\D/g, "") || jid.split("@")[0];
    } else {
      numero = jid.replace("@s.whatsapp.net", "").replace(/\D/g, "");
    }
    if (!numero || numero === MEU) continue;
    if (numero.length > 15) continue; // só filtra muito longos

    const contact = contactMap.get(jid) || null;
    const nome = resolverNome(chat, contact, []);
    const foto = chat.profilePicUrl || contact?.profilePicUrl || null;
    const lm = chat.lastMessage;
    const ultimaMsg = lm?.message?.conversation || lm?.message?.extendedTextMessage?.text || "";
    const ultimaAt = lm?.messageTimestamp ? new Date(Number(lm.messageTimestamp) * 1000).toISOString() : null;
    const chatTs = chat.createdAt || chat.conversationTimestamp || chat.t || 0;
    const primeiraAt = chatTs ? new Date(Number(chatTs) * 1000).toISOString() : null;

    items.push({ jid, chat: { numero, nome, foto, ultimaMsg, ultimaAt, primeiraAt, naoLidas: chat.unreadCount || 0 }, contact });
  }

  return { items, total: items.length };
}

// ─── Etapa 2: Sync profundo (1 conversa por vez) ────────────

async function syncConversa(agencia: any, jid: string, info: any) {
  const EVO_URL = agencia.evolution_url;
  const EVO_KEY = agencia.evolution_key;
  const INST = agencia.whatsapp_instancia;

  // Buscar todas as mensagens (pagina até 5000)
  const todasMsgs: any[] = [];
  let page = 1;
  while (page <= 50) {
    try {
      const res = await fetch(`${EVO_URL}/chat/findMessages/${INST}`, {
        method: "POST", headers: { "apikey": EVO_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ where: { key: { remoteJid: jid } }, limit: 100, page }),
      });
      if (!res.ok) break;
      const data = await res.json();
      const records = data?.messages?.records || data?.records || [];
      if (!Array.isArray(records) || records.length === 0) break;
      todasMsgs.push(...records);
      if (records.length < 100) break;
      page++;
    } catch { break; }
  }

  // Resolver número real do @lid via mensagens (se info.numero é um lid ID)
  let numeroFinal = info.numero;
  if (jid.includes("@lid")) {
    for (const msg of todasMsgs.slice(0, 50)) {
      const alt = msg.key?.remoteJidAlt || msg.participant || "";
      if (typeof alt === "string" && alt.includes("@s.whatsapp.net")) {
        const resolved = alt.replace("@s.whatsapp.net", "").replace(/\D/g, "");
        if (resolved && resolved.length >= 8) { numeroFinal = resolved; break; }
      }
    }
  }

  // Resolver nome das mensagens se não veio do chat
  let nome = info.nome;
  if (!nome) {
    for (const msg of todasMsgs) {
      if (!msg.key?.fromMe && msg.pushName && typeof msg.pushName === "string" && msg.pushName.trim()) {
        nome = msg.pushName.trim();
        break;
      }
    }
  }

  // Processar mensagens
  const msgsValidas = todasMsgs
    .filter((m: any) => m.key?.id && Number(m.messageTimestamp) > 0)
    .sort((a: any, b: any) => Number(a.messageTimestamp) - Number(b.messageTimestamp));

  let primeiraMsgAt: string | null = null;
  let ultimaMsgAt: string | null = null;
  let ultimaMsgConteudo = "";
  const batch: any[] = [];

  for (const msg of msgsValidas) {
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
      agencia_id: agencia.id, mensagem_id: msg.key.id,
      de_mim: msg.key?.fromMe || false, tipo: ext.tipo,
      conteudo: ext.conteudo, created_at: timestamp,
    });
  }

  // Criar/atualizar conversa
  let { data: conversa } = await supabase.from("conversas")
    .select("id").eq("agencia_id", agencia.id).eq("contato_numero", numeroFinal).single();

  const conversaData: any = { contato_jid: jid, nao_lidas: info.naoLidas || 0 };
  if (nome) conversaData.contato_nome = nome;
  if (info.foto) conversaData.contato_foto = info.foto;
  if (ultimaMsgConteudo) conversaData.ultima_mensagem = ultimaMsgConteudo;
  if (ultimaMsgAt || info.ultimaAt) conversaData.ultima_mensagem_at = ultimaMsgAt || info.ultimaAt;
  if (primeiraMsgAt || info.primeiraAt) conversaData.primeira_mensagem_at = primeiraMsgAt || info.primeiraAt;

  if (!conversa) {
    const { data: nova } = await supabase.from("conversas").insert({
      agencia_id: agencia.id, instancia: INST,
      contato_numero: numeroFinal, contato_nome: nome || numeroFinal,
      contato_foto: info.foto, contato_jid: jid,
      ultima_mensagem: ultimaMsgConteudo || info.ultimaMsg || "",
      ultima_mensagem_at: ultimaMsgAt || info.ultimaAt || new Date().toISOString(),
      primeira_mensagem_at: primeiraMsgAt || info.primeiraAt,
      nao_lidas: info.naoLidas || 0,
    }).select("id").single();
    conversa = nova;
  } else {
    await supabase.from("conversas").update(conversaData).eq("id", conversa.id);
  }

  if (!conversa?.id) return 0;

  // Salvar mensagens em lotes de 50
  let totalSalvas = 0;
  for (let i = 0; i < batch.length; i += 50) {
    const chunk = batch.slice(i, i + 50).map(m => ({ ...m, conversa_id: conversa!.id }));
    const { error } = await supabase.from("mensagens").upsert(chunk, { onConflict: "mensagem_id" });
    if (!error) totalSalvas += chunk.length;
  }
  return totalSalvas;
}

// ─── Endpoint ────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { agencia_id, action, offset = 0, lote = 5, jid, info } = body;

    const agencia = await getEvoConfig(agencia_id);
    if (!agencia?.evolution_url) return NextResponse.json({ error: "Agência não configurada" }, { status: 400 });

    // Ação: listar (rápido — retorna lista de chats pra o client iterar)
    if (action === "listar") {
      const { items, total } = await listarChats(agencia);
      return NextResponse.json({ ok: true, items, total });
    }

    // Ação: sync de 1 conversa (chamado N vezes pelo client)
    if (action === "sync-one") {
      if (!jid || !info) return NextResponse.json({ error: "jid e info obrigatórios" }, { status: 400 });
      const msgs = await syncConversa(agencia, jid, info);
      return NextResponse.json({ ok: true, mensagens: msgs });
    }

    // Ação padrão: sync em lotes (compatibilidade)
    const { items } = await listarChats(agencia);
    const loteAtual = items.slice(offset, offset + lote);
    let conversasProcessadas = 0;
    let mensagensSalvas = 0;

    for (const item of loteAtual) {
      const msgs = await syncConversa(agencia, item.jid, item.chat);
      mensagensSalvas += msgs;
      conversasProcessadas++;
    }

    return NextResponse.json({
      ok: true, conversas: conversasProcessadas, mensagens: mensagensSalvas,
      offset, processados: loteAtual.length, total: items.length,
      proximo_offset: offset + lote, tem_mais: offset + lote < items.length,
    });
  } catch(e) {
    console.error("sync-all erro:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
