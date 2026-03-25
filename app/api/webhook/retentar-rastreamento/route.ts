import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { conversa_id, numero, agencia_id, timestamp } = await req.json()

    if (!conversa_id || !numero || !agencia_id) {
      return NextResponse.json({ ok: false, erro: 'Parâmetros obrigatórios faltando' })
    }

    // Aguardar 8 segundos para dar tempo do rastreamento chegar
    await new Promise(resolve => setTimeout(resolve, 8000))

    // Verificar se a conversa já foi rastreada entre enquanto
    const { data: conversa } = await supabase
      .from('conversas')
      .select('id, origem, utm_campaign, primeira_mensagem_at')
      .eq('id', conversa_id)
      .single()

    if (!conversa) return NextResponse.json({ ok: false, erro: 'Conversa não encontrada' })

    // Se já foi rastreada, não fazer nada
    if (conversa.origem && conversa.origem !== 'Não Rastreada') {
      return NextResponse.json({ ok: true, status: 'ja_rastreado' })
    }

    // Tentar buscar rastreamento por número
    let tracking = null
    const { data: t1 } = await supabase
      .from('rastreamentos_pendentes')
      .select('*')
      .eq('wa_numero', numero)
      .single()
    if (t1) tracking = t1

    // Tentar por rastreamento recente (até 3 minutos)
    if (!tracking) {
      const tresMinAtras = new Date(Date.now() - 3 * 60 * 1000).toISOString()
      const { data: recentes } = await supabase
        .from('rastreamentos_pendentes')
        .select('*')
        .gt('created_at', tresMinAtras)
        .eq('wa_destino', '555193694003')
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

    if (!tracking) {
      return NextResponse.json({ ok: true, status: 'sem_rastreamento' })
    }

    // Extrair link_id do utm_term se for UUID
    const linkIdFromTerm = tracking.utm_term && tracking.utm_term.match(/^[0-9a-f-]{36}$/)
      ? tracking.utm_term : tracking.link_id

    // Atualizar conversa com rastreamento
    const updates: any = {
      origem: tracking.origem || 'Meta Ads',
      utm_source: tracking.utm_source,
      utm_medium: tracking.utm_medium,
      utm_campaign: tracking.utm_campaign,
      utm_content: tracking.utm_content,
      utm_term: tracking.utm_term,
      fbclid: tracking.fbclid,
    }

    if (linkIdFromTerm) {
      updates.link_id = linkIdFromTerm
      const { data: linkData } = await supabase
        .from('links_campanha')
        .select('nome')
        .eq('id', linkIdFromTerm)
        .single()
      if (linkData?.nome) updates.link_nome = linkData.nome
      try { await supabase.rpc('incrementar_cliques', { link_uuid: linkIdFromTerm }) } catch {}
    }

    if (!conversa.primeira_mensagem_at) {
      updates.primeira_mensagem_at = timestamp || new Date().toISOString()
    }

    await supabase.from('conversas').update(updates).eq('id', conversa_id)

    // Limpar rastreamento pendente
    await supabase.from('rastreamentos_pendentes').delete().eq('wa_numero', numero)
    if (tracking.fbclid) {
      await supabase.from('rastreamentos_pendentes').delete().eq('fbclid', tracking.fbclid)
    }

    return NextResponse.json({ ok: true, status: 'rastreado', campanha: tracking.utm_campaign })

  } catch (e: any) {
    return NextResponse.json({ ok: false, erro: e.message }, { status: 500 })
  }
}
