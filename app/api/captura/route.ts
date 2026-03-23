import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { session_id, wa_destino, utm_source, utm_medium, utm_campaign,
            utm_content, utm_term, fbclid, link_id, origem, url_completa } = body;

    // Salvar rastreamento pendente com fbclid como chave de cruzamento
    // O webhook vai buscar por fbclid quando o lead mandar mensagem
    if (fbclid) {
      await supabase.from("rastreamentos_pendentes").upsert({
        wa_numero: fbclid, // usa fbclid como chave temporária
        utm_source, utm_medium, utm_campaign, utm_content, utm_term,
        fbclid, link_id, origem, url_completa,
        created_at: new Date().toISOString(),
      }, { onConflict: "wa_numero" });
    }

    // Também salvar com session_id
    if (session_id) {
      await supabase.from("rastreamentos_pendentes").upsert({
        wa_numero: session_id,
        utm_source, utm_medium, utm_campaign, utm_content, utm_term,
        fbclid, link_id, origem, url_completa,
        created_at: new Date().toISOString(),
      }, { onConflict: "wa_numero" });
    }

    return NextResponse.json({ ok: true });
  } catch(e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
