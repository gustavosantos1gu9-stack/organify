import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { wa_numero, utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, link_id, origem, url_completa } = body;

    if (!wa_numero) return NextResponse.json({ ok: false });

    // Salvar rastreamento temporário (30 min de TTL via updated_at)
    await supabase.from("rastreamentos_pendentes").upsert({
      wa_numero: wa_numero.replace(/\D/g, ""),
      utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, link_id, origem,
      url_completa,
      created_at: new Date().toISOString(),
    }, { onConflict: "wa_numero" });

    return NextResponse.json({ ok: true });
  } catch(e) {
    return NextResponse.json({ ok: false });
  }
}
