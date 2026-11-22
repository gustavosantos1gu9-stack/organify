import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const maxDuration = 300; // 5 minutos

// ─── Helpers (copiados do sync-all para evitar dependência circular) ──────────

function extrairConteudo(msg: any): { tipo: string; conteudo: string } | null {
  const m = msg.message;
  if (!m) return null;
  if (m.conversation) return { tipo: "text", conteudo: m.conversation };
  if (m.extendedTextMessage?.text) return { tipo: "text", conteudo: m.extendedTextMessage.text };
  if (m.imageMessage) return { tipo: "image", conteudo: m.imageMessage.caption || "📷 Imagem" };
  if (m.audioMessage) return { tipo: "audio", conteudo: "🎵 Áudio" };
  if (m.videoMessage) return { tipo: "video", conteudo: m.videoMessage.caption || "🎥 Vídeo" };
  if (m.documentMessage) return { tipo: "document", conteudo: m.documentMessage.fileName || "📄 Documento" };
  if (m.stickerMessage) return { tipo: "sticker", conteudo: "🏷️ Sticker" };
  if (m.contactMessage) return { tipo: "text", conteudo: `👤 ${m.contactMessage.displayName || "Contato"}` };
  if (m.locationMessage) return { tipo: "text", conteudo: "📍 Localização" };
  if (m.reactionMessage || m.protocolMessage) return null;
  return null;
}

function resolverNome(chat: any, msgs: any[]): string {
  const campos = [chat?.name, chat?.formattedTitle, chat?.pushName];
  for (const c of campos) {
    if (c && typeof c === "string" && c.trim() && !/^\d+$/.test(c.trim())) return c.trim();
  }
  for (const msg of msgs) {
    if (!msg.key?.fromMe && msg.pushName?.trim() && !/^\d+$/.test(msg.pushName.trim())) {
      return msg.pushName.trim();
    }
  }
  return "";
}

async function getAgencia(agenciaId: string) {
  let { data: ag } = await supabase.from("agencias")
    .select("id, evolution_url, evolution_key, whatsapp_instancia, whatsapp_numero, parent_id")
    .eq("id", agenciaId).single();
  if (ag && !ag.evolution_url && ag.parent_id) {
    const { data: parent } = await supabase.from("agencias")
      .select("evolution_url, evolution_key").eq("id", ag.parent_id).single();
    if (parent) ag = { ...ag, evolution_url: parent.evolution_url, evolution_key: parent.evolution_key };
  }
  return ag;
}

// ─── Sync de 1 conversa com histórico limitado ────────────────────────────────

async function syncConversaQuick(agencia: any, jid: string, chatInfo: any, paginas: number) {
  const { evolution_url: EVO_URL, evolution_key: EVO_KEY, whatsapp_instancia: INST, id: agenciaId } = agencia;

  // Buscar últimas mensagens (paginas × 100 por conversa)
  const todasMsgs: any[] = [];
  for (let page = 1; page <= paginas; page++) {
    try {
      const res = await fetch(`${EVO_URL}/chat/findMessages/${INST}`, {
        method: "POST",
        headers: { "apikey": EVO_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ where: { key: { remoteJid: jid } }, limit: 100, page }),
      });
      if (!res.ok) break;
      const data = await res.json();
      const records = data?.messages?.records || data?.records || [];
      if (!Array.isArray(records) || records.length === 0) break;
      todasMsgs.push(...records);
      if (records.length < 100) break;
    } catch { break; }
  }

  // Resolver número real do @lid
  let numero = chatInfo.numero;
  if (jid.includes("@lid")) {
    for (const msg of todasMsgs.slice(0, 50)) {
      const alt = msg.key?.remoteJidAlt || msg.participant || "";
      if (typeof alt === "string" && alt.includes("@s.whatsapp.net")) {
        const resolved = alt.replace("@s.whatsapp.net", "").replace(/\D/g, "");
        if (resolved && resolved.length >= 8) { numero = resolved; break; }
      }
    }
  }

  const nome = chatInfo.nome || resolverNome({}, todasMsgs);

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
      agencia_id: agenciaId, mensagem_id: msg.key.id,
      de_mim: msg.key?.fromMe || false, tipo: ext.tipo,
      conteudo: ext.conteudo, created_at: timestamp,
    });
  }

  // Criar ou atualizar conversa
  let { data: conversa } = await supabase.from("conversas")
    .select("id, primeira_mensagem_at").eq("agencia_id", agenciaId).eq("contato_numero", numero).single();

  if (!conversa) {
    const { data: nova, error } = await supabase.from("conversas").insert({
      agencia_id: agenciaId, instancia: INST,
      contato_numero: numero, contato_nome: nome || numero,
      contato_foto: chatInfo.foto || null, contato_jid: jid,
      ultima_mensagem: ultimaMsgConteudo || chatInfo.ultimaMsg || "",
      ultima_mensagem_at: ultimaMsgAt || chatInfo.ultimaAt || new Date().toISOString(),
      primeira_mensagem_at: primeiraMsgAt || chatInfo.primeiraAt || null,
      nao_lidas: chatInfo.naoLidas || 0,
    }).select("id, primeira_mensagem_at").single();
    if (error) {
      const { data: existente } = await supabase.from("conversas")
        .select("id, primeira_mensagem_at").eq("agencia_id", agenciaId).eq("contato_numero", numero).single();
      conversa = existente;
    } else {
      conversa = nova;
    }
  } else {
    const upd: any = { contato_jid: jid, nao_lidas: chatInfo.naoLidas || 0 };
    if (nome) upd.contato_nome = nome;
    if (chatInfo.foto) upd.contato_foto = chatInfo.foto;
    if (ultimaMsgConteudo) upd.ultima_mensagem = ultimaMsgConteudo;
    if (ultimaMsgAt) upd.ultima_mensagem_at = ultimaMsgAt;
    // Só setar primeira_mensagem_at se a conversa ainda não tem — sync não deve sobrescrever data real
    if (primeiraMsgAt && !(conversa as any).primeira_mensagem_at) upd.primeira_mensagem_at = primeiraMsgAt;
    await supabase.from("conversas").update(upd).eq("id", conversa.id);
  }

  if (!conversa?.id) return 0;

  // Deduplicar por mensagem_id (paginação pode retornar a mesma msg em 2 páginas)
  const seenIds = new Set<string>();
  const batchUniq = batch.filter(m => {
    if (seenIds.has(m.mensagem_id)) return false;
    seenIds.add(m.mensagem_id);
    return true;
  });

  // Salvar mensagens em lotes de 50
  let totalSalvas = 0;
  for (let i = 0; i < batchUniq.length; i += 50) {
    const chunk = batchUniq.slice(i, i + 50).map(m => ({ ...m, conversa_id: conversa!.id }));
    const { error } = await supabase.from("mensagens").upsert(chunk, { onConflict: "mensagem_id" });
    if (!error) totalSalvas += chunk.length;
  }
  return totalSalvas;
}

