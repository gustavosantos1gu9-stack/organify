import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const AGENCIA_ID = '32cdce6e-4664-4ac6-979d-6d68a1a68745'

export async function POST(req: NextRequest) {
  const { id } = await req.json()

  if (!id) {
    return NextResponse.json({ error: 'ID obrigatório.' }, { status: 400 })
  }

  // Buscar cadastro
  const { data: cadastro, error: fetchError } = await supabase
    .from('cadastros_clientes')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !cadastro) {
    return NextResponse.json({ error: 'Cadastro não encontrado.' }, { status: 404 })
  }

  // Data de entrada = data que respondeu o formulário
  const dataEntrada = new Date(cadastro.criado_em)
    .toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  // Criar em controle_clientes
  const { error: insertError } = await supabase.from('controle_clientes').insert({
    agencia_id: AGENCIA_ID,
    nome: cadastro.nome,
    status: 'entrada',
    data_entrada: dataEntrada,
    faturamento_medio: cadastro.faturamento_medio,
    investimento_mensal: 0,
    instagram: '',
    data_inicio_campanha: '',
    agendamentos: '',
    progresso_gestor: '',
    progresso_consultor: '',
    feed: '',
    feedback: '',
    sdr: '',
    head_squad: '',
    consultor: '',
    gestor: '',
    squad: '',
    ultimo_aumento: '',
    acao: '',
    acao_feita: '',
    otimizacoes: '',
    tarefas: '',
    datas_otimizacoes: '',
    motivo: '',
    razao_nome: cadastro.cnpj,
    grupo: '',
    created_at: new Date().toISOString(),
  })

  if (insertError) {
    return NextResponse.json({ error: 'Erro ao criar cliente.' }, { status: 500 })
  }

  // Atualizar status do cadastro para aprovado
  await supabase
    .from('cadastros_clientes')
    .update({ status: 'aprovado' })
    .eq('id', id)

  return NextResponse.json({ ok: true })
}
