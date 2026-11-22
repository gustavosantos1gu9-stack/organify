/**
 * Funções compartilhadas de rastreamento Meta Ads.
 * Usadas no webhook, auto-detect, retentar-rastreamento e reprocessamento.
 */

/** Regex para IDs de anúncio do Meta (sourceId numérico ≥ 8 dígitos) */
export const AD_ID_REGEX = /^\d{8,}$/;

/**
 * Textos enviados automaticamente pelo app da Meta em anúncios Click-to-WhatsApp.
 * Normalizado (sem acento, sem pontuação) para comparação com isTextoPadraoCTWA.
 * Adicione novas frases aqui conforme identificadas.
 */
export const TEXTOS_PADRAO_CTWA = [
  "tenho interesse e queria mais informacoes",
];

/** Normaliza texto e verifica se bate com alguma frase padrão de anúncio CTWA. */
export function isTextoPadraoCTWA(texto: string): boolean {
  if (!texto) return false;
  const n = texto
    .toLowerCase()
    .trim()
    .replace(/[àáâãä]/g, "a")
    .replace(/[èéêë]/g, "e")
    .replace(/[ìíîï]/g, "i")
    .replace(/[òóôõö]/g, "o")
    .replace(/[ùúûü]/g, "u")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9 ]/g, "");
  return TEXTOS_PADRAO_CTWA.some(t => n.includes(t));
}

/**
 * Retorna o token Meta a usar para chamadas da Graph API.
 * Filha: usa token próprio (business_token → token). Só herda do pai se não tiver NENHUM token.
 * Master: usa o próprio token.
 */
export function getMetaToken(
  agencia: { meta_business_token?: string | null; meta_token?: string | null },
  parent?: { meta_business_token?: string | null; meta_token?: string | null } | null
): string | null {
  const ownToken = agencia.meta_business_token || agencia.meta_token || null;
  if (ownToken) return ownToken;
  if (parent) return parent.meta_business_token || parent.meta_token || null;
  return null;
}

/**
 * Resolve nome do anúncio, conjunto e campanha via Graph API em uma única chamada.
 * Lança exceção com .code em caso de erro da Meta API (para uso em rastreio_erro).
 */
