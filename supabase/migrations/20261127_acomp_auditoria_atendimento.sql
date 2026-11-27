-- Vínculo ficha (controle_clientes) → agência filha na plataforma (WhatsApp da cliente)
alter table acomp_clientes add column if not exists filha_id uuid references agencias(id) on delete set null;
-- Padrão de atendimento Salx (editável em Acompanhamento → Metodologia)
alter table acomp_config add column if not exists padrao_atendimento text;
-- Auditoria semanal do atendimento: números (sem IA) + leitura da IA
create table if not exists acomp_auditorias (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references agencias(id) on delete cascade,
  cliente_id uuid not null references controle_clientes(id) on delete cascade,
  filha_id uuid references agencias(id) on delete set null,
  semana_inicio date not null,
  numeros jsonb not null default '{}'::jsonb,
  ia jsonb,
  modelo text,
  conversas_lidas int default 0,
  created_at timestamptz not null default now(),
  unique (cliente_id, semana_inicio)
);
create index if not exists acomp_auditorias_cliente_idx on acomp_auditorias (cliente_id, semana_inicio desc);
alter table acomp_auditorias disable row level security;
