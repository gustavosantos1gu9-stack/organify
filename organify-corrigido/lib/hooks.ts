"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase, getAgenciaId } from "./supabase";
export { supabase, getAgenciaId };

// Registrar mudança de etapa no histórico
export async function registrarHistoricoLead(
  leadId: string,
  etapaAnterior: string,
  etapaNova: string
) {
  const agenciaId = await getAgenciaId();
  if (!agenciaId) return;
  await supabase.from("leads_historico").insert({
    lead_id: leadId,
    agencia_id: agenciaId,
    etapa_anterior: etapaAnterior,
    etapa_nova: etapaNova,
  });
}

// Calcular tempo médio em dias: de "em_contato" até "ganho"
export async function calcularTempoMedioDecisao(): Promise<number> {
  const agenciaId = await getAgenciaId();
  if (!agenciaId) return 0;

  // Buscar todos os leads ganhos
  const { data: leadsGanhos } = await supabase
    .from("leads")
    .select("id")
    .eq("agencia_id", agenciaId)
    .eq("etapa", "ganho");

  if (!leadsGanhos?.length) return 0;

  const ids = leadsGanhos.map((l) => l.id);

  // Para cada lead ganho, buscar quando entrou em "em_contato" e quando foi "ganho"
  const { data: historico } = await supabase
    .from("leads_historico")
    .select("lead_id, etapa_nova, created_at")
    .in("lead_id", ids)
    .in("etapa_nova", ["em_contato", "ganho"])
    .order("created_at", { ascending: true });

  if (!historico?.length) return 0;

  // Agrupar por lead e calcular diferença
  const tempos: number[] = [];
  const porLead: Record<string, { inicio?: string; fim?: string }> = {};

  for (const h of historico) {
    if (!porLead[h.lead_id]) porLead[h.lead_id] = {};
    if (h.etapa_nova === "em_contato" && !porLead[h.lead_id].inicio) {
      porLead[h.lead_id].inicio = h.created_at;
    }
    if (h.etapa_nova === "ganho") {
      porLead[h.lead_id].fim = h.created_at;
    }
  }

  for (const lead of Object.values(porLead)) {
    if (lead.inicio && lead.fim) {
      const dias = Math.round(
        (new Date(lead.fim).getTime() - new Date(lead.inicio).getTime()) /
        (1000 * 60 * 60 * 24)
      );
      if (dias >= 0) tempos.push(dias);
    }
  }

  if (!tempos.length) return 0;
  return Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length);
}

// ─── tipos básicos ────────────────────────────────────────────────────────────
export interface Cliente {
  id: string; agencia_id: string; tipo: string; nome: string;
  documento?: string; email?: string; telefone?: string; whatsapp?: boolean;
  instagram?: string; empresa?: string; valor_oportunidade?: number;
  faturamento?: number; status: string; responsavel_id?: string;
  origem_id?: string; observacoes?: string;
  cep?: string; estado?: string; cidade?: string; logradouro?: string;
  numero?: string; complemento?: string; bairro?: string;
  utm_source?: string; utm_medium?: string; utm_campaign?: string;
  utm_content?: string; utm_term?: string; created_at: string;
  origens?: { nome: string };
  servico?: string; frequencia?: string; status_recorrencia?: string;
}

export interface Lead {
  id: string; agencia_id: string; nome: string; email?: string;
  telefone?: string; etapa: string; valor?: number;
  utm_source?: string; utm_medium?: string; utm_campaign?: string;
  utm_content?: string; utm_term?: string;
  origem_id?: string; responsavel_id?: string;
  convertido_cliente_id?: string; created_at: string;
  origens?: { nome: string };
}

export interface Movimentacao {
  id: string; agencia_id: string; tipo: string; descricao: string;
  valor: number; data: string; categoria_id?: string; cliente_id?: string;
  observacoes?: string; created_at: string;
  categorias_financeiras?: { nome: string };
  clientes?: { nome: string };
}

export interface LancamentoFuturo {
  id: string; agencia_id: string; tipo: string; descricao: string;
  valor: number; data_vencimento: string; pago: boolean;
  categoria_id?: string; cliente_id?: string;
  forma_pagamento?: string; fornecedor_id?: string;
  despesa?: boolean; considerar_cac?: boolean;
  valor_recebido?: number; data_lancamento?: string;
  categorias_financeiras?: { nome: string };
  clientes?: { nome: string };
}

export interface Recorrencia {
  id: string; agencia_id: string; tipo: string; descricao: string;
  valor: number; periodicidade: string; dia_vencimento: number;
  categoria_id?: string; ativo: boolean;
  categorias_financeiras?: { nome: string };
}

