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

// Extrai UTMs de qualquer formato de URL (absoluta ou relativa)
function extrairUtms(linkGerado: string): Record<string, string> {
  const result: Record<string, string> = {};
  try {
    // Tentar como URL absoluta
    const url = new URL(linkGerado);
    url.searchParams.forEach((v, k) => { result[k] = v; });
  } catch {
    // URL relativa — extrair query string manualmente
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

    // Buscar todos os links da agência
    const { data: links } = await supabase
      .from("links_campanha")
      .select("id, nome, wa_mensagem, utm_campaign, link_gerado")
      .eq("agencia_id", agencia_id)
      .order("created_at", { ascending: false });

    if (!links?.length) {
      return NextResponse.json({ error: "Nenhum link rastreável encontrado", resultados: [] });
    }

    // Buscar conversas não rastreadas (ou uma específica) — apenas últimos 30 dias
    const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    let query = supabase
      .from("conversas")
      .select("id, contato_numero, contato_nome, origem, utm_campaign")
      .eq("agencia_id", agencia_id);

    if (conversa_id) {
      query = query.eq("id", conversa_id);
    } else {
      query = query.or("origem.is.null,origem.eq.Não Rastreada")
        .gte("created_at", trintaDiasAtras);
    }

    const { data: conversas } = await query;
    if (!conversas?.length) {
      return NextResponse.json({ ok: true, msg: "Nenhuma conversa para rastrear", resultados: [] });
    }

    const resultados: { id: string; nome: string; status: string; link_nome?: string; campanha?: string; utms?: Record<string, string> }[] = [];

    for (const conv of conversas) {
      if (!conversa_id && conv.origem && conv.origem !== "Não Rastreada") {
        resultados.push({ id: conv.id, nome: conv.contato_nome, status: "ja_rastreado" });
        continue;
      }

      // Buscar primeiras mensagens do lead
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

      // Match por conteúdo da mensagem com os links
      let melhorMatch: typeof links[0] | null = null;

      for (const msg of msgs) {
        const msgNorm = normalizar(msg.conteudo);
        if (!msgNorm || msgNorm.length < 5) continue;

        for (const link of links) {
          const linkMsgNorm = normalizar(link.wa_mensagem);
          if (!linkMsgNorm) continue;

          if (msgNorm === linkMsgNorm || msgNorm.includes(linkMsgNorm) || linkMsgNorm.includes(msgNorm)) {
            melhorMatch = link;
            break;
          }

          // Match parcial (>70% palavras)
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

      // Se não achou por mensagem e só tem 1 link, assumir esse
      if (!melhorMatch && links.length === 1) {
        melhorMatch = links[0];
      }

      if (melhorMatch) {
        // Extrair TODAS as UTMs do link_gerado
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
          id: conv.id,
          nome: conv.contato_nome,
          status: error ? "erro" : "rastreado",
          link_nome: melhorMatch.nome,
          campanha: updateData.utm_campaign,
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