// ─── Endpoint ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { agencia_id, paginas_por_conversa = 2, limite = 60 } = await req.json();
    if (!agencia_id) return NextResponse.json({ error: "agencia_id obrigatório" }, { status: 400 });

    const agencia = await getAgencia(agencia_id);
    if (!agencia?.evolution_url) {
      return NextResponse.json({ error: "Evolution não configurado para esta agência" }, { status: 400 });
    }

    const EVO_URL = agencia.evolution_url;
    const EVO_KEY = agencia.evolution_key;
    const INST = agencia.whatsapp_instancia;
    const MEU = (agencia.whatsapp_numero || "").replace(/\D/g, "");

    // 1. Listar todos os chats
    const resChats = await fetch(`${EVO_URL}/chat/findChats/${INST}`, {
      method: "POST",
      headers: { "apikey": EVO_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const chatsRaw = await resChats.json().catch(() => []);
    const chatList = Array.isArray(chatsRaw) ? chatsRaw : [];

    // Filtrar apenas chats individuais (não grupos)
    const chats = chatList.filter((chat: any) => {
      const jid = chat.remoteJid || chat.id || "";
      if (jid.includes("@g.us") || jid.includes("@broadcast") || jid === "status@broadcast") return false;
      if (!jid.includes("@s.whatsapp.net") && !jid.includes("@lid")) return false;
      let numero = "";
      if (jid.includes("@lid")) {
        numero = jid.split("@")[0];
      } else {
        numero = jid.replace("@s.whatsapp.net", "").replace(/\D/g, "");
      }
      if (!numero || numero === MEU || numero.length > 15) return false;
      return true;
    });

    // Ordenar por data da última mensagem (mais recente primeiro) e limitar
    chats.sort((a: any, b: any) => {
      const ta = Number(a.lastMessage?.messageTimestamp || a.updatedAt ? new Date(a.updatedAt).getTime() / 1000 : 0);
      const tb = Number(b.lastMessage?.messageTimestamp || b.updatedAt ? new Date(b.updatedAt).getTime() / 1000 : 0);
      return tb - ta;
    });
    const chatsParaSync = chats.slice(0, limite);

    console.log(`[sync-on-connect] ${INST}: ${chats.length} chats encontrados, sincronizando ${chatsParaSync.length}`);

    // 2. Sync em paralelo (lotes de 5 para não sobrecarregar a Evolution)
    let conversasProcessadas = 0;
    let mensagensTotais = 0;
    const CONCORRENCIA = 5;

    for (let i = 0; i < chatsParaSync.length; i += CONCORRENCIA) {
      const lote = chatsParaSync.slice(i, i + CONCORRENCIA);
      const resultados = await Promise.allSettled(lote.map(async (chat: any) => {
        const jid = chat.remoteJid || chat.id || "";
        const numero = jid.includes("@lid")
          ? jid.split("@")[0]
          : jid.replace("@s.whatsapp.net", "").replace(/\D/g, "");
        const lm = chat.lastMessage;
        const chatInfo = {
          numero,
          nome: chat.name || chat.formattedTitle || chat.pushName || "",
          foto: chat.profilePicUrl || null,
          ultimaMsg: lm?.message?.conversation || lm?.message?.extendedTextMessage?.text || "",
          ultimaAt: lm?.messageTimestamp ? new Date(Number(lm.messageTimestamp) * 1000).toISOString() : null,
          primeiraAt: chat.createdAt ? new Date(Number(chat.createdAt) * 1000).toISOString() : null,
          naoLidas: chat.unreadCount || 0,
        };
        return syncConversaQuick(agencia, jid, chatInfo, paginas_por_conversa);
      }));

      for (const r of resultados) {
        if (r.status === "fulfilled") { mensagensTotais += r.value; conversasProcessadas++; }
        else console.error(`[sync-on-connect] erro lote:`, r.reason);
      }
    }

    console.log(`[sync-on-connect] ${INST}: ${conversasProcessadas} conversas, ${mensagensTotais} mensagens`);
    return NextResponse.json({ ok: true, conversas: conversasProcessadas, mensagens: mensagensTotais });
  } catch (e) {
    console.error("[sync-on-connect] erro:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
