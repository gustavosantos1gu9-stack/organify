import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function getAgenciaPorInstancia(instancia: string) {
  const { data } = await supabase
    .from("agencias")
    .select("id, evolution_url, evolution_key, whatsapp_numero, meta_pixel_id, meta_token, meta_ativo")
    .eq("whatsapp_instancia", instancia)
    .single();
  return data;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event, data, instance } = body;

    if (event === "messages.upsert" || event === "MESSAGES_UPSERT") {
      const msg = data?.messages?.[0] || data;
      if (!msg) return NextResponse.json({ ok: true });

      const fromMe = msg.key?.fromMe || false;
      const remoteJid = msg.key?.remoteJid || "";

      // Ignorar grupos, @lid, e mensagens enviadas por mim
      if (!remoteJid || remoteJid.includes("@g.us")) return NextResponse.json({ ok: true });
      if (remoteJid.includes("@lid")) return NextResponse.json({ ok: true });
      if (fromMe) return NextResponse.json({ ok: true });

      // Descobrir agência pela instância
      const instanciaName = instance || body.instanceName || "";
      const agencia = await getAgenciaPorInstancia(instanciaName);
      if (!agencia) return NextResponse.json({ ok: true });

      const numero = remoteJid.replace("@s.whatsapp.net", "");
      const nome = msg.pushName || numero;
      const msgId = msg.key?.id;
      const timestamp = msg.messageTimestamp
        ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
        : new Date().toISOString();

      // Extrair conteúdo
      let tipo = "text"; let conteudo = "";
      const m = msg.message;
      if (m?.conversation) conteudo = m.conversation;
      else if (m?.extendedTextMessage?.text) conteudo = m.extendedTextMessage.text;
      else if (m?.imageMessage) { tipo = "image"; conteudo = m.imageMessage.caption || "📷 Imagem"; }
      else if (m?.audioMessage) { tipo = "audio"; conteudo = "🎵 Áudio"; }
      else if (m?.videoMessage) { tipo = "video"; conteudo = m.videoMessage.caption || "🎥 Vídeo"; }
      else if (m?.documentMessage) { tipo = "document"; conteudo = m.documentMessage.fileName || "📄 Documento"; }
      else if (m?.stickerMessage) { tipo = "sticker"; conteudo = "😄 Sticker"; }
      else conteudo = "Mensagem";

      // Buscar foto
      let foto = null;
      try {
        const resPerfil = await fetch(`${agencia.evolution_url}/chat/fetchProfile/${instanciaName}`, {
          method: "POST",
          headers: { "apikey": agencia.evolution_key, "Content-Type": "application/json" },
          body: JSON.stringify({ number: numero }),
        });
        const perfil = await resPerfil.json();
        if (perfil?.picture) foto = perfil.picture;
      } catch {}

      // Buscar ou criar conversa
      let { data: conversa } = await supabase.from("conversas")
        .select("*").eq("agencia_id", agencia.id).eq("contato_numero", numero).single();

      if (!conversa) {
        const { data: nova } = await supabase.from("conversas").insert({
          agencia_id: agencia.id, instancia: instanciaName,
          contato_numero: numero, contato_nome: nome, contato_foto: foto,
          ultima_mensagem: conteudo, ultima_mensagem_at: timestamp, nao_lidas: 1,
        }).select().single();
        conversa = nova;
      } else {
        await supabase.from("conversas").update({
          ultima_mensagem: conteudo, ultima_mensagem_at: timestamp,
          contato_nome: nome,
          nao_lidas: (conversa.nao_lidas || 0) + 1,
        }).eq("id", conversa.id);
      }

      if (conversa && msgId) {
        await supabase.from("mensagens").upsert({
          conversa_id: conversa.id, agencia_id: agencia.id,
          mensagem_id: msgId, de_mim: false, tipo, conteudo, created_at: timestamp,
        }, { onConflict: "mensagem_id" });
      }

      // Disparar evento Meta se configurado
      if (agencia.meta_ativo && agencia.meta_pixel_id && agencia.meta_token && !conversa?.id) {
        fetch(`https://graph.facebook.com/v18.0/${agencia.meta_pixel_id}/events?access_token=${agencia.meta_token}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: [{ event_name: "Lead", event_time: Math.floor(Date.now()/1000), action_source: "website" }] }),
        }).catch(() => {});
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
