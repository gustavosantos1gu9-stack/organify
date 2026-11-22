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
    const lids = lista.filter((c: any) => (c.remoteJid||"").includes("@lid")).slice(0, 3);

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
        lastMessage_remoteJid: chat.lastMessage?.key?.remoteJid,
        lastMessage_remoteJidAlt: chat.lastMessage?.key?.remoteJidAlt,
        lastMessage_participant: chat.lastMessage?.key?.participant,
        msg_remoteJidAlt: msg?.key?.remoteJidAlt,
        msg_participant: msg?.key?.participant,
        msg_pushName: msg?.pushName,
      };
    }));

    return NextResponse.json({ amostras });
  } catch(e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
