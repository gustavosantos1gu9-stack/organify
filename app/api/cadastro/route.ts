import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    nome, cnpj, cpf, rg,
    endereco_empresa, endereco_pessoal,
    email, investimento_anuncios,
    ticket_micro_laser, regiao_anunciar,
    faturamento_medio, login_facebook, senha_facebook
  } = body

  const { data: encData, error: encError } = await supabase
    .rpc('encrypt_text', { texto: senha_facebook, chave: process.env.CADASTRO_ENCRYPT_KEY! })

  if (encError) return NextResponse.json({ error: 'Erro ao processar dados.' }, { status: 500 })

  const { error } = await supabase.from('cadastros_clientes').insert({
    nome, cnpj, cpf, rg,
    endereco_empresa, endereco_pessoal,
    email, investimento_anuncios,
    ticket_micro_laser, regiao_anunciar,
    faturamento_medio, login_facebook,
    senha_facebook_enc: encData
  })

  if (error) return NextResponse.json({ error: 'Erro ao salvar cadastro.' }, { status: 500 })

  // Notificar master via WhatsApp
  try {
    const { data: master } = await supabase.from('agencias')
      .select('id, evolution_url, evolution_key, whatsapp_instancia, whatsapp_numero, grupo_notificacao_jid')
      .is('parent_id', null).limit(1).single();

    if (master) {
      let evoUrl = master.evolution_url || '';
      let evoKey = master.evolution_key || '';
      if (evoUrl && evoKey && master.whatsapp_instancia && (master.grupo_notificacao_jid || master.whatsapp_numero)) {
        // Buscar o ID do cadastro recém-criado
        const { data: cadastroCriado } = await supabase.from('cadastros_clientes')
          .select('id').eq('email', email).order('criado_em', { ascending: false }).limit(1).single();
        const cadastroId = cadastroCriado?.id || '';

        // Marcar como último cadastro pendente (pra responder só com número)
        await supabase.from('cadastros_clientes').update({ status: 'notificado' }).eq('id', cadastroId);

        const texto = `📋 *Novo cadastro recebido!*\n\n👤 *Nome:* ${nome}\n📧 *Email:* ${email}\n💰 *Investimento:* ${investimento_anuncios || 'N/A'}\n🎯 *Ticket:* ${ticket_micro_laser || 'N/A'}\n📍 *Região:* ${regiao_anunciar || 'N/A'}\n💵 *Faturamento:* ${faturamento_medio || 'N/A'}\n\n_Responda:_\n*1* — Aprovar\n*2* — Enviar contrato\n*ativar ${nome.split(' ')[0].toLowerCase()} <valor> <mensal/trimestral/quinzenal>*\n_Ex: ativar ${nome.split(' ')[0].toLowerCase()} 997 mensal_`;

        // Enviar para o número pessoal (conversa consigo mesmo)
        const destino = master.whatsapp_numero;
        await fetch(`${evoUrl}/message/sendText/${master.whatsapp_instancia}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: evoKey },
          body: JSON.stringify({ number: destino, text: texto }),
        });
      }
    }
  } catch (e) {
    console.error('[cadastro] Erro ao notificar:', e);
  }

  return NextResponse.json({ ok: true })
}
