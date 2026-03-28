import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { mensagem_id, instancia, agencia_id } = await req.json();

    // Buscar config da agência
    const query = agencia_id
      ? supabase.from("agencias").select("evolution_url,evolution_key").eq("id", agencia_id).single()
      : supabase.from("agencias").select("evolution_url,evolution_key").eq("whatsapp_instancia", instancia).single();

    const { data: agencia } = await query;
    if (!agencia) return NextResponse.json({ error: "Não configurado" }, { status: 400 });

    const res = await fetch(`${agencia.evolution_url}/chat/getBase64FromMediaMessage/${instancia}`, {
      method: "POST",
      headers: { "apikey": agencia.evolution_key, "Content-Type": "application/json" },
      body: JSON.stringify({ message: { key: { id: mensagem_id } }, convertToMp4: false }),
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch(e) {
    console.error("Erro ao buscar mídia:", e);
    return NextResponse.json({ error: "Erro ao buscar mídia" }, { status: 500 });
  }
}
