import { NextRequest, NextResponse } from "next/server";

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
    
    // Mostrar os primeiros 5 chats com todos os campos
    const amostra = lista.slice(0, 5).map((c: any) => ({
      id: c.id,
      remoteJid: c.remoteJid,
      pushName: c.pushName,
      name: c.name,
      profilePicUrl: c.profilePicUrl,
      campos: Object.keys(c),
    }));

    // Contar por tipo
    const grupos = lista.filter((c: any) => (c.remoteJid||"").includes("@g.us")).length;
    const individuaisS = lista.filter((c: any) => (c.remoteJid||"").includes("@s.whatsapp.net")).length;
    const individuaisLid = lista.filter((c: any) => (c.remoteJid||"").includes("@lid")).length;
    const outros = lista.filter((c: any) => !["@g.us","@s.whatsapp.net","@lid"].some(t => (c.remoteJid||"").includes(t))).length;

    return NextResponse.json({ 
      total: lista.length, grupos, individuaisS, individuaisLid, outros,
      amostra 
    });
  } catch(e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
