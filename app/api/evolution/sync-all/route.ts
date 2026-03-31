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
  if (m.ephemeralMessage?.message) return extrairConteudo({ message: m.ephemeralMessage.message });
  if (m.reactionMessage || m.protocolMessage) return null;
  return null;
}

async function buscarTodasMensagens(evoUrl: string, evoKey: string, instancia: string, jid: string): Promise<any[]> {
  const todas: any[] = [];
  let page = 1;
  const MAX_PAGES = 50;

  while (page <= MAX_PAGES) {
    try {
      const res = await fetch(`${evoUrl}/chat/findMessages/${instancia}`, {
        method: "POST",
        headers: { "apikey": evoKey, "Content-Type": "application/json" },
        body: JSON.stringify({ where: { key: { remoteJid: jid } }, limit: 100, page }),
      });
      if (!res.ok) break;
      const data = await res.json();
      const records = data?.messages?.records || data?.records || [];
      if (!Array.isArray(records) || records.length === 0) break;
      todas.push(...records);
      if (records.length < 100) break;
      page++;
    } catch {
      break;
    }
  }

  return todas;
}

function resolverNome(chat: any, msgs: any[]): string {
  // Campos do chat
  const campos = [
    chat.pushName, chat.name, chat.contact?.pushName, chat.contact?.name,
    chat.notify, chat.verifiedName, chat.formattedTitle,
  ];
  for (const c of campos) {
    if (c && typeof c === "string" && c.trim() && !/^\d+$/.test(c.trim())) return c.trim();
  }
  // pushName de mensagens recebidas
  for (const msg of msgs) {
    if (!msg.key?.fromMe && msg.pushName && typeof msg.pushName === "string" && msg.pushName.trim()) {
      return msg.pushName.trim();
    }
  }
  return "";
}

