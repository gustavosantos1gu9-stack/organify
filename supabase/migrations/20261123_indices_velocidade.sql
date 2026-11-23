-- SALX Convert — índices para deixar as consultas mais rápidas (23/11/2026)
-- Só CRIA índices: não altera, apaga nem move nenhum dado.
-- Seguro para rodar mais de uma vez: pula o que já existe e o que não bate com o banco
-- (tabela ou coluna com outro nome). No final, mostra o que foi criado e o que foi pulado.

do $$
declare
  r record;
  cols text[];
  achadas int;
begin
  for r in select * from (values
    -- Inbox, CRM, Reuniões de vendas, Início
    ('conversas',            'agencia_id, ultima_mensagem_at',      'idx_conversas_ag_ultima_msg'),
    ('conversas',            'agencia_id, etapa_alterada_at',       'idx_conversas_ag_etapa_alterada'),
    ('conversas',            'agencia_id, primeira_mensagem_at',    'idx_conversas_ag_primeira_msg'),
    ('conversas',            'agencia_id, created_at',              'idx_conversas_ag_created'),
    ('conversas',            'agencia_id, contato_numero',          'idx_conversas_ag_numero'),
    ('mensagens',            'conversa_id, created_at',             'idx_mensagens_conversa_created'),
    ('etapas_historico',     'agencia_id, created_at',              'idx_etapas_hist_ag_created'),
    ('etapas_historico',     'conversa_id',                         'idx_etapas_hist_conversa'),
    -- Carteira, Escalas, Churn
    ('controle_clientes',    'agencia_id, status',                  'idx_controle_clientes_ag_status'),
    ('escala_config',        'agencia_id, gestor_escala',           'idx_escala_config_ag_gestor'),
    ('escala_atualizacoes',  'cliente_id',                          'idx_escala_atual_cliente'),
    ('anotacoes',            'cliente_id',                          'idx_anotacoes_cliente'),
    ('subitens_clientes',    'cliente_id',                          'idx_subitens_cliente'),
    ('performance_semanal',  'relatorio_id, semana_inicio',         'idx_perf_semanal_rel_semana'),
    ('cadastros_clientes',   'agencia_id',                          'idx_cadastros_ag'),
    ('relatorios',           'agencia_id',                          'idx_relatorios_ag'),
    -- Financeiro
    ('movimentacoes',        'agencia_id, data',                    'idx_movimentacoes_ag_data'),
    ('movimentacoes',        'cliente_id',                          'idx_movimentacoes_cliente'),
    ('lancamentos_futuros',  'agencia_id, data_vencimento',         'idx_lancamentos_ag_venc'),
    ('lancamentos_futuros',  'cliente_id',                          'idx_lancamentos_cliente'),
    ('recorrencias',         'agencia_id',                          'idx_recorrencias_ag'),
    ('clientes',             'agencia_id, status',                  'idx_clientes_ag_status'),
    ('leads',                'agencia_id, created_at',              'idx_leads_ag_created'),
    -- Login, menu e agências
    ('usuarios',             'auth_user_id',                        'idx_usuarios_auth'),
    ('usuarios',             'email',                               'idx_usuarios_email'),
    ('agencias',             'parent_id',                           'idx_agencias_parent'),
    ('agencias',             'reconexao_token',                     'idx_agencias_reconexao_token')
  ) as t(tabela, colunas, nome)
  loop
    cols := string_to_array(replace(r.colunas, ' ', ''), ',');
    select count(*) into achadas
      from information_schema.columns
     where table_schema = 'public' and table_name = r.tabela and column_name = any(cols);
    if achadas = array_length(cols, 1) then
      execute format('create index if not exists %I on public.%I (%s)', r.nome, r.tabela, r.colunas);
      raise notice 'ok: % (%)', r.nome, r.tabela;
    else
      raise notice 'pulado: % — tabela ou coluna não encontrada em %', r.nome, r.tabela;
    end if;
  end loop;
end $$;

-- Conferência: índices criados por este script
select tablename as tabela, indexname as indice
  from pg_indexes
 where schemaname = 'public' and indexname like 'idx\_%'
 order by tablename, indexname;
