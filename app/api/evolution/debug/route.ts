import { NextResponse } from "next/server";

const EVO_URL = "https://evolution-api-production-e0b8.up.railway.app";
const EVO_KEY = "6656711fd37b4eadc6a9d6a31b84c8648e19708f55e7f09b85b7b61d9660d6ad";
const INSTANCIA = "salxdigital";

export async function GET() {
  try {
    const res = await fetch(`${EVO_URL}/chat/findChats/${INSTANCIA}`, {
      method: "POST",
      headers: { "apikey": EVO_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const chats = await res.json();
    const lista = Array.isArray(chats) ? chats : [];

    // Pegar 3 amostras de @lid
    const lids = lista.filter((c: any) => (c.remoteJid||"").includes("@lid")).slice(0, 3);
    
    // Para cada @lid, buscar uma mensagem para ver o remoteJidAlt
    const amostras = await Promise.all(lids.map(async (chat: any) => {
      const resMsgs = await fetch(`${EVO_URL}/chat/findMessages/${INSTANCIA}`, {
        method: "POST",
        headers: { "apikey": EVO_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ where: { key: { remoteJid: chat.remoteJid } }, limit: 1 }),
      });
      const msgsData = await resMsgs.json();
      const msg = msgsData?.messages?.records?.[0];
      return {
        remoteJid: chat.remoteJid,
        pushName: chat.pushName,
        profilePicUrl: chat.profilePicUrl ? "tem foto" : "sem foto",
        msg_key: msg?.key,
        msg_remoteJidAlt: msg?.key?.remoteJidAlt,
        todos_campos_chat: Object.keys(chat),
      };
    }));

    return NextResponse.json({ total_lid: lids.length, amostras });
  } catch(e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
