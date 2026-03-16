-- =============================================
-- ORGANIFY — Schema completo Supabase/PostgreSQL
-- Inclui rastreamento UTM de campanhas
-- =============================================

-- Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- AGÊNCIAS (multi-tenant: cada usuário = 1 agência)
-- =============================================
CREATE TABLE agencias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  cnpj TEXT,
  email TEXT,
  telefone TEXT,
  logo_url TEXT,
  cep TEXT, estado TEXT, cidade TEXT,
  logradouro TEXT, numero TEXT, complemento TEXT, bairro TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- USUÁRIOS / MEMBROS DA AGÊNCIA
-- =============================================
CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agencia_id UUID REFERENCES agencias(id) ON DELETE CASCADE,
  auth_user_id UUID UNIQUE, -- referência ao auth.users do Supabase
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT,
  cargo TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ORIGENS (Facebook, Google, etc.)
-- =============================================
CREATE TABLE origens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agencia_id UUID REFERENCES agencias(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dados padrão (inseridos por trigger após criar agência)
-- Facebook, Google, Instagram, LinkedIn, Outro

-- =============================================
-- CATEGORIAS DE CLIENTES / TAGS
-- =============================================
CREATE TABLE categorias_clientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agencia_id UUID REFERENCES agencias(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- CLIENTES (com rastreamento UTM completo)
-- =============================================
CREATE TABLE clientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agencia_id UUID REFERENCES agencias(id) ON DELETE CASCADE,
  tipo TEXT CHECK (tipo IN ('fisica','juridica')) DEFAULT 'juridica',
  nome TEXT NOT NULL,
  documento TEXT,          -- CPF ou CNPJ
  email TEXT,
  telefone TEXT,
  whatsapp BOOLEAN DEFAULT FALSE,
  instagram TEXT,
  empresa TEXT,
  valor_oportunidade NUMERIC(12,2) DEFAULT 0,
  faturamento NUMERIC(12,2) DEFAULT 0,
  status TEXT CHECK (status IN ('ativo','inadimplente','cancelado')) DEFAULT 'ativo',
  responsavel_id UUID REFERENCES usuarios(id),
  origem_id UUID REFERENCES origens(id),
  observacoes TEXT,
  -- Endereço
  cep TEXT, estado TEXT, cidade TEXT,
  logradouro TEXT, numero TEXT, complemento TEXT, bairro TEXT,
  -- UTM Tracking (campanha de tráfego)
  utm_source TEXT,      -- ex: facebook
  utm_medium TEXT,      -- ex: cpc
  utm_campaign TEXT,    -- ex: black-friday-nov24
  utm_content TEXT,     -- público alvo: ex: mulheres-30-45
  utm_term TEXT,        -- anúncio específico: ex: video-01
  -- Asaas
  asaas_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de junção clientes <> categorias
CREATE TABLE clientes_categorias (
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
  categoria_id UUID REFERENCES categorias_clientes(id) ON DELETE CASCADE,
  PRIMARY KEY (cliente_id, categoria_id)
);

-- =============================================
-- LEADS / CRM (com rastreamento UTM completo)
-- =============================================
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agencia_id UUID REFERENCES agencias(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  whatsapp BOOLEAN DEFAULT FALSE,
  etapa TEXT CHECK (etapa IN ('novo','em_contato','reuniao_agendada','proposta_enviada','ganho','perdido')) DEFAULT 'novo',
  valor NUMERIC(12,2) DEFAULT 0,
  responsavel_id UUID REFERENCES usuarios(id),
  origem_id UUID REFERENCES origens(id),
  -- UTM Tracking — capturado pela Evolution API na primeira mensagem
  utm_source TEXT,      -- ex: facebook
  utm_medium TEXT,      -- ex: cpc
  utm_campaign TEXT,    -- ex: black-friday-nov24
  utm_content TEXT,     -- público: ex: publico-mulheres-30-45
  utm_term TEXT,        -- anúncio: ex: anuncio-video-01
  -- Metadata WhatsApp
  whatsapp_numero TEXT,
  whatsapp_mensagem_inicial TEXT,
  observacoes TEXT,
  convertido_cliente_id UUID REFERENCES clientes(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- FINANCEIRO — Categorias de entrada/saída
-- =============================================
CREATE TABLE categorias_financeiras (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agencia_id UUID REFERENCES agencias(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT CHECK (tipo IN ('entrada','saida')) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- CONTAS BANCÁRIAS
-- =============================================
CREATE TABLE contas_bancarias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agencia_id UUID REFERENCES agencias(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  banco TEXT,
  agencia_bancaria TEXT,
  conta TEXT,
  tipo TEXT CHECK (tipo IN ('corrente','poupanca','caixa')) DEFAULT 'corrente',
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- FORNECEDORES
-- =============================================
CREATE TABLE fornecedores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agencia_id UUID REFERENCES agencias(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  documento TEXT,
  email TEXT,
  telefone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- MOVIMENTAÇÕES FINANCEIRAS
-- =============================================
CREATE TABLE movimentacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agencia_id UUID REFERENCES agencias(id) ON DELETE CASCADE,
  tipo TEXT CHECK (tipo IN ('entrada','saida')) NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL,
  data DATE NOT NULL,
  categoria_id UUID REFERENCES categorias_financeiras(id),
  cliente_id UUID REFERENCES clientes(id),
  fornecedor_id UUID REFERENCES fornecedores(id),
  conta_bancaria_id UUID REFERENCES contas_bancarias(id),
  comprovante_url TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- LANÇAMENTOS FUTUROS (contas a pagar/receber)
-- =============================================
CREATE TABLE lancamentos_futuros (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agencia_id UUID REFERENCES agencias(id) ON DELETE CASCADE,
  tipo TEXT CHECK (tipo IN ('entrada','saida')) NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  categoria_id UUID REFERENCES categorias_financeiras(id),
  cliente_id UUID REFERENCES clientes(id),
  fornecedor_id UUID REFERENCES fornecedores(id),
  pago BOOLEAN DEFAULT FALSE,
  data_pagamento DATE,
  movimentacao_id UUID REFERENCES movimentacoes(id),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- RECORRÊNCIAS
-- =============================================
CREATE TABLE recorrencias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agencia_id UUID REFERENCES agencias(id) ON DELETE CASCADE,
  tipo TEXT CHECK (tipo IN ('entrada','saida')) NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL,
  periodicidade TEXT CHECK (periodicidade IN ('mensal','trimestral','semestral','anual')) DEFAULT 'mensal',
  dia_vencimento INTEGER CHECK (dia_vencimento BETWEEN 1 AND 31) DEFAULT 1,
  categoria_id UUID REFERENCES categorias_financeiras(id),
  cliente_id UUID REFERENCES clientes(id),
  ativo BOOLEAN DEFAULT TRUE,
  proximo_vencimento DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- METAS
-- =============================================
CREATE TABLE metas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agencia_id UUID REFERENCES agencias(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  valor_meta NUMERIC(12,2),
  valor_atual NUMERIC(12,2) DEFAULT 0,
  tipo TEXT CHECK (tipo IN ('receita','leads','clientes','outro')) DEFAULT 'receita',
  data_inicio DATE,
  data_fim DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TIMES (grupos de usuários)
-- =============================================
CREATE TABLE times (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agencia_id UUID REFERENCES agencias(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE times_usuarios (
  time_id UUID REFERENCES times(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  PRIMARY KEY (time_id, usuario_id)
);

-- =============================================
-- INTEGRAÇÕES
-- =============================================
CREATE TABLE integracoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agencia_id UUID REFERENCES agencias(id) ON DELETE CASCADE,
  tipo TEXT CHECK (tipo IN ('whatsapp','openai','asaas')) NOT NULL,
  config JSONB DEFAULT '{}',
  ativo BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- VIEW: Relatório de conversão por público (UTM)
-- =============================================
CREATE OR REPLACE VIEW vw_conversao_por_publico AS
SELECT
  l.agencia_id,
  l.utm_content AS publico,
  l.utm_campaign AS campanha,
  l.utm_source AS origem,
  COUNT(l.id) AS total_leads,
  COUNT(l.convertido_cliente_id) AS total_convertidos,
  ROUND(
    COUNT(l.convertido_cliente_id)::NUMERIC / NULLIF(COUNT(l.id), 0) * 100, 2
  ) AS taxa_conversao_pct
FROM leads l
WHERE l.utm_content IS NOT NULL
GROUP BY l.agencia_id, l.utm_content, l.utm_campaign, l.utm_source
ORDER BY taxa_conversao_pct DESC NULLS LAST;

-- =============================================
-- VIEW: Dashboard KPIs
-- =============================================
CREATE OR REPLACE VIEW vw_dashboard_kpis AS
SELECT
  a.id AS agencia_id,
  COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'ativo') AS clientes_recorrentes,
  COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'inadimplente') AS clientes_inadimplentes,
  COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'cancelado') AS clientes_cancelados,
  COALESCE(SUM(m.valor) FILTER (WHERE m.tipo = 'entrada'), 0) AS total_entradas,
  COALESCE(SUM(m.valor) FILTER (WHERE m.tipo = 'saida'), 0) AS total_saidas,
  COALESCE(SUM(m.valor) FILTER (WHERE m.tipo = 'entrada'), 0) -
    COALESCE(SUM(m.valor) FILTER (WHERE m.tipo = 'saida'), 0) AS lucro
FROM agencias a
LEFT JOIN clientes c ON c.agencia_id = a.id
LEFT JOIN movimentacoes m ON m.agencia_id = a.id
GROUP BY a.id;

-- =============================================
-- RLS — Segurança por agência
-- (cada agência só vê seus próprios dados)
-- =============================================
ALTER TABLE agencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lancamentos_futuros ENABLE ROW LEVEL SECURITY;
ALTER TABLE recorrencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Exemplo de policy (replicar para todas as tabelas):
CREATE POLICY "agencia_isolada" ON clientes
  USING (agencia_id = (
    SELECT agencia_id FROM usuarios WHERE auth_user_id = auth.uid()
  ));

-- =============================================
-- FUNÇÃO: Inserir lead via API (Evolution API webhook)
-- Captura UTMs da mensagem inicial do WhatsApp
-- =============================================
CREATE OR REPLACE FUNCTION inserir_lead_whatsapp(
  p_agencia_id UUID,
  p_nome TEXT,
  p_telefone TEXT,
  p_mensagem TEXT,
  p_utm_source TEXT DEFAULT NULL,
  p_utm_medium TEXT DEFAULT NULL,
  p_utm_campaign TEXT DEFAULT NULL,
  p_utm_content TEXT DEFAULT NULL,
  p_utm_term TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_origem_id UUID;
  v_lead_id UUID;
BEGIN
  -- Busca origem correspondente ao utm_source
  SELECT id INTO v_origem_id FROM origens
  WHERE agencia_id = p_agencia_id
    AND LOWER(nome) = LOWER(COALESCE(p_utm_source, 'outro'))
  LIMIT 1;

  INSERT INTO leads (
    agencia_id, nome, telefone, whatsapp,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    origem_id, whatsapp_numero, whatsapp_mensagem_inicial, etapa
  ) VALUES (
    p_agencia_id, p_nome, p_telefone, TRUE,
    p_utm_source, p_utm_medium, p_utm_campaign, p_utm_content, p_utm_term,
    v_origem_id, p_telefone, p_mensagem, 'novo'
  )
  RETURNING id INTO v_lead_id;

  RETURN v_lead_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
