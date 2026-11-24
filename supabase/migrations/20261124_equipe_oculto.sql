-- Permite remover pessoas da tela Financeiro → Equipe sem apagar histórico
alter table equipe_remuneracao add column if not exists oculto boolean not null default false;