export async function resolverAnuncioMeta(
  sourceId: string,
  token: string
): Promise<{ campanha: string; conjunto: string; criativo: string }> {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${sourceId}?fields=name,adset{name},campaign{name}&access_token=${token}`
  );
  const json = await res.json();
  if (json.error) {
    const err = new Error(json.error.message || "Meta API error") as any;
    err.code = json.error.code ?? json.error.type ?? "unknown";
    throw err;
  }
  return {
    campanha: json.campaign?.name || "",
    conjunto: json.adset?.name || "",
    criativo: json.name || "",
  };
}

/** Regex para IDs numéricos Meta de 10-20 dígitos (campaign / adset / ad IDs) */
export const NUMERIC_ID_REGEX = /^\d{10,20}$/;

/** Retorna true se o valor contém macro não resolvida do Meta Ads (ex: {{campaign.name}}) */
export function temMacroInvalida(v: string | null | undefined): boolean {
  return !!(v && v.includes("{{"));
}

/**
 * Resolve utm_campaign / utm_content / utm_term / nome_anuncio:
 *  - Se numérico (10–20 dígitos): usa o endpoint batch GET /v21.0/?ids=...&fields=name
 *    (funciona para campanha, conjunto ou anúncio sem precisar saber o tipo)
 *  - Se contém "{{": zera o campo e registra rastreio_erro
 *  - Preserva IDs originais em meta_campaign_id / meta_adset_id / meta_ad_id
 * Cache de nomes por ID dentro da mesma execução.
 */
export async function resolverIdsMeta(
  campos: {
    utm_campaign?: string | null;
    utm_content?: string | null;
    utm_term?: string | null;
    nome_anuncio?: string | null;
  },
  token: string | null
): Promise<{
  utm_campaign:     string | null;
  utm_content:      string | null;
  utm_term:         string | null;
  nome_anuncio:     string | null;
  meta_campaign_id: string | null;
  meta_adset_id:    string | null;
  meta_ad_id:       string | null;
  rastreio_erro:    string | null;
}> {
  const out = {
    utm_campaign:     campos.utm_campaign     ?? null,
    utm_content:      campos.utm_content      ?? null,
    utm_term:         campos.utm_term         ?? null,
    nome_anuncio:     campos.nome_anuncio     ?? null,
    meta_campaign_id: null as string | null,
    meta_adset_id:    null as string | null,
    meta_ad_id:       null as string | null,
    rastreio_erro:    null as string | null,
  };

  // 1. Limpar macros inválidas
  const invalidos: string[] = [];
  for (const k of ["utm_campaign", "utm_content", "utm_term", "nome_anuncio"] as const) {
    if (temMacroInvalida(out[k])) {
      invalidos.push(`${k}: ${out[k]}`);
      out[k] = null;
    }
  }
  if (invalidos.length) out.rastreio_erro = `parametro_url_invalido: ${invalidos.join("; ")}`;

  if (!token) return out;

  // 2. Coletar IDs únicos a resolver (sem duplicatas)
  const idsParaResolver = new Map<string, string[]>(); // id → campos que o usam
  function registrar(campo: "utm_campaign" | "utm_content" | "utm_term" | "nome_anuncio") {
    const v = out[campo];
    if (v && NUMERIC_ID_REGEX.test(v)) {
      const list = idsParaResolver.get(v) || [];
      list.push(campo);
      idsParaResolver.set(v, list);
    }
  }
  registrar("utm_campaign");
  registrar("utm_content");
  registrar("utm_term");
  registrar("nome_anuncio");

  if (idsParaResolver.size === 0) return out;

  // 3. Batch request — funciona para campaign/adset/ad com apenas fields=name
  const idList = Array.from(idsParaResolver.keys()).join(",");
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/?ids=${idList}&fields=name&access_token=${token}`
    );
    const json = await res.json();
    if (json.error) {
      out.rastreio_erro = (out.rastreio_erro ? out.rastreio_erro + "; " : "") +
        `meta_batch_error: ${json.error.message}`;
      return out;
    }

    // 4. Aplicar nomes resolvidos e gravar IDs originais
    for (const [id, campos_] of Array.from(idsParaResolver.entries())) {
      const nome: string | undefined = json[id]?.name;
      if (!nome) continue;
      for (const campo of campos_) {
        // Guardar ID original na coluna correspondente
        if (campo === "utm_campaign") out.meta_campaign_id = id;
        else if (campo === "utm_content") out.meta_adset_id = id;
        else if (campo === "utm_term" || campo === "nome_anuncio") out.meta_ad_id = id;
        // Substituir pelo nome
        (out as any)[campo] = nome;
      }
    }
  } catch (e: any) {
    out.rastreio_erro = (out.rastreio_erro ? out.rastreio_erro + "; " : "") +
      `meta_batch_fetch_error: ${e.message}`;
  }

  return out;
}

/**
 * Resolve token Meta para chamadas da Graph API em agências filhas.
 * Tenta token próprio da filha primeiro; se não tiver, usa relatorios_conexoes do master (token da Lavínia).
 * Master nunca chama esta função.
 */
export async function getTokenMetaDaAgencia(
  agencia: { meta_business_token?: string | null; meta_token?: string | null; parent_id?: string | null },
  supabase: any
): Promise<string | null> {
  const ownToken = agencia.meta_business_token || agencia.meta_token || null;
  if (ownToken) return ownToken;
  if (agencia.parent_id) {
    try {
      const { data: rc } = await supabase.from("relatorios_conexoes")
        .select("meta_token")
        .eq("agencia_id", agencia.parent_id)
        .order("created_at", { ascending: false })
        .limit(1).single();
      if (rc?.meta_token) return rc.meta_token;
    } catch {}
  }
  return null;
}
