import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Normaliza texto para comparação (remove espaços extras, pontuação, lowercase)
function normalizar(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^\w\sáéíóúâêôãõàçü]/g, "")
    .replace(/\s+/g, " ")
    .trim();
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

    // Buscar conversas não rastreadas (ou uma específica)
    let query = supabase
      .from("conversas")
      .select("id, contato_numero, contato_nome, origem, utm_campaign")
      .eq("agencia_id", agencia_id);

    if (conversa_id) {
      query = query.eq("id", conversa_id);
    } else {
      // Só buscar conversas sem rastreamento
      query = query.or("origem.is.null,origem.eq.Não Rastreada");
    }

    const { data: conversas } = await query;
    if (!conversas?.length) {
      return NextResponse.json({ ok: true, msg: "Nenhuma conversa para rastrear", resultados: [] });
    }

    const resultados: { id: string; nome: string; status: string; link_nome?: string; campanha?: string }[] = [];

    for (const conv of conversas) {
      // Já rastreada? (para caso de conversa_id específico que já tem tracking)
      if (!conversa_id && conv.origem && conv.origem !== "Não Rastreada") {
        resultados.push({ id: conv.id, nome: conv.contato_nome, status: "ja_rastreado" });
        continue;
      }

      // Buscar primeira mensagem do lead (não fromMe)
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

      // Tentar match por conteúdo da mensagem com os links
      let melhorMatch: typeof links[0] | null = null;

      for (const msg of msgs) {
        const msgNorm = normalizar(msg.conteudo);
        if (!msgNorm || msgNorm.length < 5) continue;

        for (const link of links) {
          const linkMsgNorm = normalizar(link.wa_mensagem);
          if (!linkMsgNorm) continue;

          // Match exato ou contém
          if (msgNorm === linkMsgNorm || msgNorm.includes(linkMsgNorm) || linkMsgNorm.includes(msgNorm)) {
            melhorMatch = link;
            break;
          }

          // Match parcial (>70% das palavras coincidem)
          const palavrasMsg = msgNorm.split(" ").filter(w => w.length > 2);
          const palavrasLink = linkMsgNorm.split(" ").filter(w => w.length > 2);
          if (palavrasLink.length > 0) {
            const coincidentes = palavrasMsg.filter(p => palavrasLink.includes(p));
            const similaridade = coincidentes.length / Math.max(palavrasLink.length, 1);
            if (similaridade >= 0.7) {
              melhorMatch = link;
              break;
            }
          }
        }
        if (melhorMatch) break;
      }

      // Se não achou por mensagem e só tem 1 link ativo, assumir que é esse
      if (!melhorMatch && links.length === 1) {
        melhorMatch = links[0];
      }

      if (melhorMatch) {
        // Extrair UTMs do link_gerado
        let utm_source = "facebook", utm_medium = "cpc", utm_content = "", utm_term = "";
        try {
          const url = new URL(melhorMatch.link_gerado);
          utm_source = url.searchParams.get("utm_source") || "facebook";
          utm_medium = url.searchParams.get("utm_medium") || "cpc";
          utm_content = url.searchParams.get("utm_content") || "";
          utm_term = url.searchParams.get("utm_term") || "";
        } catch {}

        await supabase.from("conversas").update({
          origem: "Meta Ads",
          utm_source,
          utm_medium,
          utm_campaign: melhorMatch.utm_campaign || melhorMatch.nome.toLowerCase().replace(/\s+/g, "-"),
          utm_content: utm_content || null,
          utm_term: utm_term || null,
          link_id: melhorMatch.id,
          link_nome: melhorMatch.nome,
        }).eq("id", conv.id);

        resultados.push({
          id: conv.id,
          nome: conv.contato_nome,
          status: "rastreado",
          link_nome: melhorMatch.nome,
          campanha: melhorMatch.utm_campaign,
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
