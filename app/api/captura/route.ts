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
            utm_content, utm_term, fbclid, link_id, link_nome, origem, url_completa } = body;

    const origemFinal = origem || (
      utm_source ? (
        ["facebook","ig","fb"].some(s => (utm_source||"").toLowerCase().includes(s)) ? "Meta Ads" :
        utm_source.toLowerCase().includes("google") ? "Google Ads" : "Outras Origens"
      ) : "Não Rastreada"
    );

    const base = {
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      fbclid, link_id, origem: origemFinal, url_completa,
      wa_destino: wa_destino || null,
      created_at: new Date().toISOString(),
    };

    // Salvar com link_id como chave principal (mais confiável)
    if (link_id) {
      await supabase.from("rastreamentos_pendentes").upsert({
        ...base, wa_numero: link_id,
      }, { onConflict: "wa_numero" });
    }

    // Salvar com fbclid como chave
    if (fbclid) {
      await supabase.from("rastreamentos_pendentes").upsert({
        ...base, wa_numero: fbclid,
      }, { onConflict: "wa_numero" });
    }

    // Salvar com session_id como chave
    if (session_id) {
      await supabase.from("rastreamentos_pendentes").upsert({
        ...base, wa_numero: session_id,
      }, { onConflict: "wa_numero" });
    }

    // Incrementar cliques no link se tiver link_id
    if (link_id) {
      await supabase.rpc("incrementar_cliques", { link_uuid: link_id }).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch(e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
