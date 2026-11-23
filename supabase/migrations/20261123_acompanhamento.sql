-- SALX Convert — Acompanhamento das clientes e equipe (23/11/2026)
-- Só CRIA tabelas novas. Não altera nem apaga nada que já existe.
-- Seguro para rodar mais de uma vez.

-- Ficha da cliente para a metodologia (1 linha por cliente da Carteira)
create table if not exists public.acomp_clientes (
  cliente_id          uuid primary key references public.controle_clientes(id) on delete cascade,
  agencia_id          uuid not null,
  cs                  text,
  foco                text,                -- laser, micro, regeneracao
  tem_secretaria      boolean,
  drive_url           text,
  preco               text,
  avaliacao_gratuita  boolean default true,
  oferta              text,
  pacotes             text,
  ticket_medio        numeric,
  -- custos ideais desta cliente (variam por região, potencial e know-how)
  custo_msg_ideal     numeric,
  custo_lead_ideal    numeric,
  custo_agend_ideal   numeric,
  cpa_ideal           numeric,
  proxima_analise     date,
  onboarding          jsonb not null default '{}'::jsonb,
  notas_parceria      jsonb not null default '{}'::jsonb,
  updated_at          timestamptz not null default now()
);
create index if not exists idx_acomp_clientes_ag on public.acomp_clientes (agencia_id);

-- Histórico de fase (de → para, quem mudou)
create table if not exists public.acomp_fase_historico (
  id          uuid primary key default gen_random_uuid(),
  agencia_id  uuid not null,
  cliente_id  uuid not null references public.controle_clientes(id) on delete cascade,
  de          text,
  para        text not null,
  por         text,
  motivo      text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_acomp_fase_hist_cliente on public.acomp_fase_historico (cliente_id, created_at desc);
create index if not exists idx_acomp_fase_hist_ag on public.acomp_fase_historico (agencia_id, created_at desc);

-- Registro do gestor/CS, organizado pela IA
create table if not exists public.acomp_registros (
  id             uuid primary key default gen_random_uuid(),
  agencia_id     uuid not null,
  cliente_id     uuid not null references public.controle_clientes(id) on delete cascade,
  autor          text,
  texto_original text,
  tipo           text,      -- atendimento, preco_oferta, publico, criativo, campanha, outro
  feito          text,
  pendencia      text,
  proximo_passo  text,
  reavaliar_em   date,
  created_at     timestamptz not null default now()
);
create index if not exists idx_acomp_registros_cliente on public.acomp_registros (cliente_id, created_at desc);
create index if not exists idx_acomp_registros_ag on public.acomp_registros (agencia_id, created_at desc);

-- Tarefas da cliente com prazo
create table if not exists public.acomp_tarefas (
  id          uuid primary key default gen_random_uuid(),
  agencia_id  uuid not null,
  cliente_id  uuid not null references public.controle_clientes(id) on delete cascade,
  titulo      text not null,
  prazo       date,
  feita       boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists idx_acomp_tarefas_cliente on public.acomp_tarefas (cliente_id);
create index if not exists idx_acomp_tarefas_ag on public.acomp_tarefas (agencia_id, feita, prazo);

-- Mensagem semanal para o grupo da cliente
create table if not exists public.acomp_mensagens (
  id           uuid primary key default gen_random_uuid(),
  agencia_id   uuid not null,
  cliente_id   uuid not null references public.controle_clientes(id) on delete cascade,
  semana       date not null,
  texto        text not null,
  status       text not null default 'rascunho',   -- rascunho, enviada, pulada
  autor        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_acomp_mensagens_cliente on public.acomp_mensagens (cliente_id, semana desc);
create index if not exists idx_acomp_mensagens_ag on public.acomp_mensagens (agencia_id, semana desc);

-- Configuração da metodologia (instruções da IA e faixas), 1 linha por agência
create table if not exists public.acomp_config (
  agencia_id   uuid primary key,
  instrucoes   text,
  faixas       jsonb not null default '{}'::jsonb,
  updated_at   timestamptz not null default now()
);

-- Remuneração da equipe (fica no Financeiro)
create table if not exists public.equipe_remuneracao (
  id          uuid primary key default gen_random_uuid(),
  agencia_id  uuid not null,
  pessoa      text not null,
  papel       text not null,          -- gestor, cs
  fixo        numeric not null default 0,
  bonus_max   numeric not null default 0,
  pesos       jsonb not null default '{}'::jsonb,
  metas       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  unique (agencia_id, pessoa, papel)
);

-- Conferência
select table_name as tabela_criada
  from information_schema.tables
 where table_schema = 'public'
   and table_name in ('acomp_clientes','acomp_fase_historico','acomp_registros','acomp_tarefas','acomp_mensagens','acomp_config','equipe_remuneracao')
 order by 1;
