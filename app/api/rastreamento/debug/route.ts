import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const agencia_id = searchParams.get("agencia_id");
  const conversa_id = searchParams.get("conversa_id");

  if (!agencia_id) return NextResponse.json({ erro: "agencia_id obrigatório" }, { status: 400 });

  const resultado: Record<string, any> = {};

  // 1. Buscar agência e verificar herança de tokens
  const { data: agencia } = await supabase.from("agencias")
    .select("id, nome, parent_id, meta_token, meta_business_token, evolution_url, evolution_key, whatsapp_instancia, meta_ad_account_id")
    .eq("id", agencia_id).single();

  resultado.agencia = {
    id: agencia?.id,
    nome: agencia?.nome,
    parent_id: agencia?.parent_id,
    tem_meta_token: !!agencia?.meta_token,
    tem_meta_business_token: !!agencia?.meta_business_token,
    tem_evolution_url: !!agencia?.evolution_url,
    tem_evolution_key: !!agencia?.evolution_key,
    whatsapp_instancia: agencia?.whatsapp_instancia,
    meta_ad_account_id: agencia?.meta_ad_account_id,
  };

  // 2. Buscar e herdar do master se filha
  let adsToken: string | null = agencia?.meta_token || agencia?.meta_business_token || null;
  let evoUrl: string | null = agencia?.evolution_url || null;
  let evoKey: string | null = agencia?.evolution_key || null;
  let instancia: string | null = agencia?.whatsapp_instancia || null;

  if (agencia?.parent_id) {
    const { data: parent } = await supabase.from("agencias")
      .select("id, nome, meta_token, meta_business_token, evolution_url, evolution_key, whatsapp_instancia")
      .eq("id", agencia.parent_id).single();

    resultado.master = {
      id: parent?.id,
      nome: parent?.nome,
      tem_meta_token: !!parent?.meta_token,
      tem_meta_business_token: !!parent?.meta_business_token,
      tem_evolution_url: !!parent?.evolution_url,
      whatsapp_instancia: parent?.whatsapp_instancia,
    };

    adsToken = adsToken || parent?.meta_token || parent?.meta_business_token || null;
    evoUrl = evoUrl || parent?.evolution_url || null;
    evoKey = evoKey || parent?.evolution_key || null;
    instancia = instancia || parent?.whatsapp_instancia || null;
  }

  resultado.tokens_resolvidos = {
    tem_ads_token: !!adsToken,
    ads_token_primeiros_chars: adsToken ? adsToken.substring(0, 12) + "..." : null,
    tem_evo_url: !!evoUrl,
    evo_url: evoUrl,
    instancia,
  };

  // 3. Testar Meta API com o token
  if (adsToken) {
    try {
      const meRes = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${adsToken}`);
      const meData = await meRes.json();
      resultado.meta_api_me = meData.error ? { erro: meData.error } : { id: meData.id, name: meData.name };

      // Tentar buscar contas de anúncios
      const acRes = await fetch(`https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name&access_token=${adsToken}&limit=5`);
      const acData = await acRes.json();
      resultado.meta_api_adaccounts = acData.error ? { erro: acData.error } : (acData.data || []).map((a: any) => ({ id: a.id, name: a.name }));
    } catch (e: any) {
      resultado.meta_api_me = { erro: e.message };
    }
  } else {
    resultado.meta_api_me = "SEM TOKEN";
  }

  // 4. Testar Evolution API
  if (evoUrl && evoKey && instancia) {
    try {
      const evoRes = await fetch(`${evoUrl}/instance/fetchInstances`, {
        headers: { apikey: evoKey },
      });
      const evoData = await evoRes.json();
      const instancias = Array.isArray(evoData) ? evoData : (evoData.data || []);
      const minha = instancias.find((i: any) => i.instance?.instanceName === instancia || i.instanceName === instancia);
      resultado.evolution_api = {
        ok: evoRes.ok,
        instancia_encontrada: !!minha,
        estado: minha?.instance?.connectionStatus || minha?.connectionStatus || "desconhecido",
        total_instancias: instancias.length,
      };
    } catch (e: any) {
      resultado.evolution_api = { erro: e.message };
    }
  } else {
    resultado.evolution_api = { erro: "Sem URL/Key/Instância configurada", evoUrl, temKey: !!evoKey, instancia };
  }

  // 5. Contagens de conversas por estado de rastreio
  const { data: stats } = await supabase.from("conversas")
    .select("origem, utm_campaign, utm_content, contato_jid")
    .eq("agencia_id", agencia_id);

  if (stats) {
    const total = stats.length;
    const metaAds = stats.filter(c => c.origem === "Meta Ads");
    const semCampanha = metaAds.filter(c => !c.utm_campaign);
    const comSourceIdNumerico = metaAds.filter(c => c.utm_content && /^\d{8,}$/.test(c.utm_content));
    const semContentETbSemCamp = metaAds.filter(c => !c.utm_campaign && (!c.utm_content || c.utm_content === ""));
    resultado.contagens = {
      total_conversas: total,
      meta_ads_total: metaAds.length,
      meta_ads_sem_campanha: semCampanha.length,
      meta_ads_com_sourceid_numerico: comSourceIdNumerico.length,
      meta_ads_sem_campanha_e_sem_content: semContentETbSemCamp.length,
    };
  }

  // 6. Se conversa_id fornecido, debugar essa conversa específica
  if (conversa_id) {
    const { data: conv } = await supabase.from("conversas")
      .select("id, contato_nome, contato_numero, contato_jid, instancia, origem, utm_campaign, utm_content, utm_source, utm_medium, fbclid, nome_anuncio")
      .eq("id", conversa_id).single();

    if (conv) {
      resultado.conversa = {
        id: conv.id,
        nome: conv.contato_nome,
        jid: conv.contato_jid,
        instancia: conv.instancia,
        origem: conv.origem,
        utm_source: conv.utm_source,
        utm_medium: conv.utm_medium,
        utm_campaign: conv.utm_campaign,
        utm_content: conv.utm_content,
        fbclid: conv.fbclid ? conv.fbclid.substring(0, 20) + "..." : null,
        nome_anuncio: conv.nome_anuncio,
        utm_content_eh_sourceid: conv.utm_content ? /^\d{8,}$/.test(conv.utm_content) : false,
      };

      // Testar Evolution para essa conversa
      if (evoUrl && evoKey && conv.contato_jid) {
        const instanciaConv = conv.instancia || instancia || "";
        const numero = (conv.contato_numero || "").replace(/\D/g, "");
        const jids = [...new Set([conv.contato_jid, numero ? `${numero}@lid` : null, numero ? `${numero}@s.whatsapp.net` : null].filter(Boolean))];

        resultado.evolution_busca = {};
        for (const jid of jids) {
          try {
            const r = await fetch(`${evoUrl}/chat/findMessages/${instanciaConv}`, {
              method: "POST",
              headers: { apikey: evoKey, "Content-Type": "application/json" },
              body: JSON.stringify({ where: { key: { remoteJid: jid, fromMe: false } }, limit: 5 }),
            });
            const d = await r.json();
            const records = d?.messages?.records || d?.records || [];
            const sourceIds = records.flatMap((msg: any) => {
              const ctx = msg.message?.extendedTextMessage?.contextInfo
                || msg.message?.imageMessage?.contextInfo
                || msg.message?.videoMessage?.contextInfo
                || msg.contextInfo;
              return ctx?.externalAdReply?.sourceId ? [ctx.externalAdReply.sourceId] : [];
            });
            resultado.evolution_busca[jid as string] = {
              status: r.status,
              total_msgs: records.length,
              source_ids_encontrados: sourceIds,
            };
          } catch (e: any) {
            resultado.evolution_busca[jid as string] = { erro: e.message };
          }
        }
      }

      // Testar Meta API com utm_content se for sourceId
      if (conv.utm_content && /^\d{8,}$/.test(conv.utm_content) && adsToken) {
        try {
          const adRes = await fetch(`https://graph.facebook.com/v21.0/${conv.utm_content}?fields=name,adset_id,campaign_id&access_token=${adsToken}`);
          const adData = await adRes.json();
          resultado.meta_api_sourceid = adData.error ? { erro: adData.error } : {
            ad_id: conv.utm_content,
            ad_name: adData.name,
            adset_id: adData.adset_id,
            campaign_id: adData.campaign_id,
          };
          if (adData.campaign_id && !adData.error) {
            const [campRes, conjRes] = await Promise.all([
              fetch(`https://graph.facebook.com/v21.0/${adData.campaign_id}?fields=name&access_token=${adsToken}`),
              fetch(`https://graph.facebook.com/v21.0/${adData.adset_id}?fields=name&access_token=${adsToken}`),
            ]);
            resultado.meta_api_sourceid.campaign_name = (await campRes.json())?.name;
            resultado.meta_api_sourceid.adset_name = (await conjRes.json())?.name;
          }
        } catch (e: any) {
          resultado.meta_api_sourceid = { erro: e.message };
        }
      }
    } else {
      resultado.conversa = { erro: "Conversa não encontrada" };
    }
  }

  // 7. Pegar 3 exemplos de conversas sem rastreio para análise
  const { data: exemplos } = await supabase.from("conversas")
    .select("id, contato_nome, contato_jid, instancia, origem, utm_campaign, utm_content, utm_source, utm_medium")
    .eq("agencia_id", agencia_id)
    .eq("origem", "Meta Ads")
    .or("utm_campaign.is.null,utm_campaign.eq.")
    .limit(3);

  resultado.exemplos_sem_rastreio = (exemplos || []).map(c => ({
    id: c.id,
    nome: c.contato_nome,
    jid: c.contato_jid,
    instancia: c.instancia,
    utm_source: c.utm_source,
    utm_medium: c.utm_medium,
    utm_campaign: c.utm_campaign,
    utm_content: c.utm_content,
    utm_content_eh_sourceid: c.utm_content ? /^\d{8,}$/.test(c.utm_content) : false,
  }));

  return NextResponse.json(resultado, { status: 200 });
}
