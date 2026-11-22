import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Caracteres legíveis, excluindo I, O, 0, 1 para evitar confusão
const REF_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function gerarRefCode(): string {
  let code = "";
  for (let i = 0; i < 5; i++) code += REF_CODE_CHARS[Math.floor(Math.random() * REF_CODE_CHARS.length)];
  return code;
}

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

    // Gerar ref_code único (máx 3 tentativas em caso de colisão)
    let refCode: string | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      refCode = gerarRefCode();
      // Verificar se já existe código ativo com mesmo valor
      const { data: existente } = await supabase.from("rastreamentos_pendentes")
        .select("id").eq("ref_code", refCode).is("usado_em", null).limit(1).single();
      if (!existente) break; // código disponível
      refCode = null; // colisão — tentar novamente
    }

    // Resolver agencia_id a partir do link_id
    let agencia_id: string | null = null;
    if (link_id) {
      try {
        const { data: link } = await supabase.from("links_campanha")
          .select("agencia_id").eq("id", link_id).single();
        agencia_id = link?.agencia_id || null;
      } catch {}
    }

    // Uma linha por clique, keyed by session_id — sem duplicatas, sem conflito no índice único de ref_code
    if (!session_id) {
      return NextResponse.json({ ok: false, erros: ["session_id obrigatório"] });
    }

    const { error } = await supabase.from("rastreamentos_pendentes").upsert({
      wa_numero: session_id,
      utm_source: utm_source || null,
      utm_medium: utm_medium || null,
      utm_campaign: utm_campaign || null,
      utm_content: utm_content || null,
      utm_term: utm_term || null,
      fbclid: fbclid || null,
      link_id: link_id || null,
      agencia_id,
      origem: origemFinal,
      url_completa: url_completa || null,
      wa_destino: wa_destino || null,
      created_at: new Date().toISOString(),
      ref_code: refCode,
    }, { onConflict: "wa_numero" });

    if (error) {
      console.error("Captura erro:", error.message);
      return NextResponse.json({ ok: false, erros: [error.message] });
    }

    // Incrementar cliques no link se tiver link_id
    if (link_id) {
      try { await supabase.rpc("incrementar_cliques", { link_uuid: link_id }); } catch {}
    }

    return NextResponse.json({ ok: true, ref_code: refCode });
  } catch(e) {
    console.error("Captura exceção:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
