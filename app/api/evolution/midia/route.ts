import { NextRequest, NextResponse } from "next/server";

const EVO_URL = "https://evolution-api-production-e0b8.up.railway.app";
const EVO_KEY = "6656711fd37b4eadc6a9d6a31b84c8648e19708f55e7f09b85b7b61d9660d6ad";

export async function POST(req: NextRequest) {
  try {
    const { mensagem_id, instancia } = await req.json();

    const res = await fetch(`${EVO_URL}/chat/getBase64FromMediaMessage/${instancia}`, {
      method: "POST",
      headers: { "apikey": EVO_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ message: { key: { id: mensagem_id } }, convertToMp4: false }),
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch(e) {
    console.error("Erro ao buscar mídia:", e);
    return NextResponse.json({ error: "Erro ao buscar mídia" }, { status: 500 });
  }
}
