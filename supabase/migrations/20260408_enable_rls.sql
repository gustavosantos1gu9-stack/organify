-- ============================================================
-- Habilitar RLS em todas as tabelas com agencia_id
-- Política: usuário só acessa dados da sua própria agência
-- ============================================================

-- Função helper: retorna agencia_id do usuário logado
CREATE OR REPLACE FUNCTION public.user_agencia_id()
RETURNS uuid AS $$
  SELECT agencia_id FROM public.usuarios
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── Tabelas com agencia_id ──────────────────────────────────

-- agencias (tabela especial: dono acessa a própria + filhas)
ALTER TABLE agencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_agency" ON agencias
  FOR ALL USING (
    id = public.user_agencia_id()
    OR parent_id = public.user_agencia_id()
  );

-- usuarios
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_agency" ON usuarios
  FOR ALL USING (agencia_id = public.user_agencia_id());

-- clientes
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_agency" ON clientes
  FOR ALL USING (agencia_id = public.user_agencia_id());

-- conversas
ALTER TABLE conversas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_agency" ON conversas
  FOR ALL USING (agencia_id = public.user_agencia_id());

-- mensagens
ALTER TABLE mensagens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_agency" ON mensagens
  FOR ALL USING (agencia_id = public.user_agencia_id());

-- leads
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_agency" ON leads
  FOR ALL USING (agencia_id = public.user_agencia_id());

-- leads_historico
ALTER TABLE leads_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_agency" ON leads_historico
  FOR ALL USING (agencia_id = public.user_agencia_id());

-- movimentacoes
ALTER TABLE movimentacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_agency" ON movimentacoes
  FOR ALL USING (agencia_id = public.user_agencia_id());

-- lancamentos_futuros
ALTER TABLE lancamentos_futuros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_agency" ON lancamentos_futuros
  FOR ALL USING (agencia_id = public.user_agencia_id());

-- recorrencias
ALTER TABLE recorrencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_agency" ON recorrencias
  FOR ALL USING (agencia_id = public.user_agencia_id());

-- integracoes
ALTER TABLE integracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_agency" ON integracoes
  FOR ALL USING (agencia_id = public.user_agencia_id());

-- contas_bancarias
ALTER TABLE contas_bancarias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_agency" ON contas_bancarias
  FOR ALL USING (agencia_id = public.user_agencia_id());

-- jornada_etapas
ALTER TABLE jornada_etapas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_agency" ON jornada_etapas
  FOR ALL USING (agencia_id = public.user_agencia_id());

-- etapas_historico
ALTER TABLE etapas_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_agency" ON etapas_historico
  FOR ALL USING (agencia_id = public.user_agencia_id());

-- links_campanha
ALTER TABLE links_campanha ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_agency" ON links_campanha
  FOR ALL USING (agencia_id = public.user_agencia_id());

-- relatorios
ALTER TABLE relatorios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_agency" ON relatorios
  FOR ALL USING (agencia_id = public.user_agencia_id());

-- relatorios_conexoes
ALTER TABLE relatorios_conexoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_agency" ON relatorios_conexoes
  FOR ALL USING (agencia_id = public.user_agencia_id());

-- alertas_saldo
ALTER TABLE alertas_saldo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_agency" ON alertas_saldo
  FOR ALL USING (agencia_id = public.user_agencia_id());

-- pixel_disparos
ALTER TABLE pixel_disparos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_agency" ON pixel_disparos
  FOR ALL USING (agencia_id = public.user_agencia_id());

-- anotacoes
ALTER TABLE anotacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_agency" ON anotacoes
  FOR ALL USING (agencia_id = public.user_agencia_id());

-- reunioes
ALTER TABLE reunioes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_agency" ON reunioes
  FOR ALL USING (agencia_id = public.user_agencia_id());

-- metas
ALTER TABLE metas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_agency" ON metas
  FOR ALL USING (agencia_id = public.user_agencia_id());

-- metas_escalas
ALTER TABLE metas_escalas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_agency" ON metas_escalas
  FOR ALL USING (agencia_id = public.user_agencia_id());

-- metas_reunioes
ALTER TABLE metas_reunioes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_agency" ON metas_reunioes
  FOR ALL USING (agencia_id = public.user_agencia_id());

-- times
ALTER TABLE times ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_agency" ON times
  FOR ALL USING (agencia_id = public.user_agencia_id());

-- escalas
ALTER TABLE escalas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_agency" ON escalas
  FOR ALL USING (agencia_id = public.user_agencia_id());

-- controle_clientes
ALTER TABLE controle_clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_agency" ON controle_clientes
  FOR ALL USING (agencia_id = public.user_agencia_id());

-- categorias_clientes
ALTER TABLE categorias_clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_agency" ON categorias_clientes
  FOR ALL USING (agencia_id = public.user_agencia_id());

-- categorias_financeiras
ALTER TABLE categorias_financeiras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_agency" ON categorias_financeiras
  FOR ALL USING (agencia_id = public.user_agencia_id());

-- fornecedores
ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_agency" ON fornecedores
  FOR ALL USING (agencia_id = public.user_agencia_id());

-- origens
ALTER TABLE origens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_agency" ON origens
  FOR ALL USING (agencia_id = public.user_agencia_id());

-- performance_criativos
ALTER TABLE performance_criativos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_agency" ON performance_criativos
  FOR ALL USING (agencia_id = public.user_agencia_id());

-- rastreamentos_historico
ALTER TABLE rastreamentos_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_agency" ON rastreamentos_historico
  FOR ALL USING (agencia_id = public.user_agencia_id());

-- snapshots_mensais
ALTER TABLE snapshots_mensais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_agency" ON snapshots_mensais
  FOR ALL USING (agencia_id = public.user_agencia_id());

-- subitens_clientes
ALTER TABLE subitens_clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_agency" ON subitens_clientes
  FOR ALL USING (agencia_id = public.user_agencia_id());

-- historico_churn_rate
ALTER TABLE historico_churn_rate ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_agency" ON historico_churn_rate
  FOR ALL USING (agencia_id = public.user_agencia_id());

-- ── Tabelas sem agencia_id ──────────────────────────────────

-- rastreamentos_pendentes (público: recebe dados de tracking)
ALTER TABLE rastreamentos_pendentes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_insert" ON rastreamentos_pendentes
  FOR INSERT WITH CHECK (true);
CREATE POLICY "service_only_read" ON rastreamentos_pendentes
  FOR SELECT USING (false);

-- times_usuarios (vinculado via times.agencia_id)
ALTER TABLE times_usuarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_team" ON times_usuarios
  FOR ALL USING (
    time_id IN (SELECT id FROM times WHERE agencia_id = public.user_agencia_id())
  );

-- clientes_categorias (vinculado via clientes.agencia_id)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clientes_categorias') THEN
    EXECUTE 'ALTER TABLE clientes_categorias ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;
