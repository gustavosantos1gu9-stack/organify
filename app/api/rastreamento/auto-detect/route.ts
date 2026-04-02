import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function normalizar(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^\w\sáéíóúâêôãõàçü]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extrairUtms(linkGerado: string): Record<string, string> {
  const result: Record<string, string> = {};
  try {
    const url = new URL(linkGerado);
    url.searchParams.forEach((v, k) => { result[k] = v; });
  } catch {
    const qIdx = (linkGerado || "").indexOf("?");
    if (qIdx >= 0) {
      const qs = linkGerado.substring(qIdx + 1);
      for (const pair of qs.split("&")) {
        const [k, ...vParts] = pair.split("=");
        if (k) result[decodeURIComponent(k)] = decodeURIComponent(vParts.join("=") || "");
      }
    }
  }
  return result;
}

export async function POST(req: NextRequest) {
  try {
    const { agencia_id, conversa_id } = await req.json();
    if (!agencia_id) {
      return NextResponse.json({ error: "agencia_id obrigatório" }, { status: 400 });
    }

    // Buscar token e links da agência
    const { data: agencia } = await supabase.from("agencias")
      .select("meta_business_token, meta_token")
      .eq("id", agencia_id).single();
    const adsToken = agencia?.meta_business_token || agencia?.meta_token || null;

    const { data: links } = await supabase
      .from("links_campanha")
      .select("id, nome, wa_mensagem, utm_campaign, link_gerado")
      .eq("agencia_id", agencia_id)
      .order("created_at", { ascending: false });

    // Buscar conversas: não rastreadas OU Meta Ads sem campanha (CTWA incompleto)
    const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    let query = supabase
      .from("conversas")
      .select("id, contato_numero, contato_nome, origem, utm_campaign, utm_content, fbclid")
      .eq("agencia_id", agencia_id);

    if (conversa_id) {
      query = query.eq("id", conversa_id);
    } else {
      // Não rastreadas OU Meta Ads sem campanha preenchida
      query = query.or("origem.is.null,origem.eq.Não Rastreada,and(origem.eq.Meta Ads,utm_campaign.is.null)")
        .gte("created_at", trintaDiasAtras);
    }

    const { data: conversas } = await query;
    if (!conversas?.length) {
      return NextResponse.json({ ok: true, msg: "Nenhuma conversa para rastrear", resultados: [] });
    }

    const resultados: { id: string; nome: string; status: string; link_nome?: string; campanha?: string; utms?: Record<string, string> }[] = [];

    for (const conv of conversas) {
      // ── CTWA incompleto: Meta Ads sem campanha → tentar resolver via Meta API ──
      if (conv.origem === "Meta Ads" && !conv.utm_campaign) {
        // Tentar resolver pelo sourceId no utm_content ou pelo fbclid
        const sourceId = conv.utm_content && /^\d+$/.test(conv.utm_content) ? conv.utm_content : null;

        if (sourceId && adsToken) {
          try {
            const adRes = await fetch(
              `https://graph.facebook.com/v21.0/${sourceId}?fields=name,campaign_id,adset_id&access_token=${adsToken}`
            );
            const adData = await adRes.json();
            if (adData && !adData.error && adData.campaign_id) {
              // Buscar nomes da campanha e conjunto
              const [campRes, conjRes] = await Promise.all([
                fetch(`https://graph.facebook.com/v21.0/${adData.campaign_id}?fields=name&access_token=${adsToken}`),
                fetch(`https://graph.facebook.com/v21.0/${adData.adset_id}?fields=name&access_token=${adsToken}`),
              ]);
              const campData = await campRes.json();
              const conjData = await conjRes.json();
              const campanha = campData?.name || "";
              const conjunto = conjData?.name || "";
              const criativo = adData.name || "";

              await supabase.from("conversas").update({
                utm_campaign: campanha,
                utm_content: conjunto ? `${conjunto}_${criativo}` : conv.utm_content,
                nome_anuncio: criativo,
                utm_source: "facebook",
                utm_medium: "cpc",
              }).eq("id", conv.id);

              resultados.push({
                id: conv.id, nome: conv.contato_nome, status: "rastreado",
                campanha, utms: { utm_source: "facebook", utm_medium: "cpc", utm_campaign: campanha },
              });
              continue;
            }
          } catch {}
        }

        // Sem sourceId ou sem token — não tem como resolver
        resultados.push({ id: conv.id, nome: conv.contato_nome, status: "sem_match" });
        continue;
      }

      // ── Já rastreado ou CTWA com fbclid → não sobrescrever ──
      if (!conversa_id && conv.origem && conv.origem !== "Não Rastreada") {
        resultados.push({ id: conv.id, nome: conv.contato_nome, status: "ja_rastreado" });
        continue;
      }
      if (conv.fbclid) {
        resultados.push({ id: conv.id, nome: conv.contato_nome, status: "ja_rastreado" });
        continue;
      }

      // ── Não rastreada: tentar match por mensagem com links rastreáveis ──
      if (!links?.length) {
        resultados.push({ id: conv.id, nome: conv.contato_nome, status: "sem_match" });
        continue;
      }

      const { data: msgs } = await supabase
        .from("mensagens")
        .select("conteudo")
        .eq("conversa_id", conv.id)
        .eq("de_mim", false)
        .order("created_at", { ascending: true })
        .limit(3);

      if (!msgs?.length) {
        resultados.push({ id: conv.id, nome: conv.contato_nome, status: "sem_mensagens" });
        continue;
      }

      let melhorMatch: typeof links[0] | null = null;

      for (const msg of msgs) {
        const msgNorm = normalizar(msg.conteudo);
        if (!msgNorm || msgNorm.length < 5) continue;

        for (const link of links) {
          const linkMsgNorm = normalizar(link.wa_mensagem);
          if (!linkMsgNorm) continue;

          // Match: mensagem deve ser igual ou conter a mensagem do link (não o contrário)
          if (msgNorm === linkMsgNorm || msgNorm.includes(linkMsgNorm)) {
            melhorMatch = link;
            break;
          }

          const palavrasMsg = msgNorm.split(" ").filter(w => w.length > 2);
          const palavrasLink = linkMsgNorm.split(" ").filter(w => w.length > 2);
          if (palavrasLink.length > 0) {
            const coincidentes = palavrasMsg.filter(p => palavrasLink.includes(p));
            if (coincidentes.length / palavrasLink.length >= 0.7) {
              melhorMatch = link;
              break;
            }
          }
        }
        if (melhorMatch) break;
      }

      if (melhorMatch) {
        const params = extrairUtms(melhorMatch.link_gerado);
        const updateData = {
          origem: "Meta Ads",
          utm_source: params.utm_source || "facebook",
          utm_medium: params.utm_medium || "cpc",
          utm_campaign: params.utm_campaign || melhorMatch.utm_campaign || melhorMatch.nome.toLowerCase().replace(/\s+/g, "-"),
          utm_content: params.utm_content || null,
          utm_term: params.utm_term || null,
          link_id: melhorMatch.id,
          link_nome: params.link_nome || melhorMatch.nome,
        };

        const { error } = await supabase.from("conversas").update(updateData).eq("id", conv.id);

        resultados.push({
          id: conv.id, nome: conv.contato_nome,
          status: error ? "erro" : "rastreado",
          link_nome: melhorMatch.nome, campanha: updateData.utm_campaign,
          utms: { utm_source: updateData.utm_source, utm_medium: updateData.utm_medium, utm_campaign: updateData.utm_campaign },
        });
      } else {
        resultados.push({ id: conv.id, nome: conv.contato_nome, status: "sem_match" });
      }
    }

    return NextResponse.json({
      ok: true,
      total: conversas.length,
      rastreados: resultados.filter(r => r.status === "rastreado").length,
      resultados,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
