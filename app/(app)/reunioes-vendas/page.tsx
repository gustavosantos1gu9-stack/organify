"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight, Edit2, X, Users, Calendar, Video, TrendingUp, Target, LayoutDashboard, List } from "lucide-react";
import { supabase, getAgenciaId } from "@/lib/hooks";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

interface Config {
  investimento: number; receita_gerada: number; caixa_coletado: number; mrr: number;
  meta_leads: number; meta_mql: number; meta_agendamentos: number; meta_reunioes: number; meta_vendas: number;
}
interface Dados { leads: number; mql: number; agendamentos: number; reunioes: number; vendas: number; ticketMedio: number; mrrCalculado: number; clientesMes: number; receitaGerada: number; caixaColetado: number; }
interface PrevDados { leads: number; mql: number; agendamentos: number; reunioes: number; vendas: number; receitaGerada: number; caixaColetado: number; }
interface PrevListaCounts { total: number; compareceu: number; fechou: number; }
interface LeadItem { id: string; nome: string; numero: string; etapa: string; origem: string; data: string; }

const CONFIG_ZERO: Config = {
  investimento: 0, receita_gerada: 0, caixa_coletado: 0, mrr: 0,
  meta_leads: 0, meta_mql: 0, meta_agendamentos: 0, meta_reunioes: 0, meta_vendas: 0,
};

function fmt(n: number) { return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function pct(n: number) { return `${n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`; }
function fmtX(n: number) { return `${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x`; }

function MetaBar({ label, realizado, meta }: { label: string; realizado: number; meta: number }) {
  const pctVal = meta > 0 ? Math.min((realizado / meta) * 100, 100) : 0;
  const pctReal = meta > 0 ? Math.round((realizado / meta) * 100) : 0;
  const atingiu = pctReal >= 100;
  const cor = atingiu ? "#22c55e" : pctReal >= 70 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ marginBottom: "18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "7px" }}>
        <span style={{ fontSize: "13px", fontWeight: "600", color: "#e0e0e0" }}>{label}</span>
        <span style={{ fontSize: "13px", fontWeight: "700", color: cor }}>{pctReal}%</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
        <span style={{ fontSize: "10px", color: "#606060", width: "58px" }}>REALIZADO</span>
        <div style={{ flex: 1, height: "5px", background: "#2a2a2a", borderRadius: "3px" }}>
          <div style={{ width: `${pctVal}%`, height: "100%", background: cor, borderRadius: "3px", transition: "width 0.5s" }} />
        </div>
        <span style={{ fontSize: "11px", color: "#a0a0a0", width: "28px", textAlign: "right" }}>{realizado}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "10px", color: "#606060", width: "58px" }}>META</span>
        <div style={{ flex: 1, height: "5px", background: "#2a2a2a", borderRadius: "3px" }}>
          <div style={{ width: "100%", height: "100%", background: "#3a3a3a", borderRadius: "3px" }} />
        </div>
        <span style={{ fontSize: "11px", color: "#606060", width: "28px", textAlign: "right" }}>{meta}</span>
      </div>
    </div>
  );
}

function EditInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ marginBottom: "11px" }}>
      <label style={{ fontSize: "11px", color: "#606060", display: "block", marginBottom: "4px" }}>{label}</label>
      <input type="number" value={value || ""} onChange={e => onChange(parseFloat(e.target.value) || 0)}
        style={{ width: "100%", background: "#1e1e1e", border: "1px solid #3a3a3a", borderRadius: "6px", padding: "7px 10px", fontSize: "13px", color: "#f0f0f0", outline: "none", boxSizing: "border-box" }} />
    </div>
  );
}

