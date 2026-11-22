import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getMetaToken, resolverIdsMeta, NUMERIC_ID_REGEX } from "@/lib/meta-tracking";

export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  // Proteger com WEBHOOK_SECRET
  const secret = process.env.WEBHOOK_SECRET;
  if (secret) {
    const url = new URL(req.url);
    const headerSecret = req.headers.get("x-webhook-secret");
    if (url.searchParams.get("secret") !== secret && headerSecret !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const { agencia_id } = await req.json();
    if (!agencia_id) {
      return NextResponse.json({ error: "agencia_id obrigatório" }, { status: 400 });
    }

    // Buscar token da agência (filha usa próprio, pai como fallback)
    const { data: ag } = await supabase.from("agencias")
      .select("meta_business_token, meta_token, parent_id")
      .eq("id", agencia_id).single();

    let parentMeta: { meta_business_token?: string | null; meta_token?: string | null } | null = null;
    if (ag?.parent_id) {
      const { data: p } = await supabase.from("agencias")
        .select("meta_business_token, meta_token").eq("id", ag.parent_id).single();
      parentMeta = p;
    }

    const adsToken = getMetaToken(ag || {}, parentMeta);
    if (!adsToken) {
      return NextResponse.json({ error: "Token Meta não configurado para esta agência" }, { status: 400 });
    }

    // Buscar conversas com UTMs numéricos ou com macros {{
    // Usa filter('column', 'match', regex) para query direcionada no banco
    const { data: conversasMacro } = await supabase.from("conversas")
      .select("id, utm_campaign, utm_content, utm_term, nome_anuncio")
      .eq("agencia_id", agencia_id)
      .or("utm_campaign.ilike.%{{%,utm_content.ilike.%{{%,utm_term.ilike.%{{%")
      .limit(200);

    const { data: conversasCampNum } = await supabase.from("conversas")
      .select("id, utm_campaign, utm_content, utm_term, nome_anuncio")
      .eq("agencia_id", agencia_id)
      .filter("utm_campaign", "match", "^\\d{10,20}$")
      .limit(200);

    const { data: conversasContentNum } = await supabase.from("conversas")
      .select("id, utm_campaign, utm_content, utm_term, nome_anuncio")
      .eq("agencia_id", agencia_id)
      .filter("utm_content", "match", "^\\d{10,20}$")
      .limit(200);

    const { data: conversasTermNum } = await supabase.from("conversas")
      .select("id, utm_campaign, utm_content, utm_term, nome_anuncio")
      .eq("agencia_id", agencia_id)
      .filter("utm_term", "match", "^\\d{10,20}$")
      .limit(200);

    // Deduplicar por ID
    const candidatasMap = new Map<string, any>();
    for (const c of [
      ...(conversasMacro || []),
      ...(conversasCampNum || []),
      ...(conversasContentNum || []),
      ...(conversasTermNum || []),
    ]) candidatasMap.set(c.id, c);
    const candidatas = Array.from(candidatasMap.values());

    if (!candidatas.length) {
      return NextResponse.json({ ok: true, total: 0, resolvidos: 0 });
    }

    let resolvidos = 0;
    const errosPorCodigo: Record<string, number> = {};

    for (const conv of candidatas) {
      try {
        const ids = await resolverIdsMeta({
          utm_campaign: conv.utm_campaign,
          utm_content: conv.utm_content,
          utm_term: conv.utm_term,
          nome_anuncio: conv.nome_anuncio,
        }, adsToken);

        const mudou =
          ids.utm_campaign !== conv.utm_campaign ||
          ids.utm_content !== conv.utm_content ||
          ids.utm_term !== conv.utm_term;

        if (!mudou && !ids.rastreio_erro) continue;

        const update: any = {
          utm_campaign: ids.utm_campaign,
          utm_content: ids.utm_content,
          utm_term: ids.utm_term,
          nome_anuncio: ids.nome_anuncio,
          meta_campaign_id: ids.meta_campaign_id,
          meta_adset_id: ids.meta_adset_id,
          meta_ad_id: ids.meta_ad_id,
          rastreio_status: ids.rastreio_erro ? "erro_macro" : "resolvido",
        };
        if (ids.rastreio_erro) update.rastreio_erro = ids.rastreio_erro;

        await supabase.from("conversas").update(update).eq("id", conv.id);
        resolvidos++;
      } catch (e: any) {
        const chave = String(e.code ?? "??");
        errosPorCodigo[chave] = (errosPorCodigo[chave] || 0) + 1;
      }
    }

    return NextResponse.json({
      ok: true,
      total: candidatas.length,
      resolvidos,
      erros: errosPorCodigo,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
