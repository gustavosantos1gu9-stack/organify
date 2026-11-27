import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getMetaToken, resolverAnuncioMeta, AD_ID_REGEX, isTextoPadraoCTWA, getTokenMetaDaAgencia } from "@/lib/meta-tracking";
import { podeAplicarRastreio, extrairWaDestino, destinoBateNumero } from "@/lib/rastreio";

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


export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { agencia_id, conversa_id, offset: batchOffset = 0 } = await req.json();
    if (!agencia_id) {
      return NextResponse.json({ error: "agencia_id obrigatório" }, { status: 400 });
    }

    // Buscar token, Evolution e links da agência — herdando do master se for filha
    let { data: agencia } = await supabase.from("agencias")
      .select("meta_business_token, meta_token, evolution_url, evolution_key, whatsapp_instancia, whatsapp_numero, parent_id")
      .eq("id", agencia_id).single();

    let parentMetaData: { meta_business_token?: string | null; meta_token?: string | null } | null = null;

    if (agencia?.parent_id) {
      const { data: parent } = await supabase.from("agencias")
        .select("evolution_url, evolution_key, whatsapp_instancia, meta_business_token, meta_token")
        .eq("id", agencia.parent_id).single();
      if (parent) {
        parentMetaData = parent;
        agencia = {
          ...agencia,
          evolution_url: agencia.evolution_url || parent.evolution_url,
          evolution_key: agencia.evolution_key || parent.evolution_key,
          whatsapp_instancia: agencia.whatsapp_instancia || parent.whatsapp_instancia,
        };
      }
    }

    const isFilha = !!agencia?.parent_id;
    // Filha usa getTokenMetaDaAgencia (token próprio → Lavínia); master usa getMetaToken
    const adsToken = isFilha
      ? await getTokenMetaDaAgencia(agencia || {}, supabase)
      : getMetaToken(agencia || {}, parentMetaData);
    const evoUrl = agencia?.evolution_url || null;
    const evoKey = agencia?.evolution_key || null;

    const { data: links } = await supabase
      .from("links_campanha")
      .select("id, nome, wa_mensagem, utm_campaign, link_gerado")
      .eq("agencia_id", agencia_id)
      .order("created_at", { ascending: false });

    const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    let conversas: any[] = [];

    if (conversa_id) {
      const { data } = await supabase.from("conversas")
        .select("id, contato_numero, contato_nome, contato_jid, instancia, origem, utm_campaign, utm_content, fbclid")
        .eq("agencia_id", agencia_id).eq("id", conversa_id);
      conversas = data || [];
    } else {
      const selectBase = "id, contato_numero, contato_nome, contato_jid, instancia, origem, utm_campaign, utm_content, fbclid";
      const selectFilha = selectBase + ", meta_ad_id, rastreio_status";
      const sel = isFilha ? selectFilha : selectBase;

      // 1. @lid sem campanha — sem limite de data (lote pequeno para não timeout)
      const { data: lidSemCamp } = await supabase.from("conversas")
        .select(sel)
        .eq("agencia_id", agencia_id)
        .like("contato_jid", "%@lid")
        .or("utm_campaign.is.null,utm_campaign.eq.")
        .order("created_at", { ascending: false })
        .range(batchOffset, batchOffset + 9);

      // 1b. "pendente_nomes" — FILHA APENAS: leads CTWA com meta_ad_id mas sem nomes
      const pendenteNomes = isFilha ? (await supabase.from("conversas")
        .select(sel)
        .eq("agencia_id", agencia_id)
        .eq("rastreio_status", "pendente_nomes")
        .gte("created_at", trintaDiasAtras)
        .order("created_at", { ascending: false })
        .limit(20)).data : null;

      // 2. Meta Ads SEM campanha E com sourceId numérico em utm_content
      //    (só processa quando utm_campaign está vazio — nunca sobrescreve)
      const { data: metaComContent } = await supabase.from("conversas")
        .select(sel)
        .eq("agencia_id", agencia_id)
        .eq("origem", "Meta Ads")
        .or("utm_campaign.is.null,utm_campaign.eq.")
        .not("utm_content", "is", null)
        .not("contato_jid", "like", "%@lid")
        .order("created_at", { ascending: false })
        .range(batchOffset, batchOffset + 49);

      // 2b. Meta Ads com utm_campaign que parece corpo do anúncio (>80 chars)
      //     E utm_content numérico → re-resolver para corrigir campanha errada
      const { data: campanhaNome } = await supabase.from("conversas")
        .select(sel)
        .eq("agencia_id", agencia_id)
        .eq("origem", "Meta Ads")
        .not("utm_content", "is", null)
        .not("utm_campaign", "is", null)
        .order("created_at", { ascending: false })
        .range(batchOffset, batchOffset + 29);

      // 3. Meta Ads sem campanha E sem utm_content (precisa de Evolution para achar sourceId)
      const { data: metaSemSourceId } = await supabase.from("conversas")
        .select(sel)
        .eq("agencia_id", agencia_id)
        .eq("origem", "Meta Ads")
        .or("utm_campaign.is.null,utm_campaign.eq.")
        .or("utm_content.is.null,utm_content.eq.")
        .not("contato_jid", "like", "%@lid")
        .gte("created_at", trintaDiasAtras)
        .limit(5);

      // 4. Não rastreadas dos últimos 30 dias
      const { data: naoRastreadas } = await supabase.from("conversas")
        .select(sel)
        .eq("agencia_id", agencia_id)
        .or("origem.is.null,origem.eq.Não Rastreada")
        .gte("created_at", trintaDiasAtras)
        .limit(20);

      // Filtrar 2: apenas os que têm sourceId numérico em utm_content (ou meta_ad_id para filha)
      const comSourceId = ((metaComContent || []) as any[]).filter(c =>
        AD_ID_REGEX.test(c.utm_content || "") || (isFilha && AD_ID_REGEX.test(c.meta_ad_id || ""))
      );

      // Filtrar 2b: tem sourceId numérico em utm_content E utm_campaign preenchido (provável campanha errada)
      const campanhaNomeErrado = ((campanhaNome || []) as any[]).filter(c =>
        AD_ID_REGEX.test(c.utm_content || "") || (isFilha && AD_ID_REGEX.test(c.meta_ad_id || ""))
      );

      // Deduplicar todos
      const idsIncluidos = new Set((lidSemCamp || []).map((c: any) => c.id));
      const pendenteNomesDedup = isFilha ? (pendenteNomes || []).filter((c: any) => !idsIncluidos.has(c.id)) : [];
      pendenteNomesDedup.forEach((c: any) => idsIncluidos.add(c.id));
      const comSourceIdDedup = comSourceId.filter((c: any) => !idsIncluidos.has(c.id));
      comSourceIdDedup.forEach((c: any) => idsIncluidos.add(c.id));
      const campanhaNomeErradoDedup = campanhaNomeErrado.filter((c: any) => !idsIncluidos.has(c.id));
      campanhaNomeErradoDedup.forEach((c: any) => idsIncluidos.add(c.id));
      const metaSemSourceIdDedup = (metaSemSourceId || []).filter((c: any) => !idsIncluidos.has(c.id));
      metaSemSourceIdDedup.forEach((c: any) => idsIncluidos.add(c.id));
      const naoRastreadasDedup = (naoRastreadas || []).filter((c: any) => !idsIncluidos.has(c.id));

      conversas = [...(lidSemCamp || []), ...pendenteNomesDedup, ...comSourceIdDedup, ...campanhaNomeErradoDedup, ...metaSemSourceIdDedup, ...naoRastreadasDedup];
    }

    if (!conversas?.length) {
      return NextResponse.json({ ok: true, msg: "Nenhuma conversa para rastrear", resultados: [], tem_mais: false });
    }

    const resultados: { id: string; nome: string; status: string; link_nome?: string; campanha?: string; utms?: Record<string, string> }[] = [];

    for (const conv of conversas) {
      const temSourceIdNumerico = AD_ID_REGEX.test(conv.utm_content || "");
      // Para filha: meta_ad_id é fonte direta do sourceId (salvo desde a primeira msg, independe de token)
      const sourceIdDisponivel = temSourceIdNumerico
        ? conv.utm_content
        : (isFilha && AD_ID_REGEX.test(conv.meta_ad_id || "") ? conv.meta_ad_id : null);

      // ── Meta Ads com sourceId disponível → resolver via Meta API ──
      if (conv.origem === "Meta Ads" && sourceIdDisponivel && adsToken) {
        try {
          const resultado = await resolverAnuncioMeta(sourceIdDisponivel, adsToken);
          if (resultado.campanha) {
            const { campanha, conjunto, criativo } = resultado;
            await supabase.from("conversas").update({
              utm_campaign: campanha,
              utm_content: conjunto ? `${conjunto}_${criativo}` : criativo || conv.utm_content,
              nome_anuncio: criativo,
              ...(resultado.conjunto_id ? { meta_adset_id: resultado.conjunto_id } : {}),
              ...(resultado.campanha_id ? { meta_campaign_id: resultado.campanha_id } : {}),
              ...(resultado.anuncio_id ? { meta_ad_id: resultado.anuncio_id } : {}),
              utm_source: "facebook",
              utm_medium: "cpc",
              rastreio_status: "resolvido",
              ...(isFilha ? { rastreio_erro: null } : {}),
            }).eq("id", conv.id);
            resultados.push({
              id: conv.id, nome: conv.contato_nome, status: "rastreado",
              campanha, utms: { utm_source: "facebook", utm_medium: "cpc", utm_campaign: campanha },
            });
          } else {
            resultados.push({ id: conv.id, nome: conv.contato_nome, status: "sem_match" });
          }
        } catch (e: any) {
          await supabase.from("conversas").update({
            rastreio_status: isFilha ? "pendente_nomes" : "erro_graph",
            rastreio_erro: `${isFilha ? "auto-detect:" : ""}${e.code ?? "??"}: ${e.message}`,
          }).eq("id", conv.id);
          console.error("[auto-detect] Meta API erro", { agencia_id, sourceId: conv.utm_content, code: e.code });
          resultados.push({ id: conv.id, nome: conv.contato_nome, status: "sem_match" });
        }
        continue;
      }

      // ── Meta Ads sem campanha (sem sourceId disponível) ──
      if (conv.origem === "Meta Ads" && !conv.utm_campaign) {
        // Tentar buscar sourceId via Evolution API — busca pelo JID e também por número
        let sourceId: string | null = null;
        if (evoUrl && evoKey) {
          const instancia = conv.instancia || agencia?.whatsapp_instancia || "";
          // JIDs a tentar: o armazenado + variante @lid + variante @s.whatsapp.net
          const numero = (conv.contato_numero || "").replace(/\D/g, "");
          const jids = [...new Set([
            conv.contato_jid,
            numero ? `${numero}@lid` : null,
            numero ? `${numero}@s.whatsapp.net` : null,
            numero?.length === 13 ? `${numero.slice(2)}@lid` : null, // sem código de país 55
          ].filter(Boolean))];

          for (const jid of jids) {
            if (sourceId) break;
            try {
              const ctrl = new AbortController();
              const t = setTimeout(() => ctrl.abort(), 5000);
              const res = await fetch(`${evoUrl}/chat/findMessages/${instancia}`, {
                method: "POST",
                headers: { "apikey": evoKey, "Content-Type": "application/json" },
                body: JSON.stringify({ where: { key: { remoteJid: jid, fromMe: false } }, limit: 10 }),
                signal: ctrl.signal,
              });
              clearTimeout(t);
              const data = await res.json();
              const records = data?.messages?.records || data?.records || [];
              for (const msg of records) {
                const ctx = msg.message?.extendedTextMessage?.contextInfo
                  || msg.message?.imageMessage?.contextInfo
                  || msg.message?.videoMessage?.contextInfo
                  || msg.contextInfo;
                if (ctx?.externalAdReply?.sourceId) { sourceId = ctx.externalAdReply.sourceId; break; }
              }
            } catch {}
          }
        }

        if (sourceId && adsToken) {
          try {
            const resultado = await resolverAnuncioMeta(sourceId, adsToken);
            if (resultado.campanha) {
              const { campanha, conjunto, criativo } = resultado;
              await supabase.from("conversas").update({
                utm_campaign: campanha,
                utm_content: conjunto ? `${conjunto}_${criativo}` : criativo || sourceId,
                nome_anuncio: criativo,
                ...(resultado.conjunto_id ? { meta_adset_id: resultado.conjunto_id } : {}),
                ...(resultado.campanha_id ? { meta_campaign_id: resultado.campanha_id } : {}),
                ...(resultado.anuncio_id ? { meta_ad_id: resultado.anuncio_id } : {}),
                utm_source: "facebook",
                utm_medium: "cpc",
                rastreio_status: "resolvido",
              }).eq("id", conv.id);
              resultados.push({
                id: conv.id, nome: conv.contato_nome, status: "rastreado",
                campanha, utms: { utm_source: "facebook", utm_medium: "cpc", utm_campaign: campanha },
              });
              continue;
            }
          } catch (e: any) {
            await supabase.from("conversas").update({
              rastreio_status: "erro_graph",
              rastreio_erro: `${e.code ?? "??"}: ${e.message}`,
            }).eq("id", conv.id);
            console.error("[auto-detect] Meta API erro sem-sourceId", { agencia_id, sourceId, code: e.code });
          }
        }

        resultados.push({ id: conv.id, nome: conv.contato_nome, status: "sem_match" });
        continue;
      }

      // ── @lid sem campanha → tentar Evolution + Meta API ──
      if (conv.contato_jid?.includes("@lid") && (!conv.utm_campaign || conv.utm_campaign === "")) {
        let campanha = "";
        let conjunto = "";
        let criativo = "";
        let idsMeta: Record<string, string | null> = {};
        let sourceId: string | null = null;

        if (evoUrl && evoKey) {
          const instancia = conv.instancia || agencia?.whatsapp_instancia || "";
          try {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 5000);
            const res = await fetch(`${evoUrl}/chat/findMessages/${instancia}`, {
              method: "POST",
              headers: { "apikey": evoKey, "Content-Type": "application/json" },
              body: JSON.stringify({ where: { key: { remoteJid: conv.contato_jid, fromMe: false } }, limit: 5 }),
              signal: ctrl.signal,
            });
            clearTimeout(t);
            const data = await res.json();
            const records = data?.messages?.records || data?.records || [];
            for (const msg of records) {
              const ctx = msg.message?.extendedTextMessage?.contextInfo
                || msg.message?.imageMessage?.contextInfo
                || msg.message?.videoMessage?.contextInfo
                || msg.contextInfo;
              if (ctx?.externalAdReply?.sourceId) { sourceId = ctx.externalAdReply.sourceId; break; }
            }
          } catch {}
        }

        if (sourceId && adsToken) {
          try {
            const resultado = await resolverAnuncioMeta(sourceId, adsToken);
            campanha = resultado.campanha;
            conjunto = resultado.conjunto;
            criativo = resultado.criativo;
            idsMeta = { meta_adset_id: resultado.conjunto_id, meta_campaign_id: resultado.campanha_id, meta_ad_id: resultado.anuncio_id };
          } catch (e: any) {
            console.error("[auto-detect] Meta API erro @lid", { agencia_id, sourceId, code: e.code });
          }
        }

        // Se não achou sourceId via Evolution, cair no text-match abaixo
        // (@lid sem sourceId ainda pode ter chegado pelo link rastreável com mensagem configurada)
        if (sourceId) {
          const updateData: Record<string, any> = { origem: "Meta Ads", utm_source: "meta", utm_medium: "ctwa" };
          if (campanha) { updateData.utm_campaign = campanha; updateData.rastreio_status = "resolvido"; }
          if (conjunto || criativo) updateData.utm_content = conjunto ? `${conjunto}_${criativo}` : criativo;
          if (criativo) updateData.nome_anuncio = criativo;
          for (const [k, v] of Object.entries(idsMeta)) if (v) updateData[k] = v;
          if (!campanha) { updateData.utm_content = sourceId; }

          await supabase.from("conversas").update(updateData).eq("id", conv.id);
          resultados.push({ id: conv.id, nome: conv.contato_nome, status: "rastreado", campanha: campanha || sourceId });
          continue;
        }
        // sourceId não encontrado: cai no text-match abaixo
      }

      // ── Já rastreado com dados reais → não sobrescrever (respeitar hierarquia) ──
      if (!conversa_id && conv.origem && conv.origem !== "Não Rastreada" && !podeAplicarRastreio(conv, "atribuido_por_texto_link")) {
        resultados.push({ id: conv.id, nome: conv.contato_nome, status: "ja_rastreado" });
        continue;
      }
      if (conv.fbclid) {
        resultados.push({ id: conv.id, nome: conv.contato_nome, status: "ja_rastreado" });
        continue;
      }

      // ── Não rastreada: tentar match por mensagem com links ──
      if (!links?.length) {
        const { data: primMsg } = await supabase
          .from("mensagens").select("conteudo")
          .eq("conversa_id", conv.id).eq("de_mim", false)
          .order("created_at", { ascending: true }).limit(1).single();
        if (primMsg && isTextoPadraoCTWA(primMsg.conteudo)) {
          await supabase.from("conversas").update({
            origem: "Meta Ads", utm_source: "meta", utm_medium: "ctwa",
            rastreio_status: "sem_dados_anuncio",
          }).eq("id", conv.id);
          resultados.push({ id: conv.id, nome: conv.contato_nome, status: "rastreado_texto_padrao" });
          continue;
        }
        resultados.push({ id: conv.id, nome: conv.contato_nome, status: "sem_match" });
        continue;
      }

      // Buscar mensagens dos últimos 30 dias (não só a primeira — lead pode voltar pelo link depois)
      const trintaDiasAtrasMsg = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: msgs } = await supabase
        .from("mensagens")
        .select("conteudo")
        .eq("conversa_id", conv.id)
        .eq("de_mim", false)
        .gte("created_at", trintaDiasAtrasMsg)
        .order("created_at", { ascending: true })
        .limit(10);

      if (!msgs?.length) {
        resultados.push({ id: conv.id, nome: conv.contato_nome, status: "sem_mensagens" });
        continue;
      }

      // Filtrar links pelo destino da instância: só atribuir ao link cujo wa= bate com whatsapp_numero
      // Isso evita ambiguidade quando vários links têm a mesma mensagem mas destinos diferentes
      const whatsappNumero = agencia?.whatsapp_numero || "";
      const linksParaInstancia = (links || []).filter(link => {
        const dest = extrairWaDestino(link.link_gerado || "");
        return !dest || !whatsappNumero || destinoBateNumero(dest, whatsappNumero);
      });

      // Mapear normalizado de mensagem → lista de links com destino correto
      const mensagemParaLinks: Map<string, typeof links> = new Map();
      for (const link of linksParaInstancia) {
        const lmsgNorm = normalizar(link.wa_mensagem);
        if (!lmsgNorm) continue;
        if (!mensagemParaLinks.has(lmsgNorm)) mensagemParaLinks.set(lmsgNorm, []);
        mensagemParaLinks.get(lmsgNorm)!.push(link);
      }

      let melhorMatch: typeof links[0] | null = null;
      let ambiguo = false;

      for (const msg of msgs) {
        const msgNorm = normalizar(msg.conteudo);
        if (!msgNorm || msgNorm.length < 5) continue;

        for (const [linkMsgNorm, linksComTexto] of mensagemParaLinks) {
          // Só match exato ou "contém" — sem heurística de porcentagem de palavras
          const bate = msgNorm === linkMsgNorm || msgNorm.includes(linkMsgNorm);
          if (bate) {
            if (linksComTexto.length > 1) {
              // Mais de um link com esse texto para a mesma instância → ambíguo
              ambiguo = true;
            } else {
              melhorMatch = linksComTexto[0];
            }
            break;
          }
        }
        if (melhorMatch || ambiguo) break;
      }

      if (ambiguo) {
        await supabase.from("conversas").update({ rastreio_status: "ambiguo" }).eq("id", conv.id);
        resultados.push({ id: conv.id, nome: conv.contato_nome, status: "ambiguo" });
        continue;
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
          rastreio_status: "atribuido_por_texto_link",
        };

        const { error } = await supabase.from("conversas").update(updateData).eq("id", conv.id);

        resultados.push({
          id: conv.id, nome: conv.contato_nome,
          status: error ? "erro" : "rastreado",
          link_nome: melhorMatch.nome, campanha: updateData.utm_campaign,
          utms: { utm_source: updateData.utm_source, utm_medium: updateData.utm_medium, utm_campaign: updateData.utm_campaign },
        });
      } else {
        // Fallback: texto padrão CTWA — reutiliza msgs[0] já buscado acima (de_mim=false, ASC)
        if (msgs?.length && isTextoPadraoCTWA(msgs[0].conteudo)) {
          await supabase.from("conversas").update({
            origem: "Meta Ads", utm_source: "meta", utm_medium: "ctwa",
            rastreio_status: "sem_dados_anuncio",
          }).eq("id", conv.id);
          resultados.push({ id: conv.id, nome: conv.contato_nome, status: "rastreado_texto_padrao" });
        } else {
          resultados.push({ id: conv.id, nome: conv.contato_nome, status: "sem_match" });
        }
      }
    }

    const rastreados = resultados.filter(r => r.status === "rastreado" || r.status === "rastreado_texto_padrao").length;
    const tem_mais = !conversa_id && conversas.filter(c => c.contato_jid?.includes("@lid") || AD_ID_REGEX.test(c.utm_content || "")).length >= 30;

    return NextResponse.json({
      ok: true,
      total: conversas.length,
      rastreados,
      tem_mais,
      proximo_offset: batchOffset + 30,
      resultados,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
