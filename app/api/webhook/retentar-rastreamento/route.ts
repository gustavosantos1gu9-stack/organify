import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getMetaToken, resolverIdsMeta, temMacroInvalida, NUMERIC_ID_REGEX } from '@/lib/meta-tracking'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function tentarRastrear(conversa_id: string, numero: string, agencia_id: string, timestamp: string) {
  // Verificar se já foi rastreada
  const { data: conversa } = await supabase
    .from('conversas')
    .select('id, origem, primeira_mensagem_at')
    .eq('id', conversa_id)
    .single()

  if (!conversa) return { ok: false, status: 'conversa_nao_encontrada' }
  if (conversa.origem && conversa.origem !== 'Não Rastreada') return { ok: true, status: 'ja_rastreado', origem: conversa.origem }

  // Buscar número do WhatsApp da agência (NÃO hardcoded)
  const { data: agencia } = await supabase
    .from('agencias')
    .select('whatsapp_numero')
    .eq('id', agencia_id)
    .single()

  const waNumero = agencia?.whatsapp_numero || ''

  // Tentar por número
  let tracking = null
  const { data: t1 } = await supabase
    .from('rastreamentos_pendentes')
    .select('*').eq('wa_numero', numero).single()
  if (t1) tracking = t1

  // Tentar por rastreamento recente (até 5 minutos)
  if (!tracking && waNumero) {
    const cincoMinAtras = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { data: recentes } = await supabase
      .from('rastreamentos_pendentes')
      .select('*')
      .gt('created_at', cincoMinAtras)
      .eq('wa_destino', waNumero)
      .order('created_at', { ascending: false })
      .limit(10)

    if (recentes && recentes.length > 0) {
      const candidato = recentes.find((r: any) => {
        if (!r.utm_campaign && !r.link_id && !r.fbclid) return false
        const isNumeroReal = /^\d{10,15}$/.test(r.wa_numero || '')
        return !isNumeroReal
      })
      if (candidato) tracking = candidato
    }
  }

  if (!tracking) return { ok: false, status: 'sem_rastreamento' }

  // Extrair link_id
  const linkIdFromTerm = tracking.utm_term && tracking.utm_term.match(/^[0-9a-f-]{36}$/)
    ? tracking.utm_term : tracking.link_id

  // Montar updates
  const updates: any = {
    origem: tracking.origem || 'Meta Ads',
    utm_source: tracking.utm_source,
    utm_medium: tracking.utm_medium,
    utm_campaign: tracking.utm_campaign || null,
    utm_content: tracking.utm_content || null,
    utm_term: tracking.utm_term || null,
    fbclid: tracking.fbclid,
  }
  // Copiar leadgen_id do rastreamento para a conversa (atribuição Meta Lead Ads)
  if (tracking.leadgen_id) updates.leadgen_id = tracking.leadgen_id

  // Resolver IDs numéricos e macros inválidas via Meta Graph API
  const temNumerico = NUMERIC_ID_REGEX.test(updates.utm_campaign || '') || NUMERIC_ID_REGEX.test(updates.utm_content || '') || NUMERIC_ID_REGEX.test(updates.utm_term || '')
  const temMacro = temMacroInvalida(updates.utm_campaign) || temMacroInvalida(updates.utm_content) || temMacroInvalida(updates.utm_term)
  if (temNumerico || temMacro) {
    try {
      const { data: ag } = await supabase.from('agencias')
        .select('meta_business_token, meta_token, parent_id').eq('id', agencia_id).single()
      let parentMeta: { meta_business_token?: string | null; meta_token?: string | null } | null = null
      if (ag?.parent_id) {
        const { data: p } = await supabase.from('agencias')
          .select('meta_business_token, meta_token').eq('id', ag.parent_id).single()
        parentMeta = p
      }
      const adsToken = getMetaToken(ag || {}, parentMeta)
      if (adsToken || temMacro) {
        const ids = await resolverIdsMeta({
          utm_campaign: updates.utm_campaign,
          utm_content: updates.utm_content,
          utm_term: updates.utm_term,
          nome_anuncio: updates.nome_anuncio,
        }, adsToken || '')
        updates.utm_campaign = ids.utm_campaign
        updates.utm_content = ids.utm_content
        updates.utm_term = ids.utm_term
        updates.nome_anuncio = ids.nome_anuncio
        updates.meta_campaign_id = ids.meta_campaign_id
        updates.meta_adset_id = ids.meta_adset_id
        updates.meta_ad_id = ids.meta_ad_id
        if (ids.rastreio_erro) {
          updates.rastreio_erro = ids.rastreio_erro
          updates.rastreio_status = 'erro_macro'
        } else {
          updates.rastreio_status = 'resolvido'
        }
      }
    } catch (e: any) {
      updates.rastreio_status = 'erro_graph'
      updates.rastreio_erro = `${e.code ?? '??'}: ${e.message}`
    }
  }

  if (linkIdFromTerm) {
    updates.link_id = linkIdFromTerm
    const { data: linkData } = await supabase
      .from('links_campanha').select('nome').eq('id', linkIdFromTerm).single()
    if (linkData?.nome) updates.link_nome = linkData.nome
    try { await supabase.rpc('incrementar_cliques', { link_uuid: linkIdFromTerm }) } catch {}
  }

  if (!conversa.primeira_mensagem_at) {
    updates.primeira_mensagem_at = timestamp || new Date().toISOString()
  }

  await supabase.from('conversas').update(updates).eq('id', conversa_id)

  // Limpar pendentes
  await supabase.from('rastreamentos_pendentes').delete().eq('wa_numero', numero)
  if (tracking.fbclid) {
    await supabase.from('rastreamentos_pendentes').delete().eq('fbclid', tracking.fbclid)
  }

  return { ok: true, status: 'rastreado', campanha: tracking.utm_campaign }
}

export async function POST(req: NextRequest) {
  try {
    const { conversa_id, numero, agencia_id, timestamp } = await req.json()

    if (!conversa_id || !numero || !agencia_id) {
      return NextResponse.json({ ok: false, erro: 'Parâmetros obrigatórios faltando' })
    }

    const TENTATIVAS = [8000, 20000, 45000] // 8s, 20s, 45s

    for (let i = 0; i < TENTATIVAS.length; i++) {
      await new Promise(resolve => setTimeout(resolve, TENTATIVAS[i]))

      const resultado = await tentarRastrear(conversa_id, numero, agencia_id, timestamp)

      if (resultado.status === 'ja_rastreado') {
        return NextResponse.json({ ok: true, status: 'ja_rastreado', tentativa: i + 1 })
      }

      if (resultado.status === 'rastreado') {
        return NextResponse.json({ ok: true, status: 'rastreado', tentativa: i + 1, campanha: resultado.campanha })
      }

      if (resultado.status === 'conversa_nao_encontrada') {
        return NextResponse.json({ ok: false, status: 'conversa_nao_encontrada' })
      }

      // sem_rastreamento — continuar para próxima tentativa
    }

    return NextResponse.json({ ok: true, status: 'esgotado', mensagem: 'Todas as tentativas falharam' })

  } catch (e: any) {
    return NextResponse.json({ ok: false, erro: e.message }, { status: 500 })
  }
}
