-- Schema do SALX Convert / Organify
-- Gerado em 2026-04-07

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS agencias (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nome text NOT NULL,
  cnpj text,
  email text,
  telefone text,
  logo_url text,
  cep text,
  estado text,
  cidade text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  meta_pixel_id text,
  meta_token text,
  meta_ativo boolean DEFAULT false,
  whatsapp_numero text,
  whatsapp_mensagem text,
  openai_key text,
  openai_ativo boolean DEFAULT false,
  asaas_token text,
  evolution_url text,
  evolution_key text,
  whatsapp_instancia text,
  meta_ad_account_id text,
  meta_business_token text,
  meta_ads_ativo boolean DEFAULT false,
  meta_churn integer DEFAULT 0,
  parent_id uuid,
  modulos_habilitados _text,
  whatsapp_conectado boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS alertas_saldo (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  agencia_id uuid NOT NULL,
  ad_account_id text NOT NULL,
  nome_cliente text NOT NULL,
  saldo_alerta numeric DEFAULT 50,
  grupo_id text,
  grupo_nome text,
  ativo boolean DEFAULT true,
  ultimo_alerta timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  template_saldo text,
  template_status text,
  forma_pagamento text
);

CREATE TABLE IF NOT EXISTS anotacoes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  agencia_id uuid,
  cliente_id uuid,
  cliente_nome text,
  usuario text,
  conteudo text,
  created_at timestamptz DEFAULT now(),
  tipo text DEFAULT 'atualizacoes'::text
);

CREATE TABLE IF NOT EXISTS cadastros_clientes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  agencia_id uuid DEFAULT '32cdce6e-4664-4ac6-979d-6d68a1a68745'::uuid NOT NULL,
  nome text NOT NULL,
  cnpj text NOT NULL,
  cpf text NOT NULL,
  rg text NOT NULL,
  endereco_empresa text NOT NULL,
  endereco_pessoal text NOT NULL,
  email text NOT NULL,
  investimento_anuncios text NOT NULL,
  ticket_micro_laser text NOT NULL,
  regiao_anunciar text NOT NULL,
  faturamento_medio text NOT NULL,
  login_facebook text NOT NULL,
  senha_facebook_enc text NOT NULL,
  status text DEFAULT 'pendente'::text NOT NULL,
  criado_em timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS categorias_clientes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  agencia_id uuid,
  nome text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categorias_financeiras (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  agencia_id uuid,
  nome text NOT NULL,
  tipo text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clientes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  agencia_id uuid,
  tipo text DEFAULT 'juridica'::text,
  nome text NOT NULL,
  documento text,
  email text,
  telefone text,
  whatsapp boolean DEFAULT false,
  instagram text,
  empresa text,
  valor_oportunidade numeric DEFAULT 0,
  faturamento numeric DEFAULT 0,
  status text DEFAULT 'ativo'::text,
  responsavel_id uuid,
  origem_id uuid,
  observacoes text,
  cep text,
  estado text,
  cidade text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  asaas_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  servico text DEFAULT 'mentoria'::text,
  frequencia text DEFAULT 'mensal'::text,
  status_recorrencia text DEFAULT 'ativo'::text,
  categoria_id uuid,
  consultor text,
  gestor text,
  squad text,
  investimento_mensal numeric DEFAULT 0,
  motivo_churn text,
  feedback text,
  monday_id bigint,
  cadastro_id uuid
);

