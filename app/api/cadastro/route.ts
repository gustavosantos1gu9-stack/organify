import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
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

  return NextResponse.json({ ok: true })
}