function OrigemIcon({ origem }: { origem: string }) {
  if (origem === "Meta Ads") return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:"3px", fontSize:"12px" }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z" fill="#1877f2"/><path d="M15.5 8H13.5V7C13.5 6.448 13.948 6 14.5 6H15.5V4H13.5C11.843 4 10.5 5.343 10.5 7V8H9V10H10.5V20H13.5V10H15.5L15.5 8Z" fill="white"/></svg>
      <span style={{ color:"#1877f2", fontWeight:600 }}>Meta Ads</span>
    </span>
  );
  if (origem === "Social Selling") return <span style={{ fontSize:"12px", fontWeight:600, background:"linear-gradient(45deg,#f09433,#dc2743,#bc1888)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>Social Selling</span>;
  if (origem === "Instagram") return <span style={{ fontSize:"12px", fontWeight:600, background:"linear-gradient(45deg,#f09433,#dc2743,#bc1888)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>Social Selling</span>;
  if (origem === "Não Rastreada" || origem === "—") return <span style={{ fontSize:"12px", color:"#606060" }}>Não rastreada</span>;
  return <span style={{ fontSize:"12px", color:"#a0a0a0" }}>{origem}</span>;
}

function Delta({ curr, prev }: { curr: number; prev: number }) {
  if (prev === 0 || curr === prev) return null;
  const diff = curr - prev;
  const p = Math.round(Math.abs(diff / prev) * 100);
  const isUp = diff > 0;
  return (
    <span style={{ fontSize: "11px", fontWeight: "700", color: isUp ? "#22c55e" : "#ef4444", display: "inline-flex", alignItems: "center", gap: "1px" }}>
      {isUp ? "▲" : "▼"} {p}%
    </span>
  );
}

export default function ReunioesVendasPage() {
  const hoje = new Date();
  const [view, setView] = useState<"lista" | "dash">("lista");
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());

  // Lista state
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [loadingLista, setLoadingLista] = useState(true);

  // Dash state
  const [config, setConfig] = useState<Config>(CONFIG_ZERO);
  const [editConfig, setEditConfig] = useState<Config>(CONFIG_ZERO);
  const [editando, setEditando] = useState(false);
  const [editandoMetas, setEditandoMetas] = useState(false);
  const [dados, setDados] = useState<Dados>({ leads: 0, mql: 0, agendamentos: 0, reunioes: 0, vendas: 0, ticketMedio: 0, mrrCalculado: 0, clientesMes: 0, receitaGerada: 0, caixaColetado: 0 });
  const [loadingDash, setLoadingDash] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [origensLeads, setOrigensLeads] = useState<{ origem: string; count: number; pct: number; agendamentos: number; taxaAgend: number }[]>([]);
  const [dadosPrev, setDadosPrev] = useState<PrevDados>({ leads: 0, mql: 0, agendamentos: 0, reunioes: 0, vendas: 0, receitaGerada: 0, caixaColetado: 0 });
  const [listaPrevCounts, setListaPrevCounts] = useState<PrevListaCounts>({ total: 0, compareceu: 0, fechou: 0 });

  const mesStr = `${ano}-${String(mes).padStart(2, "0")}`;
  const inicio = `${mesStr}-01T00:00:00`;
  const fim = mes === 12 ? `${ano + 1}-01-01T00:00:00` : `${ano}-${String(mes + 1).padStart(2, "0")}-01T00:00:00`;

  // ── Carregar lista ──
  const carregarLista = useCallback(async () => {
    setLoadingLista(true);
    const agId = await getAgenciaId();
    if (!agId) return;
    const nextMes = mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, "0")}-01`;
    const { data } = await supabase.from("conversas")
      .select("id, contato_nome, contato_numero, etapa_jornada, origem, etapa_alterada_at")
      .eq("agencia_id", agId)
      .in("etapa_jornada", ["Compareceu", "Fechou", "Comprou"])
      .gte("etapa_alterada_at", `${mesStr}-01`)
      .lt("etapa_alterada_at", nextMes)
      .neq("contato_nome", "Caroline Carneiro")
      .neq("contato_nome", "Salx Digital Suporte")
      .neq("contato_nome", "Nicolas Kich")
      .neq("contato_nome", "Nico")
      .neq("contato_nome", "Jacqueline Soares Beauty")
      .neq("contato_nome", "Lala")
      .order("etapa_alterada_at", { ascending: false });
    setLeads((data || []).map(c => ({
      id: c.id, nome: c.contato_nome || c.contato_numero,
      numero: c.contato_numero, etapa: c.etapa_jornada,
      origem: c.origem || "—", data: c.etapa_alterada_at?.split("T")[0] || "",
    })));

    // Mês anterior para deltas
    const prevMesNum = mes === 1 ? 12 : mes - 1;
    const prevAnoNum = mes === 1 ? ano - 1 : ano;
    const prevMesStr2 = `${prevAnoNum}-${String(prevMesNum).padStart(2, "0")}`;
    const { data: prevData } = await supabase.from("conversas")
      .select("etapa_jornada")
      .eq("agencia_id", agId)
      .in("etapa_jornada", ["Compareceu", "Fechou", "Comprou"])
      .gte("etapa_alterada_at", `${prevMesStr2}-01`)
      .lt("etapa_alterada_at", `${mesStr}-01`)
      .neq("contato_nome", "Caroline Carneiro")
      .neq("contato_nome", "Salx Digital Suporte")
      .neq("contato_nome", "Nicolas Kich")
      .neq("contato_nome", "Nico")
      .neq("contato_nome", "Jacqueline Soares Beauty")
      .neq("contato_nome", "Lala");
    const prevTotal = (prevData || []).length;
    const prevCompareceu = (prevData || []).filter(c => c.etapa_jornada === "Compareceu").length;
    const prevFechou = (prevData || []).filter(c => c.etapa_jornada === "Fechou" || c.etapa_jornada === "Comprou").length;
    setListaPrevCounts({ total: prevTotal, compareceu: prevCompareceu, fechou: prevFechou });

    setLoadingLista(false);
  }, [mes, ano, mesStr]);

  // ── Carregar dash ──
  const carregarDash = useCallback(async () => {
    setLoadingDash(true);
    const agId = await getAgenciaId();
    if (!agId) return;
    const { data: cfg } = await supabase.from("dash_vendas_mes")
      .select("*").eq("agencia_id", agId).eq("mes", mesStr).single();
    const cfgFinal: Config = cfg ? {
      investimento: cfg.investimento || 0, receita_gerada: cfg.receita_gerada || 0,
      caixa_coletado: cfg.caixa_coletado || 0, mrr: cfg.mrr || 0,
      meta_leads: cfg.meta_leads || 0, meta_mql: cfg.meta_mql || 0,
      meta_agendamentos: cfg.meta_agendamentos || 0, meta_reunioes: cfg.meta_reunioes || 0,
      meta_vendas: cfg.meta_vendas || 0,
    } : CONFIG_ZERO;
    setConfig(cfgFinal);
    setEditConfig(cfgFinal);

    // IDs de conversas da equipe interna que não devem contar
    const { data: equipeConversas } = await supabase.from("conversas")
      .select("id").eq("agencia_id", agId)
      .in("contato_nome", ["Caroline Carneiro", "Salx Digital Suporte", "Nicolas Kich", "Nico", "Jacqueline Soares Beauty", "Lala"]);
    const equipeIds = (equipeConversas || []).map(c => c.id);

    // Buscar leads do período com origem e etapa
    const { data: leadsRaw } = await supabase.from("conversas")
      .select("id, origem, etapa_jornada")
      .eq("agencia_id", agId).gte("primeira_mensagem_at", inicio).lt("primeira_mensagem_at", fim)
      .not("id", "in", equipeIds.length ? `(${equipeIds.map(id => `"${id}"`).join(",")})` : '("00000000-0000-0000-0000-000000000000")');

    // Buscar etapas_historico de todos os leads do período para saber quais progrediram
    const todosIds = (leadsRaw || []).map(l => l.id);
    let progressedIds = new Set<string>();
    if (todosIds.length > 0) {
      const { data: agendHistAll } = await supabase.from("etapas_historico")
        .select("conversa_id, etapa_nova")
        .in("conversa_id", todosIds);
      for (const h of agendHistAll || []) {
        const e = (h.etapa_nova || "").toLowerCase();
        if (e.includes("agend") || e.includes("comparec") || e.includes("fechou") || e.includes("comprou") || e.includes("reuni")) {
          progressedIds.add(h.conversa_id);
        }
      }
      // Também considerar etapa_jornada atual
      for (const l of leadsRaw || []) {
        const e = (l.etapa_jornada || "").toLowerCase();
        if (e.includes("agend") || e.includes("comparec") || e.includes("fechou") || e.includes("comprou") || e.includes("reuni")) {
          progressedIds.add(l.id);
        }
      }
    }

    // Filtrar: excluir não rastreadas sem progressão (evita conversas aleatórias inflarem o funil)
    const leadsComOrigem = (leadsRaw || []).filter(l => {
      const semOrigem = !l.origem || l.origem === "" || l.origem === "Não Rastreada";
      if (semOrigem && !progressedIds.has(l.id)) return false;
      return true;
    });

    const leadsCount = leadsComOrigem.length;

    const porOrigemDash: Record<string, number> = {};
    const leadIdToOrigem: Record<string, string> = {};
    for (const l of leadsComOrigem) {
      const o = l.origem === "Instagram" ? "Social Selling" : (l.origem || "Não Rastreada");
      porOrigemDash[o] = (porOrigemDash[o] || 0) + 1;
      leadIdToOrigem[l.id] = o;
    }

    // Contar agendamentos por origem
    const porOrigemAgend: Record<string, number> = {};
    for (const id of progressedIds) {
      if (leadIdToOrigem[id]) {
        const o = leadIdToOrigem[id];
        porOrigemAgend[o] = (porOrigemAgend[o] || 0) + 1;
      }
    }

    const totalLeads = leadsCount || 1;
    setOrigensLeads(
      Object.entries(porOrigemDash)
        .sort((a, b) => b[1] - a[1])
        .map(([origem, count]) => ({
          origem,
          count,
          pct: Math.round((count / totalLeads) * 100),
          agendamentos: porOrigemAgend[origem] || 0,
          taxaAgend: count > 0 ? Math.round(((porOrigemAgend[origem] || 0) / count) * 100) : 0,
        }))
    );

    const { data: historicoRaw } = await supabase.from("etapas_historico")
      .select("conversa_id, etapa_nova")
      .eq("agencia_id", agId).gte("created_at", inicio).lt("created_at", fim);
    const historico = (historicoRaw || []).filter(h => !equipeIds.includes(h.conversa_id));

    const uniqueBy = (fn: (h: any) => boolean) =>
      new Set((historico || []).filter(fn).map(h => h.conversa_id)).size;

    // Buscar clientes criados no mês para ticket médio, MRR, receita e caixa
    // Vendas: mesma lógica da lista (etapa_jornada atual, etapa_alterada_at no mês)
    const nextMesDash = mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, "0")}-01`;
    const { data: vendasConversas } = await supabase.from("conversas")
      .select("id")
      .eq("agencia_id", agId)
      .in("etapa_jornada", ["Fechou", "Comprou"])
      .gte("etapa_alterada_at", `${mesStr}-01`)
      .lt("etapa_alterada_at", nextMesDash)
      .not("id", "in", equipeIds.length ? `(${equipeIds.map(id => `"${id}"`).join(",")})` : '("00000000-0000-0000-0000-000000000000")');
    const vendasCount = (vendasConversas || []).length;

    const { data: clientesMes } = await supabase.from("clientes")
      .select("id, valor_oportunidade")
      .eq("agencia_id", agId)
      .gte("created_at", inicio)
      .lt("created_at", fim);

    const valores = (clientesMes || []).map(c => Number(c.valor_oportunidade) || 0).filter(v => v > 0);
    const somaValores = valores.reduce((a, b) => a + b, 0);
    const ticketMedio = valores.length > 0 ? somaValores / valores.length : 0;
    const mrrCalculado = somaValores * 3;

    // Receita gerada = primeiro vencimento de cada cliente novo (upfront 3 meses)
    // Caixa coletado = movimentações de entrada já registradas para esses clientes
    let receitaGerada = 0;
    let caixaColetado = 0;
    const clienteIds = (clientesMes || []).map(c => c.id);
    if (clienteIds.length > 0) {
      const { data: todosLanc } = await supabase.from("lancamentos_futuros")
        .select("cliente_id, valor, pago, data_vencimento")
        .in("cliente_id", clienteIds)
        .neq("despesa", true)
        .order("data_vencimento", { ascending: true });

      // Por cliente: achar a data do primeiro vencimento e somar lançamentos dessa data
      const primeiroPorCliente: Record<string, string> = {};
      for (const l of todosLanc || []) {
        if (!primeiroPorCliente[l.cliente_id]) primeiroPorCliente[l.cliente_id] = l.data_vencimento;
      }
      for (const l of todosLanc || []) {
        if (l.data_vencimento === primeiroPorCliente[l.cliente_id]) {
          receitaGerada += Number(l.valor) || 0;
        }
      }

      // Caixa coletado = movimentações de entrada vinculadas aos clientes novos
      const { data: movs } = await supabase.from("movimentacoes")
        .select("valor")
        .in("cliente_id", clienteIds)
        .eq("tipo", "entrada")
        .neq("despesa", true);

      for (const m of movs || []) {
        caixaColetado += Number(m.valor) || 0;
      }
    }

    // Reuniões: mesma lógica da lista (etapa atual, etapa_alterada_at no mês)
    // garante que dashboard e lista mostrem exatamente o mesmo número
    const { data: reunioesConversas } = await supabase.from("conversas")
      .select("id")
      .eq("agencia_id", agId)
      .in("etapa_jornada", ["Compareceu", "Fechou", "Comprou"])
      .gte("etapa_alterada_at", `${mesStr}-01`)
      .lt("etapa_alterada_at", nextMesDash)
      .not("id", "in", equipeIds.length ? `(${equipeIds.map(id => `"${id}"`).join(",")})` : '("00000000-0000-0000-0000-000000000000")');
    const reunioesCount = (reunioesConversas || []).length;

    setDados({
      leads: leadsCount || 0,
      mql: uniqueBy(h => { const e = h.etapa_nova?.toLowerCase() || ""; return e.includes("qualif") || e.includes("mql"); }),
      agendamentos: uniqueBy(h => { const e = h.etapa_nova?.toLowerCase() || ""; return e.includes("agend") || e.includes("comparec") || e.includes("fechou") || e.includes("comprou"); }),
      reunioes: reunioesCount,
      vendas: vendasCount,
      ticketMedio,
      mrrCalculado,
      clientesMes: valores.length,
      receitaGerada,
      caixaColetado,
    });

    // ── Mês anterior para deltas ──
    const prevMesNum = mes === 1 ? 12 : mes - 1;
    const prevAnoNum = mes === 1 ? ano - 1 : ano;
    const prevMesStr = `${prevAnoNum}-${String(prevMesNum).padStart(2, "0")}`;
    const prevInicio = `${prevMesStr}-01T00:00:00`;
    const prevFimStr = inicio; // = início do mês atual

    const { count: prevLeadsCount } = await supabase.from("conversas")
      .select("id", { count: "exact", head: true })
      .eq("agencia_id", agId)
      .gte("primeira_mensagem_at", prevInicio)
      .lt("primeira_mensagem_at", prevFimStr)
      .not("id", "in", equipeIds.length ? `(${equipeIds.map(id => `"${id}"`).join(",")})` : '("00000000-0000-0000-0000-000000000000")');

    const { data: prevHistoricoRaw } = await supabase.from("etapas_historico")
      .select("conversa_id, etapa_nova")
      .eq("agencia_id", agId)
      .gte("created_at", prevInicio)
      .lt("created_at", prevFimStr);
    const prevHistorico = (prevHistoricoRaw || []).filter(h => !equipeIds.includes(h.conversa_id));
    const prevUniqueBy = (fn: (h: any) => boolean) =>
      new Set(prevHistorico.filter(fn).map((h: any) => h.conversa_id)).size;

    const { data: prevReunioes } = await supabase.from("conversas")
      .select("id")
      .eq("agencia_id", agId)
      .in("etapa_jornada", ["Compareceu", "Fechou", "Comprou"])
      .gte("etapa_alterada_at", `${prevMesStr}-01`)
      .lt("etapa_alterada_at", `${mesStr}-01`)
      .not("id", "in", equipeIds.length ? `(${equipeIds.map(id => `"${id}"`).join(",")})` : '("00000000-0000-0000-0000-000000000000")');

    const { data: prevVendasData } = await supabase.from("conversas")
      .select("id")
      .eq("agencia_id", agId)
      .in("etapa_jornada", ["Fechou", "Comprou"])
      .gte("etapa_alterada_at", `${prevMesStr}-01`)
      .lt("etapa_alterada_at", `${mesStr}-01`)
      .not("id", "in", equipeIds.length ? `(${equipeIds.map(id => `"${id}"`).join(",")})` : '("00000000-0000-0000-0000-000000000000")');

    let prevReceitaGerada = 0;
    let prevCaixaColetado = 0;
    const { data: prevClientesMes } = await supabase.from("clientes")
      .select("id")
      .eq("agencia_id", agId)
      .gte("created_at", prevInicio)
      .lt("created_at", prevFimStr);
    const prevClienteIds = (prevClientesMes || []).map(c => c.id);
    if (prevClienteIds.length > 0) {
      const { data: prevLanc } = await supabase.from("lancamentos_futuros")
        .select("cliente_id, valor, data_vencimento")
        .in("cliente_id", prevClienteIds)
        .neq("despesa", true)
        .order("data_vencimento", { ascending: true });
      const primeiroPrev: Record<string, string> = {};
      for (const l of prevLanc || []) {
        if (!primeiroPrev[l.cliente_id]) primeiroPrev[l.cliente_id] = l.data_vencimento;
      }
      for (const l of prevLanc || []) {
        if (l.data_vencimento === primeiroPrev[l.cliente_id]) prevReceitaGerada += Number(l.valor) || 0;
      }
      const { data: prevMovs } = await supabase.from("movimentacoes")
        .select("valor")
        .in("cliente_id", prevClienteIds)
        .eq("tipo", "entrada")
        .neq("despesa", true);
      for (const m of prevMovs || []) prevCaixaColetado += Number(m.valor) || 0;
    }

    setDadosPrev({
      leads: prevLeadsCount || 0,
      mql: prevUniqueBy((h: any) => { const e = h.etapa_nova?.toLowerCase() || ""; return e.includes("qualif") || e.includes("mql"); }),
      agendamentos: prevUniqueBy((h: any) => { const e = h.etapa_nova?.toLowerCase() || ""; return e.includes("agend") || e.includes("comparec") || e.includes("fechou") || e.includes("comprou"); }),
      reunioes: (prevReunioes || []).length,
      vendas: (prevVendasData || []).length,
      receitaGerada: prevReceitaGerada,
      caixaColetado: prevCaixaColetado,
    });

    setLoadingDash(false);
  }, [mesStr, inicio, fim, mes, ano]);

  useEffect(() => { carregarLista(); }, [carregarLista]);
  useEffect(() => { if (view === "dash") carregarDash(); }, [view, carregarDash]);

  const salvar = async (cfg: Config) => {
    setSalvando(true);
    const agId = await getAgenciaId();
    if (!agId) return;
    await supabase.from("dash_vendas_mes").upsert(
      { agencia_id: agId, mes: mesStr, ...cfg, updated_at: new Date().toISOString() },
      { onConflict: "agencia_id,mes" }
    );
    setConfig(cfg);
    setSalvando(false);
    setEditando(false);
    setEditandoMetas(false);
  };

  const kpis = useMemo(() => {
    const inv = config.investimento;
    const { leads: l, mql: m, agendamentos: a, reunioes: r, vendas: v } = dados;
    return {
      cpl: inv && l ? inv / l : 0,
      cpmql: inv && m ? inv / m : 0,
      taxaMql: l ? (m / l) * 100 : 0,
      custoAgend: inv && a ? inv / a : 0,
      taxaAgendLeads: l ? (a / l) * 100 : 0,
      taxaAgendMql: m ? (a / m) * 100 : 0,
      custoRR: inv && r ? inv / r : 0,
      taxaRR: a ? (r / a) * 100 : 0,
      cac: inv && v ? inv / v : 0,
      convRR: r ? (v / r) * 100 : 0,
      convLeads: l ? (v / l) * 100 : 0,
      roas: inv && dados.receitaGerada ? dados.receitaGerada / inv : 0,
      pctCaixa: dados.receitaGerada ? (dados.caixaColetado / dados.receitaGerada) * 100 : 0,
    };
  }, [config, dados]);

  // KPI cards lista + breakdown por origem
  const kpisLista = useMemo(() => {
    const compareceu = leads.filter(l => l.etapa === "Compareceu").length;
    const fechou = leads.filter(l => l.etapa === "Fechou" || l.etapa === "Comprou").length;
    const total = leads.length;
    const porOrigem: Record<string, { total: number; fechou: number }> = {};
    for (const l of leads) {
      const rawOrigem = l.origem === "Instagram" ? "Social Selling" : l.origem;
      const o = rawOrigem && rawOrigem !== "—" ? rawOrigem : "Não Rastreada";
      if (!porOrigem[o]) porOrigem[o] = { total: 0, fechou: 0 };
      porOrigem[o].total += 1;
      if (l.etapa === "Fechou" || l.etapa === "Comprou") porOrigem[o].fechou += 1;
    }
    const origensOrdenadas = Object.entries(porOrigem)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([origem, d]) => ({ origem, total: d.total, fechou: d.fechou, taxa: Math.round((d.fechou / d.total) * 100) }));
    return { compareceu, fechou, total, taxa: total > 0 ? Math.round((fechou / total) * 100) : 0, origensOrdenadas };
  }, [leads]);

  const prevMonth = () => { if (mes === 1) { setMes(12); setAno(ano - 1); } else setMes(mes - 1); };
  const nextMonth = () => { if (mes === 12) { setMes(1); setAno(ano + 1); } else setMes(mes + 1); };

  const maxFunil = Math.max(dados.leads, 1);
  const funnelItems = [
    { label: "LEADS", val: dados.leads, cor: "#4a7c59", pctConv: null },
    { label: "MQL", val: dados.mql, cor: "#3d6b4a", pctConv: dados.leads ? Math.round((dados.mql / dados.leads) * 100) : 0 },
    { label: "AGENDAMENTOS", val: dados.agendamentos, cor: "#2e5c3b", pctConv: dados.mql ? Math.round((dados.agendamentos / dados.mql) * 100) : 0 },
    { label: "REUNIÕES", val: dados.reunioes, cor: "#1f4d2c", pctConv: dados.agendamentos ? Math.round((dados.reunioes / dados.agendamentos) * 100) : 0 },
    { label: "VENDAS", val: dados.vendas, cor: "#103e1d", pctConv: dados.reunioes ? Math.round((dados.vendas / dados.reunioes) * 100) : 0 },
  ];

  return (
    <div className="animate-in" style={{ width: "100%" }}>
      <div className="breadcrumb">
        <a href="/">Início</a><span>›</span>
        <span style={{ color: "#a0a0a0" }}>SDR</span><span>›</span>
        <span className="current">Reuniões de Vendas</span>
      </div>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <h1 style={{ fontSize: "22px", fontWeight: "600", margin: 0 }}>
            {view === "lista" ? "Reuniões de Vendas" : "Dashboard de Vendas"}
          </h1>
          {/* Toggle */}
          <div style={{ display: "flex", background: "#1e1e1e", border: "1px solid #2e2e2e", borderRadius: "8px", padding: "3px", gap: "2px" }}>
            <button onClick={() => setView("lista")} style={{
              display: "flex", alignItems: "center", gap: "5px", padding: "5px 12px", borderRadius: "6px", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: "600",
              background: view === "lista" ? "#2e2e2e" : "transparent", color: view === "lista" ? "#f0f0f0" : "#606060", transition: "all 0.15s",
            }}>
              <List size={13} /> Lista
            </button>
            <button onClick={() => setView("dash")} style={{
              display: "flex", alignItems: "center", gap: "5px", padding: "5px 12px", borderRadius: "6px", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: "600",
              background: view === "dash" ? "#2e2e2e" : "transparent", color: view === "dash" ? "#f0f0f0" : "#606060", transition: "all 0.15s",
            }}>
              <LayoutDashboard size={13} /> Dashboard
            </button>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button onClick={prevMonth} className="btn-ghost" style={{ padding: "6px", cursor: "pointer" }}><ChevronLeft size={16} /></button>
          <span style={{ fontSize: "14px", fontWeight: "600", color: "#f0f0f0", minWidth: "140px", textAlign: "center" }}>{MESES[mes - 1]} {ano}</span>
          <button onClick={nextMonth} className="btn-ghost" style={{ padding: "6px", cursor: "pointer" }}><ChevronRight size={16} /></button>
        </div>
      </div>

      {/* ══════════════════════ LISTA VIEW ══════════════════════ */}
      {view === "lista" && (<>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px", marginBottom: "24px" }}>
          <div className="card" style={{ padding: "16px 20px" }}>
            <p style={{ fontSize: "12px", color: "#a0a0a0", margin: "0 0 8px" }}>Total reuniões</p>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "0" }}>
              <p style={{ fontSize: "28px", fontWeight: "700", color: "#29ABE2", margin: 0 }}>{kpisLista.total}</p>
              <Delta curr={kpisLista.total} prev={listaPrevCounts.total} />
            </div>
          </div>
          <div className="card" style={{ padding: "16px 20px" }}>
            <p style={{ fontSize: "12px", color: "#a0a0a0", margin: "0 0 8px" }}>Compareceu</p>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
              <p style={{ fontSize: "28px", fontWeight: "700", color: "#f59e0b", margin: 0 }}>{kpisLista.compareceu}</p>
              <Delta curr={kpisLista.compareceu} prev={listaPrevCounts.compareceu} />
            </div>
            <p style={{ fontSize: "11px", color: "#606060", margin: "4px 0 0" }}>Não fechou ainda</p>
          </div>
          <div className="card" style={{ padding: "16px 20px" }}>
            <p style={{ fontSize: "12px", color: "#a0a0a0", margin: "0 0 8px" }}>Fechou</p>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
              <p style={{ fontSize: "28px", fontWeight: "700", color: "#22c55e", margin: 0 }}>{kpisLista.fechou}</p>
              <Delta curr={kpisLista.fechou} prev={listaPrevCounts.fechou} />
            </div>
          </div>
          <div className="card" style={{ padding: "16px 20px" }}>
            <p style={{ fontSize: "12px", color: "#a0a0a0", margin: "0 0 8px" }}>Taxa de fechamento</p>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
              <p style={{ fontSize: "28px", fontWeight: "700", color: kpisLista.taxa >= 50 ? "#22c55e" : "#f59e0b", margin: 0 }}>{kpisLista.taxa}%</p>
              {listaPrevCounts.total > 0 && (() => {
                const prevTaxa = listaPrevCounts.total > 0 ? Math.round((listaPrevCounts.fechou / listaPrevCounts.total) * 100) : 0;
                return <Delta curr={kpisLista.taxa} prev={prevTaxa} />;
              })()}
            </div>
            <p style={{ fontSize: "11px", color: "#606060", margin: "4px 0 0" }}>{kpisLista.fechou} de {kpisLista.total}</p>
          </div>
        </div>

        {/* Cards por origem */}
        {kpisLista.origensOrdenadas.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(kpisLista.origensOrdenadas.length, 4)}, 1fr)`, gap: "12px", marginBottom: "24px" }}>
            {kpisLista.origensOrdenadas.map(({ origem, total, fechou: f, taxa }) => (
              <div key={origem} className="card" style={{ padding: "16px 20px" }}>
                <div style={{ marginBottom: "10px" }}><OrigemIcon origem={origem} /></div>
                <p style={{ fontSize: "26px", fontWeight: "700", color: "#f0f0f0", margin: 0 }}>{total}</p>
                <p style={{ fontSize: "11px", color: "#606060", margin: "2px 0 10px" }}>reuniões</p>
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "10px", display: "flex", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ fontSize: "16px", fontWeight: "700", color: "#22c55e", margin: 0 }}>{f}</p>
                    <p style={{ fontSize: "10px", color: "#606060", margin: "2px 0 0" }}>fecharam</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: "16px", fontWeight: "700", color: taxa >= 50 ? "#22c55e" : "#f59e0b", margin: 0 }}>{taxa}%</p>
                    <p style={{ fontSize: "10px", color: "#606060", margin: "2px 0 0" }}>conversão</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>NOME</th><th>ORIGEM</th><th>STATUS</th><th>DATA</th></tr>
            </thead>
            <tbody>
              {loadingLista ? (
                <tr><td colSpan={4} style={{ textAlign:"center", color:"#606060", padding:"40px" }}>Carregando...</td></tr>
              ) : leads.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign:"center", color:"#606060", padding:"48px" }}>Nenhuma reunião neste mês.</td></tr>
              ) : leads.map(l => (
                <tr key={l.id}>
                  <td style={{ fontWeight:"500" }}>{l.nome}</td>
                  <td><OrigemIcon origem={l.origem} /></td>
                  <td>
                    <span style={{
                      fontSize:"11px", padding:"3px 10px", borderRadius:"12px", fontWeight:"600",
                      background: l.etapa==="Fechou"||l.etapa==="Comprou" ? "rgba(34,197,94,0.12)" : "rgba(245,158,11,0.12)",
                      color: l.etapa==="Fechou"||l.etapa==="Comprou" ? "#22c55e" : "#f59e0b",
                    }}>
                      {l.etapa==="Fechou"||l.etapa==="Comprou" ? "Fechou" : "Compareceu"}
                    </span>
                  </td>
                  <td style={{ color:"#a0a0a0", fontSize:"12px" }}>
                    {l.data ? new Date(l.data + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>)}

      {/* ══════════════════════ DASH VIEW ══════════════════════ */}
      {view === "dash" && (loadingDash ? (
        <div style={{ textAlign:"center", padding:"80px", color:"#606060" }}>Carregando...</div>
      ) : (<>
        <p style={{ fontSize: "12px", color: "#505050", margin: "0 0 20px", fontStyle: "italic" }}>
          Cada etapa conta no dia em que aconteceu — um lead de mês anterior que agendou agora soma no agendamento deste período.
        </p>

        {/* ── 6 KPI Cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: "10px", marginBottom: "20px" }}>

          {/* INVESTIMENTO */}
          <div className="card" style={{ padding: "14px 16px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"4px" }}>
              <span style={{ fontSize:"9px", fontWeight:"700", color:"#606060", letterSpacing:"0.07em" }}>INVESTIMENTO</span>
              <button onClick={() => { setEditConfig(config); setEditando(true); }} style={{ background:"none", border:"none", color:"#505050", cursor:"pointer", padding:"0" }}><Edit2 size={11}/></button>
            </div>
            <p style={{ fontSize:"18px", fontWeight:"700", color:"#f0f0f0", margin:"4px 0 8px", wordBreak:"break-all" }}>{fmt(config.investimento)}</p>
            <div style={{ borderTop:"1px solid #2a2a2a", paddingTop:"7px" }}>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:"10px", color:"#606060" }}>CPL</span>
                <span style={{ fontSize:"10px", fontWeight:"600", color:"#a0a0a0" }}>{kpis.cpl > 0 ? fmt(kpis.cpl) : "—"}</span>
              </div>
            </div>
          </div>

          {/* LEADS */}
          <div className="card" style={{ padding:"14px 16px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"4px" }}>
              <span style={{ fontSize:"9px", fontWeight:"700", color:"#606060", letterSpacing:"0.07em" }}>LEADS</span>
              <Users size={12} style={{ color:"#505050" }}/>
            </div>
            <div style={{ display:"flex", alignItems:"baseline", gap:"8px", margin:"4px 0 8px" }}>
              <p style={{ fontSize:"30px", fontWeight:"700", color:"#f0f0f0", margin:0 }}>{dados.leads}</p>
              <Delta curr={dados.leads} prev={dadosPrev.leads} />
            </div>
            <div style={{ borderTop:"1px solid #2a2a2a", paddingTop:"7px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom: origensLeads.length > 0 ? "8px" : "0" }}>
                <span style={{ fontSize:"10px", color:"#606060" }}>CPL</span>
                <span style={{ fontSize:"10px", fontWeight:"600", color:"#a0a0a0" }}>{kpis.cpl > 0 ? fmt(kpis.cpl) : "—"}</span>
              </div>
              {origensLeads.map(({ origem, count, pct, agendamentos, taxaAgend }) => (
                <div key={origem} style={{ marginBottom:"6px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontSize:"10px", color:"#808080", maxWidth:"65%", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{origem}</span>
                    <span style={{ fontSize:"10px", fontWeight:"600", color:"#a0a0a0" }}>{count} <span style={{ color:"#505050", fontWeight:"400" }}>({pct}%)</span></span>
                  </div>
                  <div style={{ display:"flex", justifyContent:"flex-end", alignItems:"center", gap:"4px" }}>
                    <span style={{ fontSize:"9px", color:"#505050" }}>{agendamentos} agend.</span>
                    <span style={{ fontSize:"9px", fontWeight:"700", color: taxaAgend >= 30 ? "#22c55e" : taxaAgend >= 15 ? "#f59e0b" : "#ef4444" }}>
                      {taxaAgend}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* MQL */}
          <div className="card" style={{ padding:"14px 16px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"4px" }}>
              <span style={{ fontSize:"9px", fontWeight:"700", color:"#606060", letterSpacing:"0.07em" }}>MQL</span>
              <Target size={12} style={{ color:"#505050" }}/>
            </div>
            <div style={{ display:"flex", alignItems:"baseline", gap:"8px", margin:"4px 0 8px" }}>
              <p style={{ fontSize:"30px", fontWeight:"700", color:"#f0f0f0", margin:0 }}>{dados.mql}</p>
              <Delta curr={dados.mql} prev={dadosPrev.mql} />
            </div>
            <div style={{ borderTop:"1px solid #2a2a2a", paddingTop:"7px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"2px" }}>
                <span style={{ fontSize:"10px", color:"#606060" }}>CPMQL</span>
                <span style={{ fontSize:"10px", fontWeight:"600", color:"#a0a0a0" }}>{kpis.cpmql > 0 ? fmt(kpis.cpmql) : "—"}</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:"10px", color:"#606060" }}>Taxa de MQL</span>
                <span style={{ fontSize:"10px", fontWeight:"600", color:"#a0a0a0" }}>{pct(kpis.taxaMql)}</span>
              </div>
            </div>
          </div>

          {/* AGENDAMENTOS */}
          <div className="card" style={{ padding:"14px 16px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"4px" }}>
              <span style={{ fontSize:"9px", fontWeight:"700", color:"#606060", letterSpacing:"0.07em" }}>AGENDAMENTOS</span>
              <Calendar size={12} style={{ color:"#505050" }}/>
            </div>
            <div style={{ display:"flex", alignItems:"baseline", gap:"8px", margin:"4px 0 8px" }}>
              <p style={{ fontSize:"30px", fontWeight:"700", color:"#f0f0f0", margin:0 }}>{dados.agendamentos}</p>
              <Delta curr={dados.agendamentos} prev={dadosPrev.agendamentos} />
            </div>
            <div style={{ borderTop:"1px solid #2a2a2a", paddingTop:"7px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"2px" }}>
                <span style={{ fontSize:"10px", color:"#606060" }}>Custo/agend.</span>
                <span style={{ fontSize:"10px", fontWeight:"600", color:"#a0a0a0" }}>{kpis.custoAgend > 0 ? fmt(kpis.custoAgend) : "—"}</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"2px" }}>
                <span style={{ fontSize:"10px", color:"#606060" }}>Taxa × leads</span>
                <span style={{ fontSize:"10px", fontWeight:"600", color:"#a0a0a0" }}>{pct(kpis.taxaAgendLeads)}</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:"10px", color:"#606060" }}>Taxa × MQL</span>
                <span style={{ fontSize:"10px", fontWeight:"600", color:"#a0a0a0" }}>{pct(kpis.taxaAgendMql)}</span>
              </div>
            </div>
          </div>

          {/* REUNIÕES */}
          <div className="card" style={{ padding:"14px 16px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"4px" }}>
              <span style={{ fontSize:"9px", fontWeight:"700", color:"#606060", letterSpacing:"0.07em" }}>REUNIÕES REALIZADAS</span>
              <Video size={12} style={{ color:"#505050" }}/>
            </div>
            <div style={{ display:"flex", alignItems:"baseline", gap:"8px", margin:"4px 0 8px" }}>
              <p style={{ fontSize:"30px", fontWeight:"700", color:"#f0f0f0", margin:0 }}>{dados.reunioes}</p>
              <Delta curr={dados.reunioes} prev={dadosPrev.reunioes} />
            </div>
            <div style={{ borderTop:"1px solid #2a2a2a", paddingTop:"7px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"2px" }}>
                <span style={{ fontSize:"10px", color:"#606060" }}>Custo/RR</span>
                <span style={{ fontSize:"10px", fontWeight:"600", color:"#a0a0a0" }}>{kpis.custoRR > 0 ? fmt(kpis.custoRR) : "—"}</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:"10px", color:"#606060" }}>Taxa de RR</span>
                <span style={{ fontSize:"10px", fontWeight:"600", color:"#a0a0a0" }}>{pct(kpis.taxaRR)}</span>
              </div>
            </div>
          </div>

          {/* VENDAS */}
          <div className="card" style={{ padding:"14px 16px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"4px" }}>
              <span style={{ fontSize:"9px", fontWeight:"700", color:"#606060", letterSpacing:"0.07em" }}>VENDAS</span>
              <TrendingUp size={12} style={{ color:"#22c55e" }}/>
            </div>
            <div style={{ display:"flex", alignItems:"baseline", gap:"8px", margin:"4px 0 8px" }}>
              <p style={{ fontSize:"30px", fontWeight:"700", color:"#22c55e", margin:0 }}>{dados.vendas}</p>
              <Delta curr={dados.vendas} prev={dadosPrev.vendas} />
            </div>
            <div style={{ borderTop:"1px solid #2a2a2a", paddingTop:"7px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"2px" }}>
                <span style={{ fontSize:"10px", color:"#606060" }}>CAC</span>
                <span style={{ fontSize:"10px", fontWeight:"600", color:"#a0a0a0" }}>{kpis.cac > 0 ? fmt(kpis.cac) : "—"}</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"2px" }}>
                <span style={{ fontSize:"10px", color:"#606060" }}>Conv. sobre RR</span>
                <span style={{ fontSize:"10px", fontWeight:"600", color:"#a0a0a0" }}>{pct(kpis.convRR)}</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:"10px", color:"#606060" }}>Conv. sobre leads</span>
                <span style={{ fontSize:"10px", fontWeight:"600", color:"#a0a0a0" }}>{pct(kpis.convLeads)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Aviso: vendas sem cliente cadastrado ── */}
        {dados.vendas > 0 && dados.clientesMes < dados.vendas && (
          <div style={{ background:"rgba(245,158,11,0.1)", border:"1px solid rgba(245,158,11,0.3)", borderRadius:"8px", padding:"10px 14px", marginBottom:"12px", display:"flex", alignItems:"center", gap:"8px" }}>
            <span style={{ fontSize:"16px" }}>⚠️</span>
            <span style={{ fontSize:"12px", color:"#f59e0b" }}>
              <strong>{dados.vendas - dados.clientesMes} venda{dados.vendas - dados.clientesMes > 1 ? "s" : ""}</strong> sem cliente cadastrado com data de entrada em {MESES[mes-1]} — receita gerada pode estar incompleta. Corrija a data de entrada dos clientes.
            </span>
          </div>
        )}

        {/* ── Resultado Financeiro ── */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"8px" }}>
          <span style={{ fontSize:"12px", fontWeight:"700", color:"#505050", letterSpacing:"0.07em" }}>RESULTADO FINANCEIRO</span>
          <button onClick={() => { setEditConfig(config); setEditando(true); }} style={{ display:"flex", alignItems:"center", gap:"4px", background:"none", border:"1px solid #2e2e2e", borderRadius:"6px", padding:"4px 10px", color:"#606060", cursor:"pointer", fontSize:"12px" }}>
            <Edit2 size={11}/> Editar valores
          </button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:"10px", marginBottom:"20px" }}>
          <div className="card" style={{ padding:"16px 18px" }}>
            <span style={{ fontSize:"9px", fontWeight:"700", color:"#606060", letterSpacing:"0.07em" }}>RECEITA GERADA</span>
            <div style={{ display:"flex", alignItems:"baseline", gap:"8px", margin:"6px 0 4px" }}>
              <p style={{ fontSize:"20px", fontWeight:"700", color:"#a855f7", margin:0, wordBreak:"break-all" }}>{dados.receitaGerada > 0 ? fmt(dados.receitaGerada) : "—"}</p>
              {dados.receitaGerada > 0 && <Delta curr={dados.receitaGerada} prev={dadosPrev.receitaGerada} />}
            </div>
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              <span style={{ fontSize:"11px", color:"#606060" }}>contratos novos</span>
              <span style={{ fontSize:"11px", color:"#a0a0a0" }}>{dados.clientesMes}</span>
            </div>
          </div>
          <div className="card" style={{ padding:"16px 18px" }}>
            <span style={{ fontSize:"9px", fontWeight:"700", color:"#606060", letterSpacing:"0.07em" }}>CAIXA COLETADO</span>
            <div style={{ display:"flex", alignItems:"baseline", gap:"8px", margin:"6px 0 4px" }}>
              <p style={{ fontSize:"20px", fontWeight:"700", color:"#29ABE2", margin:0, wordBreak:"break-all" }}>{dados.caixaColetado > 0 ? fmt(dados.caixaColetado) : dados.receitaGerada > 0 ? "R$ 0,00" : "—"}</p>
              {dados.caixaColetado > 0 && <Delta curr={dados.caixaColetado} prev={dadosPrev.caixaColetado} />}
            </div>
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              <span style={{ fontSize:"11px", color:"#606060" }}>% da receita</span>
              <span style={{ fontSize:"11px", color:"#a0a0a0" }}>{dados.receitaGerada > 0 ? pct(kpis.pctCaixa) : "—"}</span>
            </div>
          </div>
          {[
            { label:"ROAS", val: kpis.roas > 0 ? fmtX(kpis.roas) : "—", cor:"#29ABE2", sub:"investimento", sub2:fmt(config.investimento) },
            { label:"TICKET MÉDIO", val: dados.ticketMedio > 0 ? fmt(dados.ticketMedio) : "—", cor:"#f0f0f0", sub: dados.clientesMes > 0 ? `${dados.clientesMes} contratos` : null, sub2: null },
            { label:"MRR (×3)", val: dados.mrrCalculado > 0 ? fmt(dados.mrrCalculado) : "—", cor:"#f59e0b", sub: dados.mrrCalculado > 0 ? `base mensal` : null, sub2: dados.mrrCalculado > 0 ? fmt(dados.mrrCalculado / 3) : null },
          ].map(k => (
            <div key={k.label} className="card" style={{ padding:"16px 18px" }}>
              <span style={{ fontSize:"9px", fontWeight:"700", color:"#606060", letterSpacing:"0.07em" }}>{k.label}</span>
              <p style={{ fontSize:"20px", fontWeight:"700", color:k.cor, margin:"6px 0 4px", wordBreak:"break-all" }}>{k.val}</p>
              {k.sub && <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:"11px", color:"#606060" }}>{k.sub}</span>
                <span style={{ fontSize:"11px", color:"#a0a0a0" }}>{k.sub2}</span>
              </div>}
            </div>
          ))}
        </div>

        {/* ── Funil + Metas ── */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px" }}>
          {/* Funil */}
          <div className="card" style={{ padding:"20px 28px" }}>
            <h3 style={{ fontSize:"14px", fontWeight:"600", color:"#e0e0e0", margin:"0 0 20px" }}>Funil de vendas</h3>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"0" }}>
              {funnelItems.map((item, i) => {
                const w = maxFunil > 0 ? Math.max((item.val / maxFunil) * 100, item.val > 0 ? 18 : 8) : 18;
                return (
                  <div key={item.label} style={{ width:"100%", display:"flex", flexDirection:"column", alignItems:"center" }}>
                    {i > 0 && item.pctConv !== null && (
                      <div style={{ fontSize:"11px", color:"#505050", margin:"5px 0" }}>↓ {item.pctConv}%</div>
                    )}
                    <div style={{ width:`${w}%`, background:item.cor, borderRadius:"6px", padding:"10px 0", textAlign:"center", transition:"width 0.5s" }}>
                      <div style={{ fontSize:"9px", fontWeight:"700", color:"#a0c0a0", letterSpacing:"0.06em" }}>{item.label}</div>
                      <div style={{ fontSize:"22px", fontWeight:"700", color:"#fff", marginTop:"2px" }}>{item.val}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Metas */}
          <div className="card" style={{ padding:"20px 24px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" }}>
              <h3 style={{ fontSize:"14px", fontWeight:"600", color:"#e0e0e0", margin:0 }}>Metas do período</h3>
              <button onClick={() => { setEditConfig(config); setEditandoMetas(true); }} style={{ display:"flex", alignItems:"center", gap:"4px", background:"none", border:"1px solid #2e2e2e", borderRadius:"6px", padding:"4px 10px", color:"#606060", cursor:"pointer", fontSize:"12px" }}>
                Lançar metas →
              </button>
            </div>
            <MetaBar label="Leads" realizado={dados.leads} meta={config.meta_leads} />
            <MetaBar label="MQL" realizado={dados.mql} meta={config.meta_mql} />
            <MetaBar label="Agendamentos" realizado={dados.agendamentos} meta={config.meta_agendamentos} />
            <MetaBar label="Reuniões" realizado={dados.reunioes} meta={config.meta_reunioes} />
            <MetaBar label="Vendas" realizado={dados.vendas} meta={config.meta_vendas} />
          </div>
        </div>
      </>))}

      {/* ── Modal: Valores Financeiros ── */}
      {editando && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div className="card" style={{ width:"360px", padding:"24px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"18px" }}>
              <h3 style={{ margin:0, fontSize:"15px", fontWeight:"600" }}>Valores Financeiros — {MESES[mes-1]} {ano}</h3>
              <button onClick={() => setEditando(false)} style={{ background:"none", border:"none", color:"#606060", cursor:"pointer" }}><X size={18}/></button>
            </div>
            <EditInput label="Investimento (R$)" value={editConfig.investimento} onChange={v => setEditConfig(p => ({ ...p, investimento: v }))} />
            <p style={{ fontSize:"11px", color:"#505050", margin:"4px 0 0", fontStyle:"italic" }}>Receita gerada, caixa coletado, ticket médio e MRR são calculados automaticamente com base nos lançamentos dos clientes do mês.</p>
            <div style={{ display:"flex", gap:"8px", marginTop:"8px" }}>
              <button onClick={() => setEditando(false)} className="btn-ghost" style={{ flex:1 }}>Cancelar</button>
              <button onClick={() => salvar(editConfig)} disabled={salvando} style={{ flex:1, background:"#29ABE2", color:"#000", border:"none", borderRadius:"8px", padding:"9px", fontWeight:"700", cursor:"pointer", fontSize:"13px" }}>
                {salvando ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Metas ── */}
      {editandoMetas && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div className="card" style={{ width:"360px", padding:"24px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"18px" }}>
              <h3 style={{ margin:0, fontSize:"15px", fontWeight:"600" }}>Metas — {MESES[mes-1]} {ano}</h3>
              <button onClick={() => setEditandoMetas(false)} style={{ background:"none", border:"none", color:"#606060", cursor:"pointer" }}><X size={18}/></button>
            </div>
            <EditInput label="Meta de Leads" value={editConfig.meta_leads} onChange={v => setEditConfig(p => ({ ...p, meta_leads: Math.round(v) }))} />
            <EditInput label="Meta de MQL" value={editConfig.meta_mql} onChange={v => setEditConfig(p => ({ ...p, meta_mql: Math.round(v) }))} />
            <EditInput label="Meta de Agendamentos" value={editConfig.meta_agendamentos} onChange={v => setEditConfig(p => ({ ...p, meta_agendamentos: Math.round(v) }))} />
            <EditInput label="Meta de Reuniões" value={editConfig.meta_reunioes} onChange={v => setEditConfig(p => ({ ...p, meta_reunioes: Math.round(v) }))} />
            <EditInput label="Meta de Vendas" value={editConfig.meta_vendas} onChange={v => setEditConfig(p => ({ ...p, meta_vendas: Math.round(v) }))} />
            <div style={{ display:"flex", gap:"8px", marginTop:"8px" }}>
              <button onClick={() => setEditandoMetas(false)} className="btn-ghost" style={{ flex:1 }}>Cancelar</button>
              <button onClick={() => salvar(editConfig)} disabled={salvando} style={{ flex:1, background:"#29ABE2", color:"#000", border:"none", borderRadius:"8px", padding:"9px", fontWeight:"700", cursor:"pointer", fontSize:"13px" }}>
                {salvando ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