// ─── Endpoint ────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { agencia_id, offset = 0, lote = 10 } = body;

    // Config da agência (herda da mãe se filha)
    let { data: agencia } = await supabase.from("agencias")
      .select("id, evolution_url, evolution_key, whatsapp_instancia, whatsapp_numero, parent_id")
      .eq("id", agencia_id).single();

    if (agencia && !agencia.evolution_url && agencia.parent_id) {
      const { data: parent } = await supabase.from("agencias")
        .select("evolution_url, evolution_key").eq("id", agencia.parent_id).single();
      if (parent) agencia = { ...agencia, evolution_url: parent.evolution_url, evolution_key: parent.evolution_key };
    }

    if (!agencia?.evolution_url) return NextResponse.json({ error: "Agência não configurada" }, { status: 400 });

    const EVO = { url: agencia.evolution_url, key: agencia.evolution_key, inst: agencia.whatsapp_instancia };
    const MEU_NUMERO = (agencia.whatsapp_numero || "").replace(/\D/g, "");

    // ─── Buscar TODOS os chats + contatos ───
    const [resChats, resContacts] = await Promise.all([
      fetch(`${EVO.url}/chat/findChats/${EVO.inst}`, {
        method: "POST",
        headers: { "apikey": EVO.key, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      fetch(`${EVO.url}/chat/findContacts/${EVO.inst}`, {
        method: "POST",
        headers: { "apikey": EVO.key, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }).catch(() => null),
    ]);

    const chats = await resChats.json();
    const chatList = Array.isArray(chats) ? chats : [];

    // Mapa de contatos por jid (para nomes)
    const contactMap = new Map<string, any>();
    if (resContacts && resContacts.ok) {
      const contacts = await resContacts.json();
      if (Array.isArray(contacts)) {
        for (const c of contacts) {
          const id = c.id || c.remoteJid || "";
          if (id) contactMap.set(id, c);
        }
      }
    }

    // Combinar: chats individuais + contatos que não têm chat
    const jidSet = new Set<string>();
    const conversasCandidatas: { jid: string; chat: any; contact: any }[] = [];

    // Primeiro: chats
    for (const chat of chatList) {
      const jid = chat.remoteJid || chat.id || "";
      if (jid.includes("@g.us") || jid.includes("@broadcast") || jid === "status@broadcast") continue;
      if (!jid.includes("@s.whatsapp.net") && !jid.includes("@lid")) continue;
      jidSet.add(jid);
      conversasCandidatas.push({ jid, chat, contact: contactMap.get(jid) || null });
    }

    // Segundo: contatos que não apareceram nos chats
    for (const [id, contact] of contactMap) {
      if (jidSet.has(id)) continue;
      if (id.includes("@g.us") || id.includes("@broadcast")) continue;
      if (!id.includes("@s.whatsapp.net") && !id.includes("@lid")) continue;
      jidSet.add(id);
      conversasCandidatas.push({ jid: id, chat: null, contact });
    }

    // Paginar
    const loteAtual = conversasCandidatas.slice(offset, offset + lote);
    let conversasProcessadas = 0;
    let mensagensSalvas = 0;

    for (const { jid, chat, contact } of loteAtual) {
      const isLid = jid.includes("@lid");

      // ─── 1. Buscar TODAS as mensagens ───
      const todasMsgs = await buscarTodasMensagens(EVO.url, EVO.key, EVO.inst, jid);

      // ─── 2. Resolver número ───
      let numeroReal = "";
      if (isLid) {
        // @lid: buscar número real de várias fontes
        const tentativas = [
          chat?.lastMessage?.key?.remoteJidAlt,
          chat?.participant,
          contact?.id?.replace?.("@lid", ""),
        ];
        for (const t of tentativas) {
          if (typeof t === "string" && t.includes("@s.whatsapp.net")) {
            numeroReal = t.replace("@s.whatsapp.net", "").replace(/\D/g, "");
            break;
          }
        }
        // Tentar das mensagens
        if (!numeroReal) {
          for (const msg of todasMsgs.slice(0, 20)) {
            const alt = msg.key?.remoteJidAlt || msg.participant || "";
            if (typeof alt === "string" && alt.includes("@s.whatsapp.net")) {
              numeroReal = alt.replace("@s.whatsapp.net", "").replace(/\D/g, "");
              break;
            }
          }
        }
        if (!numeroReal) continue; // sem número = impossível salvar
      } else {
        numeroReal = jid.replace("@s.whatsapp.net", "").replace(/\D/g, "");
      }

      if (!numeroReal || numeroReal === MEU_NUMERO) continue;
      if (numeroReal.length < 8 || numeroReal.length > 15) continue; // relaxado de 10 pra 8

      // ─── 3. Resolver nome ───
      const chatObj = chat || {};
      if (contact) {
        chatObj.contact = contact;
        if (!chatObj.pushName && contact.pushName) chatObj.pushName = contact.pushName;
        if (!chatObj.name && (contact.name || contact.notify || contact.verifiedName)) {
          chatObj.name = contact.name || contact.notify || contact.verifiedName;
        }
      }
      const nome = resolverNome(chatObj, todasMsgs);
      const foto = chat?.profilePicUrl || contact?.profilePicUrl || null;

      // ─── 4. Processar mensagens ───
      const msgsValidas = todasMsgs
        .filter((m: any) => m.key?.id && Number(m.messageTimestamp) > 0)
        .sort((a: any, b: any) => Number(a.messageTimestamp) - Number(b.messageTimestamp));

      let primeiraMsgAt: string | null = null;
      let ultimaMsgAt: string | null = null;
      let ultimaMsgConteudo = "";
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

      // Fallback: data do chat
      if (!primeiraMsgAt) {
        const chatTs = chat?.createdAt || chat?.conversationTimestamp || chat?.t || 0;
        if (chatTs) primeiraMsgAt = new Date(Number(chatTs) * 1000).toISOString();
      }

      // ─── 5. Criar/atualizar conversa ───
      let { data: conversa } = await supabase.from("conversas")
        .select("id").eq("agencia_id", agencia.id).eq("contato_numero", numeroReal).single();

      const conversaData: any = {
        contato_jid: jid,
        nao_lidas: chat?.unreadCount || 0,
      };
      if (nome) conversaData.contato_nome = nome;
      if (foto) conversaData.contato_foto = foto;
      if (ultimaMsgConteudo) conversaData.ultima_mensagem = ultimaMsgConteudo;
      if (ultimaMsgAt) conversaData.ultima_mensagem_at = ultimaMsgAt;
      if (primeiraMsgAt) conversaData.primeira_mensagem_at = primeiraMsgAt;

      if (!conversa) {
        const { data: nova } = await supabase.from("conversas").insert({
          agencia_id: agencia.id,
          instancia: EVO.inst,
          contato_numero: numeroReal,
          contato_nome: nome || numeroReal,
          contato_foto: foto,
          contato_jid: jid,
          ultima_mensagem: ultimaMsgConteudo || "",
          ultima_mensagem_at: ultimaMsgAt || new Date().toISOString(),
          primeira_mensagem_at: primeiraMsgAt,
          nao_lidas: chat?.unreadCount || 0,
        }).select("id").single();
        conversa = nova;
      } else {
        await supabase.from("conversas").update(conversaData).eq("id", conversa.id);
      }

      if (!conversa?.id) continue;

      // ─── 6. Salvar mensagens em lotes ───
      for (let i = 0; i < batch.length; i += 50) {
        const chunk = batch.slice(i, i + 50).map(m => ({ ...m, conversa_id: conversa!.id }));
        const { error } = await supabase.from("mensagens").upsert(chunk, { onConflict: "mensagem_id" });
        if (!error) mensagensSalvas += chunk.length;
      }

      conversasProcessadas++;
    }

    return NextResponse.json({
      ok: true,
      conversas: conversasProcessadas,
      mensagens: mensagensSalvas,
      offset,
      processados: loteAtual.length,
      total: conversasCandidatas.length,
      proximo_offset: offset + lote,
      tem_mais: offset + lote < conversasCandidatas.length,
    });
  } catch(e) {
    console.error("sync-all erro:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
