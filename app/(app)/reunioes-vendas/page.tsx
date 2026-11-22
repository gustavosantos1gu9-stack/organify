"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight, Edit2, X, Users, Calendar, Video, TrendingUp, Target, LayoutDashboard, List, AlertTriangle, Info } from "lucide-react";
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
  const cor = atingiu ? "#1E6B52" : pctReal >= 70 ? "#C2620E" : "#B42318";
  return (
    <div style={{ marginBottom: "18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "7px" }}>
        <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A1826" }}>{label}</span>
        <span style={{ fontSize: "13px", fontWeight: "700", color: cor }}>{pctReal}%</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
        <span style={{ fontSize: "10px", color: "#4A5B6C", width: "58px" }}>Realizado</span>
        <div style={{ flex: 1, height: "5px", background: "#E6EBF0", borderRadius: "3px" }}>
          <div style={{ width: `${pctVal}%`, height: "100%", background: cor, borderRadius: "3px", transition: "width 0.5s" }} />
        </div>
        <span style={{ fontSize: "11px", color: "#4A5B6C", width: "28px", textAlign: "right" }}>{realizado}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "10px", color: "#4A5B6C", width: "58px" }}>Meta</span>
        <div style={{ flex: 1, height: "5px", background: "#E6EBF0", borderRadius: "3px" }}>
          <div style={{ width: "100%", height: "100%", background: "#E6EBF0", borderRadius: "3px" }} />
        </div>
        <span style={{ fontSize: "11px", color: "#4A5B6C", width: "28px", textAlign: "right" }}>{meta}</span>
      </div>
    </div>
  );
}

function EditInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ marginBottom: "11px" }}>
      <label style={{ fontSize: "11px", color: "#4A5B6C", display: "block", marginBottom: "4px" }}>{label}</label>
      <input type="number" value={value || ""} onChange={e => onChange(parseFloat(e.target.value) || 0)}
        style={{ width: "100%", background: "#FFFFFF", border: "1px solid #E6EBF0", borderRadius: "6px", padding: "7px 10px", fontSize: "13px", color: "#0A1826", outline: "none", boxSizing: "border-box" }} />
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
  if (origem === "Não Rastreada" || origem === "—") return <span style={{ fontSize:"12px", color:"#4A5B6C" }}>Não rastreada</span>;
  return <span style={{ fontSize:"12px", color:"#4A5B6C" }}>{origem}</span>;
}

function Delta({ curr, prev }: { curr: number; prev: number }) {
  if (prev === 0 || curr === prev) return null;
  const diff = curr - prev;
  const p = Math.round(Math.abs(diff / prev) * 100);
  const isUp = diff > 0;
  return (
    <span style={{ fontSize: "11px", fontWeight: "700", color: isUp ? "#1E6B52" : "#B42318", display: "inline-flex", alignItems: "center", gap: "1px" }}>
      {isUp ? "▲" : "▼"} {p}%
    </span>
  );
}