CREATE TABLE IF NOT EXISTS clientes_categorias (
  cliente_id uuid NOT NULL,
  categoria_id uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS contas_bancarias (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  agencia_id uuid,
  nome text NOT NULL,
  banco text,
  agencia_bancaria text,
  conta text,
  tipo text DEFAULT 'corrente'::text,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  saldo_inicial numeric DEFAULT 0,
  data_saldo_inicial date,
  apelido text,
  chave_pix text,
  conta_recebimento boolean DEFAULT false,
  observacoes text
);

CREATE TABLE IF NOT EXISTS controle_clientes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  agencia_id uuid,
  nome text,
  status text DEFAULT 'ativo'::text,
  instagram text,
  data_entrada text,
  data_inicio_campanha text,
  agendamentos text,
  faturamento_medio text,
  progresso_gestor text,
  progresso_consultor text,
  data_churn text,
  feed text,
  feedback text,
  sdr text,
  head_squad text,
  consultor text,
  gestor text,
  squad text,
  investimento_mensal numeric DEFAULT 0,
  ultimo_aumento text,
  acao text,
  acao_feita text,
  otimizacoes text,
  tarefas text,
  datas_otimizacoes text,
  motivo text,
  motivo_churn text,
  data_saida text,
  razao_nome text,
  monday_id bigint,
  grupo text,
  created_at timestamptz DEFAULT now(),
  cadastro_id uuid,
  ordem integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS conversas (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  agencia_id uuid,
  instancia text NOT NULL,
  contato_numero text NOT NULL,
  contato_nome text,
  contato_foto text,
  ultima_mensagem text,
  ultima_mensagem_at timestamptz DEFAULT now(),
  nao_lidas integer DEFAULT 0,
  lead_id uuid,
  created_at timestamptz DEFAULT now(),
  contato_jid text,
  origem text DEFAULT 'Não Rastreada'::text,
  origem_detalhe text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  fbclid text,
  link_id text,
  link_nome text,
  etapa_jornada text DEFAULT 'Fez Contato'::text,
  etapa_alterada_at timestamptz,
  primeira_mensagem_at timestamptz,
  dispositivo text,
  navegador text,
  ip text,
  nome_anuncio text,
  agendou_at timestamptz
);

CREATE TABLE IF NOT EXISTS escalas (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  agencia_id uuid,
  tipo text NOT NULL,
  cliente_id uuid,
  nome text NOT NULL,
  planilha_preenchida boolean DEFAULT false,
  agendamentos integer DEFAULT 0,
  custo_por_agendamento numeric DEFAULT 0,
  escala boolean DEFAULT false,
  investimento_anterior numeric DEFAULT 0,
  investimento_atual numeric DEFAULT 0,
  link_planilha text,
  mes integer NOT NULL,
  ano integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS etapas_historico (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  conversa_id uuid NOT NULL,
  agencia_id uuid NOT NULL,
  etapa_anterior text,
  etapa_nova text NOT NULL,
  alterado_por text DEFAULT 'manual'::text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fornecedores (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  agencia_id uuid,
  nome text NOT NULL,
  documento text,
  email text,
  telefone text,
  created_at timestamptz DEFAULT now(),
  tipo_pessoa text DEFAULT 'juridica'::text
);

CREATE TABLE IF NOT EXISTS historico_churn_rate (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  agencia_id uuid,
  periodo text,
  data_calculo date,
  base_clientes integer,
  total_churn integer,
  churn_rate numeric,
  detalhes jsonb,
  created_at timestamptz DEFAULT now(),
  tempo_medio_meses numeric
);

CREATE TABLE IF NOT EXISTS integracoes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  agencia_id uuid,
  tipo text NOT NULL,
  config jsonb DEFAULT '{}'::jsonb,
  ativo boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jornada_etapas (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  agencia_id uuid,
  nome text NOT NULL,
  evento_conversao text,
  eh_venda boolean DEFAULT false,
  valor_padrao numeric DEFAULT 0,
  eh_primeiro_contato boolean DEFAULT false,
  termo_chave text,
  ordem integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lancamentos_futuros (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  agencia_id uuid,
  tipo text NOT NULL,
  descricao text NOT NULL,
  valor numeric NOT NULL,
  data_vencimento date NOT NULL,
  categoria_id uuid,
  cliente_id uuid,
  fornecedor_id uuid,
  pago boolean DEFAULT false,
  data_pagamento date,
  movimentacao_id uuid,
  observacoes text,
  created_at timestamptz DEFAULT now(),
  forma_pagamento text,
  despesa boolean DEFAULT false,
  considerar_cac boolean DEFAULT false,
  valor_recebido numeric,
  data_lancamento date
);

CREATE TABLE IF NOT EXISTS leads (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  agencia_id uuid,
  nome text NOT NULL,
  email text,
  telefone text,
  whatsapp boolean DEFAULT false,
  etapa text DEFAULT 'novo'::text,
  valor numeric DEFAULT 0,
  responsavel_id uuid,
  origem_id uuid,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  whatsapp_numero text,
  whatsapp_mensagem_inicial text,
  observacoes text,
  convertido_cliente_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leads_historico (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  lead_id uuid,
  agencia_id uuid,
  etapa_anterior text,
  etapa_nova text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS links_campanha (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  agencia_id uuid,
  nome text NOT NULL,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  wa_numero text,
  wa_mensagem text,
  link_gerado text,
  cliques integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  redirect_tipo text DEFAULT 'web'::text,
  titulo_redirect text DEFAULT 'Por favor, aguarde alguns segundos.'::text,
  msg_redirect text DEFAULT 'Estamos localizando um atendente disponível...'::text
);

CREATE TABLE IF NOT EXISTS mensagens (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  conversa_id uuid,
  agencia_id uuid,
  mensagem_id text,
  de_mim boolean DEFAULT false,
  tipo text DEFAULT 'text'::text,
  conteudo text,
  midia_url text,
  status text DEFAULT 'sent'::text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS metas (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  agencia_id uuid,
  titulo text NOT NULL,
  descricao text,
  valor_meta numeric,
  valor_atual numeric DEFAULT 0,
  tipo text DEFAULT 'receita'::text,
  data_inicio date,
  data_fim date,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS metas_escalas (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  agencia_id uuid,
  tipo text NOT NULL,
  mes integer NOT NULL,
  ano integer NOT NULL,
  meta_planilhas integer DEFAULT 0,
  meta_escala_pct numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS metas_reunioes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  agencia_id uuid,
  mes integer NOT NULL,
  ano integer NOT NULL,
  meta_total integer DEFAULT 0,
  meta_realizadas integer DEFAULT 0,
  meta_apresentacao integer DEFAULT 0,
  meta_alinhamento integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS movimentacoes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  agencia_id uuid,
  tipo text NOT NULL,
  descricao text NOT NULL,
  valor numeric NOT NULL,
  data date NOT NULL,
  categoria_id uuid,
  cliente_id uuid,
  fornecedor_id uuid,
  conta_bancaria_id uuid,
  comprovante_url text,
  observacoes text,
  created_at timestamptz DEFAULT now(),
  despesa boolean DEFAULT false,
  considerar_cac boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS origens (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  agencia_id uuid,
  nome text NOT NULL,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS performance_criativos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  agencia_id uuid NOT NULL,
  relatorio_id uuid,
  periodo_inicio date NOT NULL,
  periodo_fim date NOT NULL,
  ad_name text NOT NULL,
  agendamentos integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  adset_name text DEFAULT ''::text
);

CREATE TABLE IF NOT EXISTS pixel_disparos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  agencia_id uuid,
  conversa_id uuid,
  etapa text,
  evento text,
  status text,
  retorno text,
  created_at timestamptz DEFAULT now(),
  telefone text
);

CREATE TABLE IF NOT EXISTS rastreamentos_historico (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  conversa_id uuid,
  agencia_id uuid,
  contato_numero text,
  origem text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  fbclid text,
  link_id uuid,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rastreamentos_pendentes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  wa_numero text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  fbclid text,
  link_id text,
  origem text,
  url_completa text,
  created_at timestamptz DEFAULT now(),
  wa_destino text
);

CREATE TABLE IF NOT EXISTS recorrencias (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  agencia_id uuid,
  tipo text NOT NULL,
  descricao text NOT NULL,
  valor numeric NOT NULL,
  periodicidade text DEFAULT 'mensal'::text,
  dia_vencimento integer DEFAULT 1,
  categoria_id uuid,
  cliente_id uuid,
  ativo boolean DEFAULT true,
  proximo_vencimento date,
  created_at timestamptz DEFAULT now(),
  considerar_cac boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS relatorios (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  agencia_id uuid,
  nome text NOT NULL,
  nome_cliente text NOT NULL,
  ad_account_id text NOT NULL,
  meta_token text,
  grupo_id text,
  grupo_nome text,
  contato_numero text,
  template text NOT NULL,
  periodo text DEFAULT 'hoje'::text,
  frequencia text DEFAULT 'diario'::text,
  horario_envio text DEFAULT '17:30'::text,
  dia_semana integer,
  ativo boolean DEFAULT true,
  proximo_envio timestamptz,
  ultimo_envio timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS relatorios_conexoes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  agencia_id uuid,
  meta_token text,
  meta_nome text,
  meta_user_id text,
  evolution_url text,
  evolution_key text,
  whatsapp_instancia text,
  whatsapp_conectado boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reunioes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  agencia_id uuid,
  nome text NOT NULL,
  participantes text,
  status text DEFAULT 'Agendado'::text,
  data date,
  motivo text,
  feedback text,
  responsavel text,
  created_at timestamptz DEFAULT now(),
  cliente_id uuid
);

CREATE TABLE IF NOT EXISTS snapshots_mensais (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  agencia_id uuid,
  mes text,
  ano integer,
  mes_ano text,
  clientes_ativos integer DEFAULT 0,
  clientes_pausados integer DEFAULT 0,
  clientes_entrada integer DEFAULT 0,
  clientes_total integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subitens_clientes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  agencia_id uuid,
  cliente_id uuid,
  texto text,
  feito boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS times (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  agencia_id uuid,
  nome text NOT NULL,
  created_at timestamptz DEFAULT now(),
  permissoes jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS times_usuarios (
  time_id uuid NOT NULL,
  usuario_id uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS usuarios (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  agencia_id uuid,
  auth_user_id uuid,
  nome text NOT NULL,
  email text NOT NULL,
  telefone text,
  cargo text,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  documento text,
  time_id uuid,
  cpf text
);

CREATE TABLE IF NOT EXISTS vw_conversao_por_publico (
  agencia_id uuid,
  publico text,
  campanha text,
  origem text,
  total_leads bigint,
  total_convertidos bigint,
  taxa_conversao_pct numeric
);

CREATE TABLE IF NOT EXISTS vw_dashboard_kpis (
  agencia_id uuid,
  clientes_recorrentes bigint,
  clientes_inadimplentes bigint,
  clientes_cancelados bigint,
  total_entradas numeric,
  total_saidas numeric,
  lucro numeric
);

