import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET /api/rastreamento/ctwa-retro?agencia_id=...
// Marca retroativamente conversas com JID @lid como "Meta Ads" (CTWA)
// JID @lid é exclusivo de Click-to-WhatsApp — identifica lead que veio de anúncio Meta
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const agenciaId = searchParams.get("agencia_id");
    if (!agenciaId) return NextResponse.json({ ok: false, error: "agencia_id obrigatório" });

    // Buscar todas as conversas @lid sem rastreio
    const { data: conversas, error } = await supabase.from("conversas")
      .select("id, contato_nome, contato_jid, origem")
      .eq("agencia_id", agenciaId)
      .like("contato_jid", "%@lid")
      .eq("origem", "Não Rastreada");

    if (error) return NextResponse.json({ ok: false, error: error.message });

    if (!conversas?.length) {
      return NextResponse.json({ ok: true, atualizadas: 0, mensagem: "Nenhuma conversa @lid sem rastreio encontrada" });
    }

    // Atualizar em lote
    const ids = conversas.map(c => c.id);
    const { error: errUpdate } = await supabase.from("conversas")
      .update({
        origem: "Meta Ads",
        utm_source: "meta",
        utm_medium: "ctwa",
      })
      .in("id", ids);

    if (errUpdate) return NextResponse.json({ ok: false, error: errUpdate.message });

    const nomes = conversas.slice(0, 10).map(c => c.contato_nome || c.contato_jid).join(", ");

    return NextResponse.json({
      ok: true,
      atualizadas: conversas.length,
      exemplos: nomes + (conversas.length > 10 ? ` ... +${conversas.length - 10} mais` : ""),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