// ── Visual: números que sobem, anel de taxa, variação vs mês anterior ──
function useCountUp(valor: number, dur = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setV(valor); return; }
    let raf = 0;
    const t0 = performance.now();
    const passo = (t: number) => {
      const p = Math.min((t - t0) / dur, 1);
      setV(valor * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [valor, dur]);
  return v;
}
function fmtR(n: number) { return `R$ ${Math.round(n).toLocaleString("pt-BR")}`; }
function Num({ valor, f }: { valor: number; f?: (n: number) => string }) {
  const v = useCountUp(valor);
  return <>{f ? f(v) : Math.round(v).toLocaleString("pt-BR")}</>;
}
function DeltaPill({ curr, prev, escuro }: { curr: number; prev: number; escuro?: boolean }) {
  if (!prev || curr === prev) return null;
  const diff = curr - prev;
  const p = Math.round(Math.abs(diff / prev) * 100);
  const sobe = diff > 0;
  return (
    <span className={`rv-delta ${sobe ? "sobe" : "desce"}${escuro ? " escuro" : ""}`} title="em relação ao mês anterior">
      {sobe ? "↑" : "↓"} {p}%
    </span>
  );
}
function Anel({ pct, cor, tam = 128 }: { pct: number; cor: string; tam?: number }) {
  const r = (tam - 14) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(Math.max(pct, 0), 100) / 100);
  return (
    <svg width={tam} height={tam} viewBox={`0 0 ${tam} ${tam}`} className="rv-anel" aria-hidden>
      <circle cx={tam / 2} cy={tam / 2} r={r} className="rv-anel-trilho" />
      <circle cx={tam / 2} cy={tam / 2} r={r} className="rv-anel-valor" stroke={cor}
        style={{ strokeDasharray: c, strokeDashoffset: off, ["--c" as any]: c }} />
    </svg>
  );
}
function iniciais(nome: string) {
  return (nome || "?").trim().split(/\s+/).slice(0, 2).map(p => p[0] || "").join("").toUpperCase();
}
function matiz(nome: string) {
  let h = 0;
  for (const ch of nome || "") h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
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

  const [filtro, setFiltro] = useState<"todas" | "compareceu" | "fechou">("todas");
  const fechouEtapa = (e: string) => e === "Fechou" || e === "Comprou";
  const leadsFiltrados = leads.filter(l =>
    filtro === "todas" ? true : filtro === "fechou" ? fechouEtapa(l.etapa) : !fechouEtapa(l.etapa)
  );
  const mesNome = MESES[mes - 1].toLowerCase();
  const prevTaxaLista = listaPrevCounts.total > 0 ? Math.round((listaPrevCounts.fechou / listaPrevCounts.total) * 100) : 0;
  const maxOrigem = kpisLista.origensOrdenadas[0]?.total || 1;
  const temMetas = [config.meta_leads, config.meta_mql, config.meta_agendamentos, config.meta_reunioes, config.meta_vendas].some(m => m > 0);
  const etapasFunil = [
    { l: "Leads", v: dados.leads, prev: dadosPrev.leads, custo: { n: "CPL", v: kpis.cpl }, taxa: null as null | { n: string; v: number } },
    { l: "MQL", v: dados.mql, prev: dadosPrev.mql, custo: { n: "Custo por MQL", v: kpis.cpmql }, taxa: { n: "dos leads", v: kpis.taxaMql } },
    { l: "Agendamentos", v: dados.agendamentos, prev: dadosPrev.agendamentos, custo: { n: "Custo por agendamento", v: kpis.custoAgend }, taxa: { n: "dos MQL", v: kpis.taxaAgendMql } },
    { l: "Reuniões realizadas", v: dados.reunioes, prev: dadosPrev.reunioes, custo: { n: "Custo por reunião", v: kpis.custoRR }, taxa: { n: "dos agendamentos", v: kpis.taxaRR } },
    { l: "Vendas", v: dados.vendas, prev: dadosPrev.vendas, custo: { n: "CAC", v: kpis.cac }, taxa: { n: "das reuniões", v: kpis.convRR } },
  ];
  const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);
  const dataCurta = (d: string) => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "") : "—";

  return (
    <div className="rv" style={{ width: "100%" }}>
      {/* Barra de controle: visão + mês */}
      <div className="rv-barra">
        <div className="rv-seg" data-v={view} role="tablist">
          <button role="tab" aria-selected={view === "lista"} className={view === "lista" ? "on" : ""} onClick={() => setView("lista")}>
            <List size={14} /> Lista
          </button>
          <button role="tab" aria-selected={view === "dash"} className={view === "dash" ? "on" : ""} onClick={() => setView("dash")}>
            <LayoutDashboard size={14} /> Dashboard
          </button>
        </div>
        <div className="rv-mes">
          <button onClick={prevMonth} aria-label="Mês anterior"><ChevronLeft size={16} /></button>
          <span key={mesStr} className="rv-mes-tx">{MESES[mes - 1]} {ano}</span>
          <button onClick={nextMonth} aria-label="Próximo mês"><ChevronRight size={16} /></button>
        </div>
      </div>

      {/* ══════════════════════ LISTA ══════════════════════ */}
      {view === "lista" && (
        <div className="rv-view" key={"lista" + mesStr}>
          <section className="rv-hero">
            <div className="rv-hero-main">
              <span className="rv-hero-ctx">Reuniões realizadas em {mesNome}</span>
              <h2 className="rv-hero-tit">
                <Num valor={kpisLista.total} /> {plural(kpisLista.total, "reunião", "reuniões")},{" "}
                <span className="font-serif-accent">{kpisLista.fechou} {plural(kpisLista.fechou, "fechada", "fechadas")}</span>
              </h2>
              <div className="rv-hero-nums">
                {[
                  { l: "Total", v: kpisLista.total, p: listaPrevCounts.total, d: "no mês" },
                  { l: "Compareceram", v: kpisLista.compareceu, p: listaPrevCounts.compareceu, d: "ainda não fecharam" },
                  { l: "Fecharam", v: kpisLista.fechou, p: listaPrevCounts.fechou, d: `${kpisLista.fechou} de ${kpisLista.total}` },
                ].map((n, i) => (
                  <div key={n.l} className="rv-hero-num" style={{ ["--i" as any]: i }}>
                    <span className="rv-hero-l">{n.l}</span>
                    <span className="rv-hero-v"><Num valor={n.v} /><DeltaPill curr={n.v} prev={n.p} escuro /></span>
                    <span className="rv-hero-d">{n.d}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rv-hero-anel">
              <Anel pct={kpisLista.taxa} cor={kpisLista.taxa >= 50 ? "#4ADE80" : "#F5A524"} />
              <div className="rv-anel-centro">
                <b><Num valor={kpisLista.taxa} />%</b>
                <span>fechamento</span>
              </div>
              {listaPrevCounts.total > 0 && <DeltaPill curr={kpisLista.taxa} prev={prevTaxaLista} escuro />}
            </div>
          </section>

          {kpisLista.origensOrdenadas.length > 0 && (
            <section className="rv-card">
              <header className="rv-card-h">
                <h3>De onde vieram</h3>
                <span className="rv-legenda"><i className="f" />fecharam <i className="c" />compareceram</span>
              </header>
              <div className="rv-origens">
                {kpisLista.origensOrdenadas.map((o, i) => (
                  <div key={o.origem} className="rv-origem" style={{ ["--i" as any]: i }}>
                    <div className="rv-origem-nome"><OrigemIcon origem={o.origem} /></div>
                    <div className="rv-origem-trilho">
                      <div className="rv-origem-fill" style={{ width: `${(o.total / maxOrigem) * 100}%` }}>
                        <span className="f" style={{ width: `${o.total ? (o.fechou / o.total) * 100 : 0}%` }} />
                        <span className="c" />
                      </div>
                    </div>
                    <div className="rv-origem-num">
                      <b>{o.total}</b>
                      <span>{o.fechou} {plural(o.fechou, "fechou", "fecharam")}</span>
                      <em className={o.taxa >= 50 ? "bom" : "medio"}>{o.taxa}%</em>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="rv-card rv-card-tabela">
            <header className="rv-card-h">
              <h3>Reuniões do mês</h3>
              <div className="rv-filtros">
                {([
                  ["todas", "Todas", kpisLista.total],
                  ["compareceu", "Compareceram", kpisLista.compareceu],
                  ["fechou", "Fecharam", kpisLista.fechou],
                ] as const).map(([k, l, n]) => (
                  <button key={k} className={filtro === k ? "on" : ""} onClick={() => setFiltro(k)}>
                    {l} <span>{n}</span>
                  </button>
                ))}
              </div>
            </header>
            <table className="rv-tabela">
              <thead>
                <tr><th>Cliente</th><th>Origem</th><th>Situação</th><th style={{ textAlign: "right" }}>Data</th></tr>
              </thead>
              <tbody>
                {loadingLista ? (
                  [0, 1, 2, 3, 4].map(i => (
                    <tr key={i} className="rv-esqueleto"><td colSpan={4}><span /></td></tr>
                  ))
                ) : leadsFiltrados.length === 0 ? (
                  <tr><td colSpan={4} className="rv-vazio">
                    {leads.length === 0 ? `Nenhuma reunião registrada em ${mesNome}. Elas aparecem aqui quando a conversa chega em Compareceu ou Fechou no CRM.` : "Nenhuma reunião neste filtro."}
                  </td></tr>
                ) : leadsFiltrados.map((l, i) => {
                  const fechou = fechouEtapa(l.etapa);
                  return (
                    <tr key={l.id} className="rv-linha" style={{ ["--i" as any]: Math.min(i, 14) }}>
                      <td>
                        <div className="rv-pessoa">
                          <span className="rv-avatar" style={{ ["--h" as any]: matiz(l.nome) }}>{iniciais(l.nome)}</span>
                          <span className="rv-pessoa-nome">{l.nome}</span>
                        </div>
                      </td>
                      <td><OrigemIcon origem={l.origem} /></td>
                      <td>
                        <span className={`rv-status ${fechou ? "fechou" : "compareceu"}`}>
                          <i />{fechou ? "Fechou" : "Compareceu"}
                        </span>
                      </td>
                      <td className="rv-data">{dataCurta(l.data)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {/* ══════════════════════ DASHBOARD ══════════════════════ */}
      {view === "dash" && (loadingDash ? (
        <div className="rv-view">
          <div className="rv-hero rv-hero-esq"><span /><span /><span /></div>
          <div className="rv-grade-2"><div className="rv-card rv-bloco-esq" /><div className="rv-card rv-bloco-esq" /></div>
        </div>
      ) : (
        <div className="rv-view" key={"dash" + mesStr}>
          <section className="rv-hero">
            <div className="rv-hero-main">
              <span className="rv-hero-ctx">Resultado comercial de {mesNome}</span>
              <h2 className="rv-hero-tit">
                <Num valor={dados.vendas} /> {plural(dados.vendas, "venda", "vendas")},{" "}
                <span className="font-serif-accent">
                  {kpis.roas > 0 ? `ROAS ${fmtX(kpis.roas)}` : `${dados.leads} ${plural(dados.leads, "lead", "leads")} no mês`}
                </span>
              </h2>
              <div className="rv-hero-nums rv-hero-nums-6">
                <div className="rv-hero-num" style={{ ["--i" as any]: 0 }}>
                  <span className="rv-hero-l">
                    Investimento
                    <button className="rv-editar" onClick={() => { setEditConfig(config); setEditando(true); }} aria-label="Editar investimento"><Edit2 size={12} /></button>
                  </span>
                  <span className="rv-hero-v"><Num valor={config.investimento} f={fmtR} /></span>
                  <span className="rv-hero-d">CPL {kpis.cpl > 0 ? fmt(kpis.cpl) : "—"}</span>
                </div>
                <div className="rv-hero-num" style={{ ["--i" as any]: 1 }}>
                  <span className="rv-hero-l">Receita gerada</span>
                  <span className="rv-hero-v">{dados.receitaGerada > 0 ? <Num valor={dados.receitaGerada} f={fmtR} /> : "—"}{dados.receitaGerada > 0 && <DeltaPill curr={dados.receitaGerada} prev={dadosPrev.receitaGerada} escuro />}</span>
                  <span className="rv-hero-d">{dados.clientesMes} {plural(dados.clientesMes, "contrato novo", "contratos novos")}</span>
                </div>
                <div className="rv-hero-num" style={{ ["--i" as any]: 2 }}>
                  <span className="rv-hero-l">Caixa coletado</span>
                  <span className="rv-hero-v">{dados.caixaColetado > 0 ? <Num valor={dados.caixaColetado} f={fmtR} /> : dados.receitaGerada > 0 ? "R$ 0" : "—"}{dados.caixaColetado > 0 && <DeltaPill curr={dados.caixaColetado} prev={dadosPrev.caixaColetado} escuro />}</span>
                  <span className="rv-hero-d">{dados.receitaGerada > 0 ? `${pct(kpis.pctCaixa)} da receita` : "sem receita no mês"}</span>
                </div>
                <div className="rv-hero-num" style={{ ["--i" as any]: 3 }}>
                  <span className="rv-hero-l">ROAS</span>
                  <span className="rv-hero-v">{kpis.roas > 0 ? fmtX(kpis.roas) : "—"}</span>
                  <span className="rv-hero-d">receita ÷ investimento</span>
                </div>
                <div className="rv-hero-num" style={{ ["--i" as any]: 4 }}>
                  <span className="rv-hero-l">Ticket médio</span>
                  <span className="rv-hero-v">{dados.ticketMedio > 0 ? <Num valor={dados.ticketMedio} f={fmtR} /> : "—"}</span>
                  <span className="rv-hero-d">{dados.clientesMes > 0 ? `${dados.clientesMes} ${plural(dados.clientesMes, "contrato", "contratos")}` : "—"}</span>
                </div>
                <div className="rv-hero-num" style={{ ["--i" as any]: 5 }}>
                  <span className="rv-hero-l">MRR (×3)</span>
                  <span className="rv-hero-v">{dados.mrrCalculado > 0 ? <Num valor={dados.mrrCalculado} f={fmtR} /> : "—"}</span>
                  <span className="rv-hero-d">{dados.mrrCalculado > 0 ? `base mensal ${fmt(dados.mrrCalculado / 3)}` : "—"}</span>
                </div>
              </div>
            </div>
            <div className="rv-hero-anel">
              <Anel pct={kpis.convRR} cor={kpis.convRR >= 50 ? "#4ADE80" : "#F5A524"} />
              <div className="rv-anel-centro">
                <b><Num valor={kpis.convRR} />%</b>
                <span>das reuniões viraram venda</span>
              </div>
            </div>
          </section>

          {dados.vendas > 0 && dados.clientesMes < dados.vendas && (
            <div className="rv-aviso">
              <AlertTriangle size={16} />
              <span>
                <strong>{dados.vendas - dados.clientesMes} {plural(dados.vendas - dados.clientesMes, "venda", "vendas")}</strong> sem cliente cadastrado com data de entrada em {mesNome}, então a receita gerada pode estar incompleta. Corrija a data de entrada dos clientes no Financeiro.
              </span>
            </div>
          )}

          <div className="rv-grade-2">
            {/* Funil */}
            <section className="rv-card">
              <header className="rv-card-h">
                <h3>Funil de vendas</h3>
                <span className="rv-card-sub">{pct(kpis.convLeads)} dos leads viraram venda</span>
              </header>
              <div className="rv-funil">
                {etapasFunil.map((e, i) => {
                  const w = Math.max((e.v / Math.max(dados.leads, 1)) * 100, e.v > 0 ? 6 : 2);
                  return (
                    <div key={e.l} className="rv-etapa" style={{ ["--i" as any]: i }}>
                      {e.taxa && (
                        <div className="rv-etapa-conv"><span>↓ {pct(e.taxa.v)} {e.taxa.n}</span></div>
                      )}
                      <div className="rv-etapa-topo">
                        <span className="rv-etapa-nome">{e.l}</span>
                        <span className="rv-etapa-custo">{e.custo.n} <b>{e.custo.v > 0 ? fmt(e.custo.v) : "—"}</b></span>
                      </div>
                      <div className="rv-etapa-linha">
                        <div className="rv-etapa-trilho">
                          <div className={`rv-etapa-fill e${i}`} style={{ width: `${w}%` }} />
                        </div>
                        <span className="rv-etapa-v"><Num valor={e.v} /></span>
                        <span className="rv-etapa-delta"><DeltaPill curr={e.v} prev={e.prev} /></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Metas */}
            <section className="rv-card">
              <header className="rv-card-h">
                <h3>Metas do período</h3>
                <button className="rv-botao" onClick={() => { setEditConfig(config); setEditandoMetas(true); }}>
                  <Target size={13} /> {temMetas ? "Editar metas" : "Lançar metas"}
                </button>
              </header>
              {!temMetas ? (
                <div className="rv-metas-vazio">
                  <Target size={22} />
                  <p>Nenhuma meta lançada para {mesNome}.</p>
                  <span>Lance as metas para acompanhar o progresso de cada etapa do funil.</span>
                </div>
              ) : (
                <div className="rv-metas">
                  {[
                    { l: "Leads", r: dados.leads, m: config.meta_leads },
                    { l: "MQL", r: dados.mql, m: config.meta_mql },
                    { l: "Agendamentos", r: dados.agendamentos, m: config.meta_agendamentos },
                    { l: "Reuniões", r: dados.reunioes, m: config.meta_reunioes },
                    { l: "Vendas", r: dados.vendas, m: config.meta_vendas },
                  ].map((g, i) => {
                    const p = g.m > 0 ? Math.round((g.r / g.m) * 100) : 0;
                    const tom = g.m === 0 ? "sem" : p >= 100 ? "ok" : p >= 70 ? "quase" : "longe";
                    return (
                      <div key={g.l} className={`rv-meta ${tom}`} style={{ ["--i" as any]: i }}>
                        <div className="rv-meta-topo">
                          <span className="rv-meta-nome">{g.l}</span>
                          <span className="rv-meta-num">{g.m > 0 ? <><b>{g.r}</b> de {g.m}</> : "sem meta"}</span>
                          <span className="rv-meta-pct">{g.m > 0 ? `${p}%` : ""}</span>
                        </div>
                        <div className="rv-meta-trilho">
                          <div className="rv-meta-fill" style={{ width: `${Math.min(p, 100)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {origensLeads.length > 0 && (
            <section className="rv-card">
              <header className="rv-card-h">
                <h3>Leads por origem</h3>
                <span className="rv-card-sub">quantos agendaram reunião</span>
              </header>
              <div className="rv-origens">
                {origensLeads.map((o, i) => (
                  <div key={o.origem} className="rv-origem" style={{ ["--i" as any]: i }}>
                    <div className="rv-origem-nome"><span className="rv-origem-tx">{o.origem}</span></div>
                    <div className="rv-origem-trilho">
                      <div className="rv-origem-fill" style={{ width: `${Math.max(o.pct, 2)}%` }}>
                        <span className="f azul" style={{ width: `${o.count ? (o.agendamentos / o.count) * 100 : 0}%` }} />
                        <span className="c azul" />
                      </div>
                    </div>
                    <div className="rv-origem-num">
                      <b>{o.count}</b>
                      <span>{o.pct}% · {o.agendamentos} agend.</span>
                      <em className={o.taxaAgend >= 30 ? "bom" : o.taxaAgend >= 15 ? "medio" : "ruim"}>{o.taxaAgend}%</em>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <p className="rv-nota"><Info size={13} /> Cada etapa conta no dia em que aconteceu: um lead de mês anterior que agendou agora soma no agendamento deste período.</p>
        </div>
      ))}

      {/* ── Janela: valores financeiros ── */}
      {editando && (
        <div className="rv-veu" onClick={() => setEditando(false)}>
          <div className="rv-janela" onClick={e => e.stopPropagation()}>
            <div className="rv-janela-h">
              <h3>Investimento de {mesNome} {ano}</h3>
              <button onClick={() => setEditando(false)} aria-label="Fechar"><X size={18} /></button>
            </div>
            <EditInput label="Investimento (R$)" value={editConfig.investimento} onChange={v => setEditConfig(p => ({ ...p, investimento: v }))} />
            <p className="rv-janela-nota">Receita gerada, caixa coletado, ticket médio e MRR são calculados automaticamente a partir dos lançamentos dos clientes do mês.</p>
            <div className="rv-janela-acoes">
              <button onClick={() => setEditando(false)} className="rv-botao">Cancelar</button>
              <button onClick={() => salvar(editConfig)} disabled={salvando} className="rv-botao primario">
                {salvando ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Janela: metas ── */}
      {editandoMetas && (
        <div className="rv-veu" onClick={() => setEditandoMetas(false)}>
          <div className="rv-janela" onClick={e => e.stopPropagation()}>
            <div className="rv-janela-h">
              <h3>Metas de {mesNome} {ano}</h3>
              <button onClick={() => setEditandoMetas(false)} aria-label="Fechar"><X size={18} /></button>
            </div>
            <EditInput label="Meta de leads" value={editConfig.meta_leads} onChange={v => setEditConfig(p => ({ ...p, meta_leads: Math.round(v) }))} />
            <EditInput label="Meta de MQL" value={editConfig.meta_mql} onChange={v => setEditConfig(p => ({ ...p, meta_mql: Math.round(v) }))} />
            <EditInput label="Meta de agendamentos" value={editConfig.meta_agendamentos} onChange={v => setEditConfig(p => ({ ...p, meta_agendamentos: Math.round(v) }))} />
            <EditInput label="Meta de reuniões" value={editConfig.meta_reunioes} onChange={v => setEditConfig(p => ({ ...p, meta_reunioes: Math.round(v) }))} />
            <EditInput label="Meta de vendas" value={editConfig.meta_vendas} onChange={v => setEditConfig(p => ({ ...p, meta_vendas: Math.round(v) }))} />
            <div className="rv-janela-acoes">
              <button onClick={() => setEditandoMetas(false)} className="rv-botao">Cancelar</button>
              <button onClick={() => salvar(editConfig)} disabled={salvando} className="rv-botao primario">
                {salvando ? "Salvando..." : "Salvar metas"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