export interface Origem {
  id: string; agencia_id: string; nome: string; ativo: boolean;
}

export interface CategoriaCliente {
  id: string; agencia_id: string; nome: string;
}

export interface CategoriaFinanceira {
  id: string; agencia_id: string; nome: string; tipo: string;
}

export interface Agencia {
  id: string; nome: string; cnpj?: string; email?: string;
  telefone?: string; logo_url?: string;
  cep?: string; estado?: string; cidade?: string;
  logradouro?: string; numero?: string; complemento?: string; bairro?: string;
}

export interface KPIDashboard {
  clientes_recorrentes: number;
  clientes_inadimplentes: number;
  clientes_cancelados: number;
  total_entradas: number;
  total_saidas: number;
  lucro: number;
}

// ─── helper genérico ─────────────────────────────────────────────────────────
function useQuery<T>(
  fetcher: (agenciaId: string) => Promise<T>,
  deps: unknown[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const agenciaId = await getAgenciaId();
      if (!agenciaId) { setError("Agência não encontrada"); setLoading(false); return; }
      const result = await fetcher(agenciaId);
      setData(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, deps); // eslint-disable-line

  useEffect(() => { load(); }, [load]);
  return { data, loading, error, refresh: load };
}

// ─── CLIENTES ────────────────────────────────────────────────────────────────
export function useClientes(busca = "", status = "") {
  return useQuery<Cliente[]>(async (agenciaId) => {
    let q = supabase
      .from("clientes")
      .select("*, origens(nome)")
      .eq("agencia_id", agenciaId)
      .order("created_at", { ascending: false });
    if (busca) q = q.ilike("nome", `%${busca}%`);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }, [busca, status]);
}

export async function criarCliente(payload: Partial<Cliente>) {
  const agenciaId = await getAgenciaId();
  const { data, error } = await supabase
    .from("clientes")
    .insert({ ...payload, agencia_id: agenciaId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function atualizarCliente(id: string, payload: Partial<Cliente>) {
  const { data, error } = await supabase
    .from("clientes")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removerCliente(id: string) {
  const { error } = await supabase.from("clientes").delete().eq("id", id);
  if (error) throw error;
}

export function useClienteById(id: string) {
  return useQuery<Cliente>(async () => {
    const { data, error } = await supabase
      .from("clientes")
      .select("*, origens(nome)")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  }, [id]);
}

// ─── LEADS / CRM ─────────────────────────────────────────────────────────────
export function useLeads(busca = "", etapa = "") {
  return useQuery<Lead[]>(async (agenciaId) => {
    let q = supabase
      .from("leads")
      .select("*, origens(nome)")
      .eq("agencia_id", agenciaId)
      .order("created_at", { ascending: false });
    if (busca) q = q.ilike("nome", `%${busca}%`);
    if (etapa) q = q.eq("etapa", etapa);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }, [busca, etapa]);
}

export async function criarLead(payload: Partial<Lead>) {
  const agenciaId = await getAgenciaId();
  const { data, error } = await supabase
    .from("leads")
    .insert({ ...payload, agencia_id: agenciaId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function atualizarEtapaLead(id: string, etapa: string) {
  // Buscar etapa atual antes de atualizar
  const { data: leadAtual } = await supabase
    .from("leads").select("etapa").eq("id", id).single();

  const { data, error } = await supabase
    .from("leads")
    .update({ etapa, updated_at: new Date().toISOString() })
    .eq("id", id).select().single();
  if (error) throw error;

  // Registrar mudança no histórico
  if (leadAtual?.etapa && leadAtual.etapa !== etapa) {
    await registrarHistoricoLead(id, leadAtual.etapa, etapa);
  }
  return data;
}

export async function removerLead(id: string) {
  const { error } = await supabase.from("leads").delete().eq("id", id);
  if (error) throw error;
}

// ─── MOVIMENTAÇÕES ───────────────────────────────────────────────────────────
export function useMovimentacoes(busca = "", from = "", to = "") {
  return useQuery<Movimentacao[]>(async (agenciaId) => {
    let q = supabase
      .from("movimentacoes")
      .select("*, categorias_financeiras(nome), clientes(nome)")
      .eq("agencia_id", agenciaId)
      .order("data", { ascending: false });
    if (busca) q = q.ilike("descricao", `%${busca}%`);
    if (from) q = q.gte("data", from);
    if (to) q = q.lte("data", to);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }, [busca, from, to]);
}

export async function criarMovimentacao(payload: Partial<Movimentacao>) {
  const agenciaId = await getAgenciaId();
  const { data, error } = await supabase
    .from("movimentacoes")
    .insert({ ...payload, agencia_id: agenciaId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removerMovimentacao(id: string) {
  const { error } = await supabase.from("movimentacoes").delete().eq("id", id);
  if (error) throw error;
}

// ─── MOVIMENTAÇÕES ───────────────────────────────────────────────────────────
export function useMovimentacoes(busca = "", tipo = "") {
  return useQuery<Movimentacao[]>(async (agenciaId) => {
    let q = supabase
      .from("movimentacoes")
      .select("*, categorias_financeiras(nome), clientes(nome)")
      .eq("agencia_id", agenciaId)
      .order("data", { ascending: false });
    if (busca) q = q.ilike("descricao", `%${busca}%`);
    if (tipo) q = q.eq("tipo", tipo);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }, [busca, tipo]);
}

export async function criarMovimentacao(payload: Partial<Movimentacao>) {
  const agenciaId = await getAgenciaId();
  const { data, error } = await supabase
    .from("movimentacoes")
    .insert({ ...payload, agencia_id: agenciaId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removerMovimentacao(id: string) {
  const { error } = await supabase.from("movimentacoes").delete().eq("id", id);
  if (error) throw error;
}

// ─── GERAR LANÇAMENTOS RECORRÊNCIA (para clientes assessoria) ────────────────
export async function gerarLancamentosRecorrencia(cliente: Partial<Cliente> & { id: string; nome: string }) {
  const agenciaId = await getAgenciaId();
  if (!agenciaId || !cliente.valor_oportunidade || cliente.servico !== "assessoria") return;

  const valor = cliente.valor_oportunidade;
  const frequencia = cliente.frequencia || "mensal";
  const hoje = new Date();
  
  // Deletar lançamentos futuros anteriores deste cliente (não pagos)
  await supabase
    .from("lancamentos_futuros")
    .delete()
    .eq("cliente_id", cliente.id)
    .eq("pago", false);

  const lancamentos: Array<{
    agencia_id: string;
    tipo: string;
    descricao: string;
    valor: number;
    data_vencimento: string;
    cliente_id: string;
    pago: boolean;
  }> = [];

  if (frequencia === "mensal") {
    // Gerar 12 lançamentos mensais
    for (let i = 0; i < 12; i++) {
      const data = new Date(hoje);
      data.setMonth(data.getMonth() + i);
      lancamentos.push({
        agencia_id: agenciaId,
        tipo: "entrada",
        descricao: `Assessoria - ${cliente.nome}`,
        valor: valor,
        data_vencimento: data.toISOString().split("T")[0],
        cliente_id: cliente.id,
        pago: false,
      });
    }
  } else if (frequencia === "quinzenal") {
    // Gerar 24 lançamentos quinzenais (valor / 2)
    for (let i = 0; i < 24; i++) {
      const data = new Date(hoje);
      data.setDate(data.getDate() + (i * 15));
      lancamentos.push({
        agencia_id: agenciaId,
        tipo: "entrada",
        descricao: `Assessoria - ${cliente.nome}`,
        valor: valor / 2,
        data_vencimento: data.toISOString().split("T")[0],
        cliente_id: cliente.id,
        pago: false,
      });
    }
  } else if (frequencia === "trimestral") {
    // Gerar 4 lançamentos trimestrais (valor * 3)
    for (let i = 0; i < 4; i++) {
      const data = new Date(hoje);
      data.setMonth(data.getMonth() + (i * 3));
      lancamentos.push({
        agencia_id: agenciaId,
        tipo: "entrada",
        descricao: `Assessoria - ${cliente.nome}`,
        valor: valor * 3,
        data_vencimento: data.toISOString().split("T")[0],
        cliente_id: cliente.id,
        pago: false,
      });
    }
  }

  if (lancamentos.length > 0) {
    const { error } = await supabase.from("lancamentos_futuros").insert(lancamentos);
    if (error) throw error;
  }

  // Também criar/atualizar recorrência
  const { data: recExistente } = await supabase
    .from("recorrencias")
    .select("id")
    .eq("cliente_id", cliente.id)
    .single();

  const periodicidade = frequencia === "quinzenal" ? "quinzenal" : frequencia === "trimestral" ? "trimestral" : "mensal";
  const valorRecorrencia = frequencia === "quinzenal" ? valor / 2 : frequencia === "trimestral" ? valor * 3 : valor;

  if (recExistente) {
    await supabase
      .from("recorrencias")
      .update({
        valor: valorRecorrencia,
        periodicidade,
        ativo: true,
      })
      .eq("id", recExistente.id);
  } else {
    await supabase.from("recorrencias").insert({
      agencia_id: agenciaId,
      tipo: "entrada",
      descricao: `Assessoria - ${cliente.nome}`,
      valor: valorRecorrencia,
      periodicidade,
      dia_vencimento: hoje.getDate(),
      cliente_id: cliente.id,
      ativo: true,
    });
  }
}

// ─── LANÇAMENTOS FUTUROS ─────────────────────────────────────────────────────
export function useLancamentosFuturos(busca = "") {
  return useQuery<LancamentoFuturo[]>(async (agenciaId) => {
    let q = supabase
      .from("lancamentos_futuros")
      .select("*, categorias_financeiras(nome), clientes(nome)")
      .eq("agencia_id", agenciaId)
      .order("data_vencimento", { ascending: true });
    if (busca) q = q.ilike("descricao", `%${busca}%`);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }, [busca]);
}

export async function criarLancamentoFuturo(payload: Partial<LancamentoFuturo>) {
  const agenciaId = await getAgenciaId();
  const { data, error } = await supabase
    .from("lancamentos_futuros")
    .insert({ ...payload, agencia_id: agenciaId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function marcarPago(id: string) {
  const { data, error } = await supabase
    .from("lancamentos_futuros")
    .update({ pago: true, data_pagamento: new Date().toISOString().split("T")[0] })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removerLancamento(id: string) {
  const { error } = await supabase.from("lancamentos_futuros").delete().eq("id", id);
  if (error) throw error;
}

// ─── RECORRÊNCIAS ────────────────────────────────────────────────────────────
export function useRecorrencias(busca = "") {
  return useQuery<Recorrencia[]>(async (agenciaId) => {
    let q = supabase
      .from("recorrencias")
      .select("*, categorias_financeiras(nome)")
      .eq("agencia_id", agenciaId)
      .order("created_at", { ascending: false });
    if (busca) q = q.ilike("descricao", `%${busca}%`);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }, [busca]);
}

export async function criarRecorrencia(payload: Partial<Recorrencia>) {
  const agenciaId = await getAgenciaId();
  const { data, error } = await supabase
    .from("recorrencias")
    .insert({ ...payload, agencia_id: agenciaId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removerRecorrencia(id: string) {
  const { error } = await supabase.from("recorrencias").delete().eq("id", id);
  if (error) throw error;
}

// ─── ORIGENS ─────────────────────────────────────────────────────────────────
export function useOrigens() {
  return useQuery<Origem[]>(async (agenciaId) => {
    const { data, error } = await supabase
      .from("origens")
      .select("*")
      .eq("agencia_id", agenciaId)
      .order("nome");
    if (error) throw error;
    return data ?? [];
  });
}

export async function criarOrigem(nome: string) {
  const agenciaId = await getAgenciaId();
  const { data, error } = await supabase
    .from("origens")
    .insert({ nome, agencia_id: agenciaId, ativo: true })
    .select().single();
  if (error) throw error;
  return data;
}

export async function removerOrigem(id: string) {
  const { error } = await supabase.from("origens").delete().eq("id", id);
  if (error) throw error;
}

// ─── CATEGORIAS CLIENTES ─────────────────────────────────────────────────────
export function useCategoriasClientes() {
  return useQuery<CategoriaCliente[]>(async (agenciaId) => {
    const { data, error } = await supabase
      .from("categorias_clientes")
      .select("*")
      .eq("agencia_id", agenciaId)
      .order("nome");
    if (error) throw error;
    return data ?? [];
  });
}

export async function criarCategoriaCliente(nome: string) {
  const agenciaId = await getAgenciaId();
  const { data, error } = await supabase
    .from("categorias_clientes")
    .insert({ nome, agencia_id: agenciaId })
    .select().single();
  if (error) throw error;
  return data;
}

export async function removerCategoriaCliente(id: string) {
  const { error } = await supabase.from("categorias_clientes").delete().eq("id", id);
  if (error) throw error;
}

// ─── CATEGORIAS FINANCEIRAS ──────────────────────────────────────────────────
export function useCategoriasFinanceiras(tipo?: "entrada" | "saida") {
  return useQuery<CategoriaFinanceira[]>(async (agenciaId) => {
    let q = supabase
      .from("categorias_financeiras")
      .select("*")
      .eq("agencia_id", agenciaId)
      .order("nome");
    if (tipo) q = q.eq("tipo", tipo);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }, [tipo]);
}

export async function criarCategoriaFinanceira(nome: string, tipo: "entrada" | "saida") {
  const agenciaId = await getAgenciaId();
  const { data, error } = await supabase
    .from("categorias_financeiras")
    .insert({ nome, tipo, agencia_id: agenciaId })
    .select().single();
  if (error) throw error;
  return data;
}

export async function removerCategoriaFinanceira(id: string) {
  const { error } = await supabase.from("categorias_financeiras").delete().eq("id", id);
  if (error) throw error;
}

// ─── AGÊNCIA ─────────────────────────────────────────────────────────────────
export function useAgencia() {
  return useQuery<Agencia>(async (agenciaId) => {
    const { data, error } = await supabase
      .from("agencias")
      .select("*")
      .eq("id", agenciaId)
      .single();
    if (error) throw error;
    return data;
  });
}

export async function atualizarAgencia(id: string, payload: Partial<Agencia>) {
  const { data, error } = await supabase
    .from("agencias")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select().single();
  if (error) throw error;
  return data;
}

// ─── KPIs DASHBOARD ──────────────────────────────────────────────────────────
export function useKPIsDashboard(from: string, to: string) {
  return useQuery<KPIDashboard>(async (agenciaId) => {
    const [clientesRes, movsRes] = await Promise.all([
      supabase.from("clientes").select("status").eq("agencia_id", agenciaId),
      supabase.from("movimentacoes").select("tipo, valor")
        .eq("agencia_id", agenciaId)
        .gte("data", from).lte("data", to),
    ]);
    const clientes = clientesRes.data ?? [];
    const movs = movsRes.data ?? [];

    return {
      clientes_recorrentes: clientes.filter((c) => c.status === "ativo").length,
      clientes_inadimplentes: clientes.filter((c) => c.status === "inadimplente").length,
      clientes_cancelados: clientes.filter((c) => c.status === "cancelado").length,
      total_entradas: movs.filter((m) => m.tipo === "entrada").reduce((a, b) => a + b.valor, 0),
      total_saidas: movs.filter((m) => m.tipo === "saida").reduce((a, b) => a + b.valor, 0),
      lucro: movs.filter((m) => m.tipo === "entrada").reduce((a, b) => a + b.valor, 0) -
             movs.filter((m) => m.tipo === "saida").reduce((a, b) => a + b.valor, 0),
    };
  }, [from, to]);
}

// ─── CONVERSÃO POR PÚBLICO (UTM) ─────────────────────────────────────────────
export function useConversaoPorPublico() {
  return useQuery<{ publico: string; campanha: string; total_leads: number; total_convertidos: number; taxa: number }[]>(
    async (agenciaId) => {
      const { data, error } = await supabase
        .from("leads")
        .select("utm_content, utm_campaign, convertido_cliente_id")
        .eq("agencia_id", agenciaId)
        .not("utm_content", "is", null);
      if (error) throw error;

      const map: Record<string, { total: number; convertidos: number; campanha: string }> = {};
      for (const l of data ?? []) {
        const key = l.utm_content;
        if (!map[key]) map[key] = { total: 0, convertidos: 0, campanha: l.utm_campaign ?? "" };
        map[key].total++;
        if (l.convertido_cliente_id) map[key].convertidos++;
      }
      return Object.entries(map).map(([publico, v]) => ({
        publico,
        campanha: v.campanha,
        total_leads: v.total,
        total_convertidos: v.convertidos,
        taxa: v.total > 0 ? Math.round((v.convertidos / v.total) * 100 * 10) / 10 : 0,
      })).sort((a, b) => b.taxa - a.taxa);
    }
  );
}

// ─── DADOS GRÁFICOS (entradas/saídas por mês) ────────────────────────────────
export function useDadosGraficos(meses = 6) {
  return useQuery<{ mes: string; entrada: number; saida: number }[]>(async (agenciaId) => {
    const from = new Date();
    from.setMonth(from.getMonth() - meses);
    const { data, error } = await supabase
      .from("movimentacoes")
      .select("tipo, valor, data")
      .eq("agencia_id", agenciaId)
      .gte("data", from.toISOString().split("T")[0]);
    if (error) throw error;

    const mesesMap: Record<string, { entrada: number; saida: number }> = {};
    const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

    for (const m of data ?? []) {
      const d = new Date(m.data);
      const key = `${MESES[d.getMonth()]}/${d.getFullYear().toString().slice(2)}`;
      if (!mesesMap[key]) mesesMap[key] = { entrada: 0, saida: 0 };
      mesesMap[key][m.tipo as "entrada" | "saida"] += m.valor;
    }

    return Object.entries(mesesMap).map(([mes, v]) => ({ mes, ...v }));
  }, [meses]);
}
