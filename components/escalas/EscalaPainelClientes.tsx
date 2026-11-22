"use client";

import { useState, useEffect, useRef } from "react";
import { supabase, getAgenciaId } from "@/lib/supabase";
import {
  GripVertical, ChevronLeft, ChevronRight, MessageSquare, X,
  LayoutList, CalendarDays, ExternalLink, FileSpreadsheet,
} from "lucide-react";

interface ClientePainel {
  id: string;
  nome: string;
  status: string;
  gestor: string;
  prioridade: string | null;
  escala_jornada: string | null;
  link_planilha: string | null;
  resposta_planilha: string | null;
  relatorio_id: string | null;
  renovou: boolean | null;
  uti: boolean | null;
  data_inicio_campanha: string | null;
  // vindos de escala_config (por gestorEscala)
  proxima_analise: string | null;
  escala_ordem: number | null;
  // custo por agendamento e ROAS do último mês
  custo_por_agendamento: number | null;
  roas: number | null;
}

interface Atualizacao {
  id: string;
  cliente_id: string;
  gestor: string;
  texto: string;
  created_at: string;
}

const PRIORIDADES = ["Urgente", "Alta", "Media", "Baixa"] as const;

const PRIO: Record<string, { cor: string; bg: string; label: string }> = {
  Urgente: { cor: "var(--alert-text)", bg: "var(--alert-bg)", label: "Urgente" },
  Alta:    { cor: "#f97316", bg: "rgba(249,115,22,0.14)", label: "Alta" },
  Media:   { cor: "var(--caution-text)", bg: "var(--caution-bg)", label: "Média" },
  Baixa:   { cor: "var(--success)", bg: "var(--success-bg)", label: "Baixa" },
};

const RESPOSTA: Record<string, { cor: string; label: string }> = {
  sim:          { cor: "var(--success)", label: "Sim" },
  parcialmente: { cor: "var(--caution-text)", label: "Parcial" },
  nao:          { cor: "var(--alert-text)", label: "Não" },
};

const JORNADAS: { value: string; label: string; cor: string; bg: string; descricao: string[] }[] = [
  {
    value: "etapa0", label: "Fase 0", cor: "var(--alert-text)", bg: "var(--alert-bg)",
    descricao: ["Sem mensagem", "Pouca mensagem", "Custo alto", "Não bate os dados com o tráfego"],
  },
  {
    value: "etapa1", label: "Fase 1", cor: "#f97316", bg: "rgba(249,115,22,0.12)",
    descricao: ["Bom custo por oportunidade", "Chegando mensagens igual o gerenciador"],
  },
  {
    value: "etapa2", label: "Fase 2", cor: "var(--caution-text)", bg: "var(--caution-bg)",
    descricao: ["Agendamento custo alto"],
  },
  {
    value: "etapa3", label: "Fase 3", cor: "var(--brand)", bg: "var(--phase3-bg)",
    descricao: ["Agendamento bom custo"],
  },
  {
    value: "etapa4", label: "Fase 4", cor: "var(--success)", bg: "var(--success-bg)",
    descricao: ["Escala"],
  },
  {
    value: "resultado_oscilando", label: "Oscilando", cor: "#a855f7", bg: "rgba(168,85,247,0.12)",
    descricao: ["Resultado oscilando"],
  },
];

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES_CAL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Suporta dd/mm/yyyy, yyyy-mm-dd e yyyy-mm-dd HH:MM:SS */
function parseData(s: string | null): Date | null {
  if (!s) return null;
  if (s.includes("/")) {
    const [d, m, y] = s.split("/");
    return new Date(`${y}-${m}-${d}T00:00:00`);
  }
  if (s.includes(" ")) return new Date(s.replace(" ", "T"));
  return new Date(s + "T00:00:00");
}

function RenovacaoDisplay({ renovou, dataInicio }: { renovou: boolean | null; dataInicio: string | null }) {
  const inicio = parseData(dataInicio);
  if (!inicio || isNaN(inicio.getTime())) {
    return <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Sem data</span>;
  }
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const fimTrimestre = new Date(inicio);
  fimTrimestre.setDate(fimTrimestre.getDate() + 90);
  const diasRestantes = Math.ceil((fimTrimestre.getTime() - hoje.getTime()) / 86400000);
  const diasPassados = Math.floor((hoje.getTime() - inicio.getTime()) / 86400000);
  const progresso = Math.min(100, Math.max(0, Math.round((diasPassados / 90) * 100)));

  if (diasRestantes <= 0) {
    if (renovou === null || renovou === undefined) {
      return <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Aguardando</span>;
    }
    if (renovou === false) {
      return <span style={{ fontSize: "11px", color: "var(--alert-text)", fontWeight: "600" }}>Não renovou</span>;
    }
    const mesesTotal = Math.floor(diasPassados / 30);
    const diasExtra = diasPassados % 30;
    const partes = [];
    if (mesesTotal > 0) partes.push(`${mesesTotal} ${mesesTotal === 1 ? "mês" : "meses"}`);
    if (diasExtra > 0 || mesesTotal === 0) partes.push(`${diasExtra} dias`);
    return <span style={{ fontSize: "11px", color: "var(--success)", fontWeight: "600" }}>{partes.join(" e ")}</span>;
  }

  const cor = diasRestantes > 30 ? "var(--success)" : diasRestantes > 15 ? "var(--caution-text)" : "var(--alert-text)";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
      <div style={{ height: "5px", background: "#222", borderRadius: "3px", overflow: "hidden", width: "80px" }}>
        <div style={{ height: "100%", width: `${progresso}%`, background: cor, borderRadius: "3px" }} />
      </div>
      <span style={{ fontSize: "10px", color: cor, fontWeight: "500" }}>{diasRestantes}d restantes</span>
    </div>
  );
}

function fmtDataCurta(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

interface Props {
  /** Quem está usando esta escala (salvo em atualizações) */
  gestor: string;
  /** Chave da escala para proxima_analise e escala_ordem individuais */
  gestorEscala: string;
  /** Se definido, filtra clientes por este valor no campo gestor de controle_clientes */
  filtroGestor?: string;
}

export default function EscalaPainelClientes({ gestor, gestorEscala, filtroGestor }: Props) {
  const [agenciaId, setAgenciaId] = useState<string | null>(null);
  const [clientes, setClientes] = useState<ClientePainel[]>([]);
  const [atualizacoes, setAtualizacoes] = useState<Record<string, Atualizacao[]>>({});
  const [novaAtualizacao, setNovaAtualizacao] = useState<Record<string, string>>({});
  const [logAberto, setLogAberto] = useState<string | null>(null);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const hoje = new Date();
  const [calMes, setCalMes] = useState(hoje.getMonth());
  const [calAno, setCalAno] = useState(hoje.getFullYear());
  const [aba, setAba] = useState<"painel" | "calendario">("painel");
  const [expandido, setExpandido] = useState<Record<string, boolean>>({});

  const dragId = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  function toggleExpandido(id: string) {
    setExpandido(prev => ({ ...prev, [id]: !prev[id] }));
  }

  useEffect(() => {
    getAgenciaId().then(id => {
      setAgenciaId(id);
      if (id) carregarClientes(id);
    });
  }, [gestor, gestorEscala, filtroGestor]);

  async function carregarClientes(aid: string) {
    setLoading(true);
    try {
      let q = supabase
        .from("controle_clientes")
        .select("id, nome, status, gestor, prioridade, escala_jornada, link_planilha, resposta_planilha, relatorio_id, renovou, uti, data_inicio_campanha")
        .eq("agencia_id", aid)
        .neq("status", "saiu")
        .order("nome", { ascending: true });

      if (filtroGestor) q = q.eq("gestor", filtroGestor);

      const { data: clientesData } = await q;
      if (!clientesData) return;

      // Carregar escala_config para este gestorEscala
      const ids = clientesData.map(c => c.id);
      const { data: configData } = await supabase
        .from("escala_config")
        .select("cliente_id, proxima_analise, escala_ordem")
        .eq("agencia_id", aid)
        .eq("gestor_escala", gestorEscala)
        .in("cliente_id", ids);

      const configMap: Record<string, { proxima_analise: string | null; escala_ordem: number | null }> = {};
      for (const c of configData || []) {
        configMap[c.cliente_id] = { proxima_analise: c.proxima_analise, escala_ordem: c.escala_ordem };
      }

      // Carregar custo_por_agendamento e ROAS do mês passado
      const custoMap: Record<string, number | null> = {};
      const roasMap: Record<string, number | null> = {};
      const relatorioIds = clientesData
        .map(c => c.relatorio_id)
        .filter((id): id is string => !!id);

      if (relatorioIds.length > 0) {
        const hoje2 = new Date();
        const ultMesNum = hoje2.getMonth() === 0 ? 12 : hoje2.getMonth();
        const ultAnoNum = hoje2.getMonth() === 0 ? hoje2.getFullYear() - 1 : hoje2.getFullYear();
        const dateFrom = `${ultAnoNum}-${String(ultMesNum).padStart(2, "0")}-01`;
        const lastDay = new Date(ultAnoNum, ultMesNum, 0).getDate();
        const dateTo = `${ultAnoNum}-${String(ultMesNum).padStart(2, "0")}-${lastDay}`;

        // Custo por agendamento (Meta spend / agendamentos manuais)
        try {
          const res = await fetch("/api/escala/custo-agendamento", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ relatorio_ids: relatorioIds, date_from: dateFrom, date_to: dateTo }),
          });
          const custosPorRelatorio: Record<string, number | null> = await res.json();
          for (const c of clientesData) {
            if (c.relatorio_id && custosPorRelatorio[c.relatorio_id] != null) {
              custoMap[c.id] = custosPorRelatorio[c.relatorio_id];
            }
          }
        } catch {}

        // ROAS (faturamento / investimento do performance_semanal)
        try {
          const res = await fetch("/api/controle/roas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ relatorio_ids: relatorioIds }),
          });
          const json = await res.json();
          const byRelId: Record<string, { spend: number | null; faturamento: number | null }> = {};
          (json.results || []).forEach((r: any) => { byRelId[r.relatorio_id] = { spend: r.spend, faturamento: r.faturamento ?? null }; });
          for (const c of clientesData) {
            if (c.relatorio_id && byRelId[c.relatorio_id]) {
              const { spend, faturamento } = byRelId[c.relatorio_id];
              if (spend && spend > 0 && faturamento && faturamento > 0) {
                roasMap[c.id] = faturamento / spend;
              }
            }
          }
        } catch {}
      }

      const merged: ClientePainel[] = clientesData
        .map(c => ({
          ...c,
          proxima_analise: configMap[c.id]?.proxima_analise ?? null,
          escala_ordem: configMap[c.id]?.escala_ordem ?? null,
          custo_por_agendamento: custoMap[c.id] ?? null,
          roas: roasMap[c.id] ?? null,
        }))
        .sort((a, b) => {
          const oa = a.escala_ordem ?? 9999;
          const ob = b.escala_ordem ?? 9999;
          return oa !== ob ? oa - ob : a.nome.localeCompare(b.nome);
        });

      setClientes(merged);
      carregarAtualizacoes(aid, ids);
    } finally {
      setLoading(false);
    }
  }

  async function carregarAtualizacoes(aid: string, ids: string[]) {
    if (!ids.length) return;
    // Carrega TODAS atualizações de todos gestores para cada cliente
    const { data } = await supabase
      .from("escala_atualizacoes")
      .select("id, cliente_id, gestor, texto, created_at")
      .eq("agencia_id", aid)
      .in("cliente_id", ids)
      .order("created_at", { ascending: false });

    if (data) {
      const map: Record<string, Atualizacao[]> = {};
      for (const a of data) {
        if (!map[a.cliente_id]) map[a.cliente_id] = [];
        map[a.cliente_id].push(a);
      }
      setAtualizacoes(map);
    }
  }

  async function atualizarPrioridade(id: string, prioridade: string) {
    const uti = prioridade === "Urgente";
    setClientes(prev => prev.map(c => c.id === id ? { ...c, prioridade, uti } : c));
    await supabase.from("controle_clientes").update({ prioridade, uti }).eq("id", id);
  }

  async function toggleUti(id: string, atual: boolean | null) {
    const novoUti = !atual;
    const prioridade = novoUti ? "Urgente" : "Media";
    setClientes(prev => prev.map(c => c.id === id ? { ...c, uti: novoUti, prioridade } : c));
    await supabase.from("controle_clientes").update({ uti: novoUti, prioridade }).eq("id", id);
  }

  async function atualizarJornada(id: string, escala_jornada: string, aid: string) {
    setClientes(prev => prev.map(c => c.id === id ? { ...c, escala_jornada } : c));
    await supabase.from("controle_clientes").update({ escala_jornada }).eq("id", id);

    // Auto-log da mudança de fase
    if (escala_jornada && aid) {
      const jornada = JORNADAS.find(j => j.value === escala_jornada);
      if (jornada) {
        const texto = `🔄 Fase alterada para ${jornada.label} (${jornada.cor})`;
        const { data } = await supabase
          .from("escala_atualizacoes")
          .insert({ agencia_id: aid, cliente_id: id, gestor, texto })
          .select("id, cliente_id, gestor, texto, created_at")
          .single();
        if (data) {
          setAtualizacoes(prev => ({
            ...prev,
            [id]: [data, ...(prev[id] || [])],
          }));
        }
      }
    }
  }

  async function atualizarRespostaPlanilha(id: string, resposta_planilha: string) {
    setClientes(prev => prev.map(c => c.id === id ? { ...c, resposta_planilha: resposta_planilha || null } : c));
    await supabase.from("controle_clientes").update({ resposta_planilha: resposta_planilha || null }).eq("id", id);
  }

  async function atualizarProximaAnalise(id: string, valor: string, aid: string) {
    const proxima_analise = valor || null;
    setClientes(prev => prev.map(c => c.id === id ? { ...c, proxima_analise } : c));
    await supabase.from("escala_config").upsert(
      { agencia_id: aid, cliente_id: id, gestor_escala: gestorEscala, proxima_analise },
      { onConflict: "agencia_id,cliente_id,gestor_escala" }
    );
  }

  async function salvarAtualizacao(clienteId: string) {
    const texto = novaAtualizacao[clienteId]?.trim();
    if (!texto || !agenciaId) return;
    setSaving(prev => ({ ...prev, [clienteId]: true }));
    try {
      const { data } = await supabase
        .from("escala_atualizacoes")
        .insert({ agencia_id: agenciaId, cliente_id: clienteId, gestor, texto })
        .select("id, cliente_id, gestor, texto, created_at")
        .single();
      if (data) {
        setAtualizacoes(prev => ({
          ...prev,
          [clienteId]: [data, ...(prev[clienteId] || [])],
        }));
        setNovaAtualizacao(prev => ({ ...prev, [clienteId]: "" }));
      }
    } finally {
      setSaving(prev => ({ ...prev, [clienteId]: false }));
    }
  }

  // ── Drag & Drop ─────────────────────────────────────────────────────────────

  function onDragStart(id: string) { dragId.current = id; }

  function onDragOver(e: React.DragEvent, id: string) {
    e.preventDefault();
    setDragOver(id);
  }

  async function onDrop(targetId: string) {
    if (!agenciaId) return;
    const fromId = dragId.current;
    setDragOver(null);
    dragId.current = null;
    if (!fromId || fromId === targetId) return;
    const fromIdx = clientes.findIndex(c => c.id === fromId);
    const toIdx = clientes.findIndex(c => c.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const reordered = [...clientes];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const withOrder = reordered.map((c, i) => ({ ...c, escala_ordem: i }));
    setClientes(withOrder);
    for (const c of withOrder) {
      await supabase.from("escala_config").upsert(
        { agencia_id: agenciaId, cliente_id: c.id, gestor_escala: gestorEscala, escala_ordem: c.escala_ordem },
        { onConflict: "agencia_id,cliente_id,gestor_escala" }
      );
    }
  }

  // ── KPIs ────────────────────────────────────────────────────────────────────

  const total = clientes.length;
  const respostaSim = clientes.filter(c => c.resposta_planilha === "sim").length;
  const respostaParcial = clientes.filter(c => c.resposta_planilha === "parcialmente").length;
  const respostaNao = clientes.filter(c => !c.resposta_planilha || c.resposta_planilha === "nao").length;
  const pctResposta = total > 0 ? Math.round(((respostaSim + respostaParcial) / total) * 100) : 0;
  const totalUti = clientes.filter(c => c.uti).length;

  // ── Calendário ──────────────────────────────────────────────────────────────

  function celulasDoCal() {
    const primeirodia = new Date(calAno, calMes, 1).getDay();
    const diasNoMes = new Date(calAno, calMes + 1, 0).getDate();
    const cells: (number | null)[] = Array(primeirodia).fill(null);
    for (let d = 1; d <= diasNoMes; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }

  function clientesNoDia(dia: number) {
    const dateStr = `${calAno}-${String(calMes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    return clientes.filter(c => c.proxima_analise === dateStr);
  }

  const isHoje = (dia: number) =>
    calAno === hoje.getFullYear() && calMes === hoje.getMonth() && dia === hoje.getDate();

  const cells = celulasDoCal();

  // ── Styles ──────────────────────────────────────────────────────────────────

  const tabStyle = (active: boolean): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: "6px",
    padding: "8px 18px", borderRadius: "8px", cursor: "pointer",
    fontSize: "13px", fontWeight: "600", border: "none",
    background: active ? "var(--brand)" : "transparent",
    color: active ? "#FFFFFF" : "var(--text-secondary)",
    transition: "background 0.15s, color 0.15s",
  });

  const selectInline = (cor?: string): React.CSSProperties => ({
    background: "transparent", border: "none",
    color: cor || "#c0c0c0", fontSize: "12px", fontWeight: "500",
    cursor: "pointer", fontFamily: "inherit", outline: "none",
    padding: "0", maxWidth: "120px",
  });

  const GRID = "18px 1fr 100px 80px 130px 80px 100px 60px 80px 60px 54px 36px 20px";

  return (
    <div>
      {/* Abas */}
      <div style={{
        display: "flex", gap: "4px", marginBottom: "24px",
        background: "var(--card-bg)", border: "1px solid #2e2e2e",
        borderRadius: "10px", padding: "4px", width: "fit-content",
      }}>
        <button style={tabStyle(aba === "painel")} onClick={() => setAba("painel")}>
          <LayoutList size={14} /> Painel
        </button>
        <button style={tabStyle(aba === "calendario")} onClick={() => setAba("calendario")}>
          <CalendarDays size={14} /> Calendário
        </button>
      </div>

      {/* ── PAINEL ── */}
      {aba === "painel" && (
        <div style={{ marginBottom: "32px" }}>

          {/* KPIs */}
          <div style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap" }}>
            <div style={{ background: "var(--card-bg)", border: "1px solid #2a2a2a", borderRadius: "10px", padding: "14px 20px", minWidth: "130px" }}>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>Total de clientes</div>
              <div style={{ fontSize: "26px", fontWeight: "700", color: "var(--navy)", lineHeight: 1 }}>{total}</div>
            </div>

            <div style={{ background: "var(--card-bg)", border: "1px solid #2a2a2a", borderRadius: "10px", padding: "14px 20px", minWidth: "180px" }}>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>Resposta da planilha</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                <span style={{ fontSize: "26px", fontWeight: "700", color: "var(--navy)", lineHeight: 1 }}>{pctResposta}%</span>
                <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{respostaSim + respostaParcial}/{total}</span>
              </div>
              <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                <span style={{ fontSize: "11px", color: "var(--success)" }}>✓ Sim: {respostaSim}</span>
                <span style={{ fontSize: "11px", color: "var(--caution-text)" }}>~ Parcial: {respostaParcial}</span>
                <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>✗ Não: {respostaNao}</span>
              </div>
            </div>

            {totalUti > 0 && (
              <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "10px", padding: "14px 20px", minWidth: "120px" }}>
                <div style={{ fontSize: "11px", color: "#a05050", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>UTI</div>
                <div style={{ fontSize: "26px", fontWeight: "700", color: "var(--alert-text)", lineHeight: 1 }}>{totalUti}</div>
                <div style={{ fontSize: "11px", color: "#a05050", marginTop: "6px" }}>em atenção crítica</div>
              </div>
            )}
          </div>

          {/* Legenda de jornada */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
            {JORNADAS.map(j => (
              <div key={j.value} style={{
                background: j.bg, border: `1px solid ${j.cor}40`,
                borderLeft: `3px solid ${j.cor}`,
                borderRadius: "8px", padding: "8px 12px", minWidth: "140px", flex: "1 1 140px", maxWidth: "220px",
              }}>
                <div style={{ fontSize: "12px", fontWeight: "700", color: j.cor, marginBottom: "5px" }}>{j.label}</div>
                <ul style={{ margin: 0, padding: "0 0 0 14px", display: "flex", flexDirection: "column", gap: "2px" }}>
                  {j.descricao.map((d, i) => (
                    <li key={i} style={{ fontSize: "11px", color: "#909090", lineHeight: "1.4" }}>{d}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Título + subtítulo */}
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "8px" }}>
            <h2 style={{ fontSize: "16px", fontWeight: "600", color: "var(--navy)", margin: 0 }}>Painel de Clientes</h2>
            <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              {total} cliente{total !== 1 ? "s" : ""} · arraste para reordenar
            </span>
          </div>

          {/* Cabeçalho colunas */}
          <div style={{ display: "grid", gridTemplateColumns: GRID, gap: "10px", alignItems: "center", padding: "6px 14px", marginBottom: "4px" }}>
            <div />
            <div style={{ fontSize: "10px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Cliente</div>
            <div style={{ fontSize: "10px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Renovação</div>
            <div style={{ fontSize: "10px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Últ. atualiz.</div>
            <div style={{ fontSize: "10px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Jornada</div>
            <div style={{ fontSize: "10px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Prioridade</div>
            <div style={{ fontSize: "10px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Próx. análise</div>
            <div style={{ fontSize: "10px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Planilha</div>
            <div style={{ fontSize: "10px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Custo/ag.</div>
            <div style={{ fontSize: "10px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>ROAS</div>
            <div style={{ fontSize: "10px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Links</div>
            <div style={{ fontSize: "10px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>UTI</div>
            <div />
          </div>

          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}>Carregando...</div>
          ) : clientes.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)", background: "var(--card-bg)", border: "1px solid #2e2e2e", borderRadius: "10px" }}>
              Nenhum cliente encontrado.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {clientes.map(cliente => {
                const p = PRIO[cliente.prioridade || "Media"] || PRIO.Media;
                const log = atualizacoes[cliente.id] || [];
                const isDragTarget = dragOver === cliente.id;
                const isDragging = dragId.current === cliente.id;
                const aberto = !!expandido[cliente.id];

                const ultimaAtualizacao = log[0]?.created_at ? fmtDataCurta(log[0].created_at) : "—";
                const diasSemAtualizar = log[0]?.created_at
                  ? Math.floor((hoje.getTime() - new Date(log[0].created_at).getTime()) / 86400000)
                  : null;
                const alertaAtualizacao = diasSemAtualizar === null || diasSemAtualizar >= 7;

                const diffDias = cliente.proxima_analise
                  ? Math.ceil((new Date(cliente.proxima_analise + "T00:00:00").getTime() - hoje.getTime()) / 86400000)
                  : null;
                const corDiff = diffDias === null ? "var(--text-secondary)" : diffDias < 0 ? "var(--alert-text)" : diffDias <= 3 ? "var(--caution-text)" : "var(--text-secondary)";

                const resp = cliente.resposta_planilha ? RESPOSTA[cliente.resposta_planilha] : null;
                const performanceUrl = cliente.relatorio_id ? `/relatorios-meta/dashboard?id=${cliente.relatorio_id}&tab=performance` : null;
                const jAtual = JORNADAS.find(j => j.value === cliente.escala_jornada);

                return (
                  <div
                    key={cliente.id}
                    draggable
                    onDragStart={() => onDragStart(cliente.id)}
                    onDragOver={e => onDragOver(e, cliente.id)}
                    onDrop={() => onDrop(cliente.id)}
                    onDragEnd={() => { setDragOver(null); dragId.current = null; }}
                    style={{
                      background: isDragTarget ? "var(--hover-row)" : "var(--card-bg)",
                      border: "1px solid #2a2a2a",
                      borderLeft: `4px solid ${p.cor}`,
                      borderRadius: "8px",
                      opacity: isDragging ? 0.4 : 1,
                      transition: "opacity 0.15s, background 0.15s",
                      overflow: "hidden",
                    }}
                  >
                    {/* Linha sempre visível */}
                    <div
                      onClick={() => toggleExpandido(cliente.id)}
                      style={{ display: "grid", gridTemplateColumns: GRID, gap: "10px", alignItems: "center", padding: "10px 14px", cursor: "pointer", userSelect: "none" }}
                    >
                      <div style={{ cursor: "grab", color: "var(--border)" }} onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
                        <GripVertical size={14} />
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                        <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--navy)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {cliente.nome}
                        </span>
                        {alertaAtualizacao && (
                          <span
                            title={diasSemAtualizar === null ? "Sem atualizações" : `${diasSemAtualizar} dias sem atualização`}
                            style={{ fontSize: "13px", lineHeight: 1, flexShrink: 0 }}
                          >
                            ⚠️
                          </span>
                        )}
                        {log.length > 0 && <MessageSquare size={10} color="var(--border)" />}
                      </div>

                      <div><RenovacaoDisplay renovou={cliente.renovou} dataInicio={cliente.data_inicio_campanha} /></div>

                      <div style={{ fontSize: "12px", color: ultimaAtualizacao === "—" ? "var(--border)" : "var(--text-secondary)" }}>
                        {ultimaAtualizacao}
                      </div>

                      <div onClick={e => e.stopPropagation()}>
                        <select
                          value={cliente.escala_jornada || ""}
                          onChange={e => agenciaId && atualizarJornada(cliente.id, e.target.value, agenciaId)}
                          style={{ ...selectInline(jAtual?.cor), fontWeight: jAtual ? "600" : "400" }}
                        >
                          <option value="">— Fase —</option>
                          {JORNADAS.map(j => (
                            <option key={j.value} value={j.value} style={{ background: "var(--card-bg)", color: "var(--navy)" }}>{j.label}</option>
                          ))}
                        </select>
                      </div>

                      <div onClick={e => e.stopPropagation()}>
                        <select
                          value={cliente.prioridade || "Media"}
                          onChange={e => atualizarPrioridade(cliente.id, e.target.value)}
                          style={{ ...selectInline(p.cor), fontWeight: "600" }}
                        >
                          {PRIORIDADES.map(pr => (
                            <option key={pr} value={pr} style={{ background: "var(--card-bg)", color: "var(--navy)" }}>{PRIO[pr].label}</option>
                          ))}
                        </select>
                      </div>

                      <div onClick={e => e.stopPropagation()}>
                        <input
                          type="date"
                          value={cliente.proxima_analise || ""}
                          onChange={e => agenciaId && atualizarProximaAnalise(cliente.id, e.target.value, agenciaId)}
                          style={{ background: "transparent", border: "none", color: corDiff, fontSize: "12px", fontFamily: "inherit", cursor: "pointer", outline: "none", width: "100px", padding: 0 }}
                        />
                      </div>

                      <div onClick={e => e.stopPropagation()}>
                        <select
                          value={cliente.resposta_planilha || ""}
                          onChange={e => atualizarRespostaPlanilha(cliente.id, e.target.value)}
                          style={{ ...selectInline(resp?.cor), fontWeight: resp ? "600" : "400" }}
                        >
                          <option value="">—</option>
                          <option value="sim" style={{ background: "var(--card-bg)", color: "var(--navy)" }}>Sim</option>
                          <option value="parcialmente" style={{ background: "var(--card-bg)", color: "var(--navy)" }}>Parcial</option>
                          <option value="nao" style={{ background: "var(--card-bg)", color: "var(--navy)" }}>Não</option>
                        </select>
                      </div>

                      <div>
                        {cliente.custo_por_agendamento != null && cliente.custo_por_agendamento > 0 ? (() => {
                          const custo = cliente.custo_por_agendamento;
                          const cor = custo < 50 ? "var(--success)" : custo < 80 ? "var(--caution-text)" : "var(--alert-text)";
                          const bg = custo < 50 ? "var(--success-bg)" : custo < 80 ? "var(--caution-bg)" : "var(--alert-bg)";
                          return (
                            <span style={{ fontSize: "12px", fontWeight: "600", color: cor, background: bg, padding: "2px 7px", borderRadius: "5px", whiteSpace: "nowrap" }}>
                              R${custo.toFixed(0)}
                            </span>
                          );
                        })() : (
                          <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>—</span>
                        )}
                      </div>

                      <div>
                        {cliente.roas != null && cliente.roas > 0 ? (() => {
                          const roas = cliente.roas;
                          const cor = roas >= 3 ? "var(--success)" : roas >= 1.5 ? "var(--caution-text)" : "var(--alert-text)";
                          const bg = roas >= 3 ? "var(--success-bg)" : roas >= 1.5 ? "var(--caution-bg)" : "var(--alert-bg)";
                          return (
                            <span style={{ fontSize: "12px", fontWeight: "600", color: cor, background: bg, padding: "2px 7px", borderRadius: "5px", whiteSpace: "nowrap" }}>
                              {roas.toFixed(2)}x
                            </span>
                          );
                        })() : (
                          <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>—</span>
                        )}
                      </div>

                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }} onClick={e => e.stopPropagation()}>
                        {performanceUrl && (
                          <a href={performanceUrl} target="_blank" rel="noopener noreferrer" title="Performance"
                            style={{ color: "var(--text-secondary)", display: "flex", alignItems: "center", textDecoration: "none", padding: "3px", borderRadius: "4px" }}
                            onMouseEnter={e => (e.currentTarget.style.color = "var(--brand)")}
                            onMouseLeave={e => (e.currentTarget.style.color = "var(--text-secondary)")}>
                            <ExternalLink size={13} />
                          </a>
                        )}
                        {cliente.link_planilha && (
                          <a href={cliente.link_planilha} target="_blank" rel="noopener noreferrer" title="Planilha"
                            style={{ color: "var(--text-secondary)", display: "flex", alignItems: "center", textDecoration: "none", padding: "3px", borderRadius: "4px" }}
                            onMouseEnter={e => (e.currentTarget.style.color = "var(--success)")}
                            onMouseLeave={e => (e.currentTarget.style.color = "var(--text-secondary)")}>
                            <FileSpreadsheet size={13} />
                          </a>
                        )}
                      </div>

                      <div onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => toggleUti(cliente.id, cliente.uti)}
                          title={cliente.uti ? "Remover da UTI" : "Colocar na UTI (Urgente)"}
                          style={{
                            background: cliente.uti ? "rgba(239,68,68,0.18)" : "transparent",
                            border: `1px solid ${cliente.uti ? "var(--alert-text)" : "var(--border)"}`,
                            borderRadius: "5px", padding: "2px 6px", cursor: "pointer",
                            fontSize: "10px", fontWeight: "700",
                            color: cliente.uti ? "var(--alert-text)" : "var(--text-secondary)",
                            transition: "all 0.15s",
                          }}
                        >
                          UTI
                        </button>
                      </div>

                      <span style={{ color: "var(--text-secondary)", fontSize: "11px", textAlign: "center" }}>
                        {aberto ? "▲" : "▼"}
                      </span>
                    </div>

                    {/* Expandido: apenas atualizações */}
                    {aberto && (
                      <div style={{ padding: "0 14px 14px 44px", borderTop: "1px solid #242424" }}>
                        <div style={{ paddingTop: "12px", marginBottom: "12px" }}>
                          <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>O que foi feito hoje</div>
                          <div style={{ display: "flex", gap: "6px", alignItems: "flex-end" }}>
                            <textarea
                              value={novaAtualizacao[cliente.id] || ""}
                              onChange={e => setNovaAtualizacao(prev => ({ ...prev, [cliente.id]: e.target.value }))}
                              onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) salvarAtualizacao(cliente.id); }}
                              onClick={e => e.stopPropagation()}
                              placeholder="Digite aqui… (Ctrl+Enter para salvar)"
                              rows={2}
                              style={{ flex: 1, background: "#111", border: "1px solid #2e2e2e", borderRadius: "6px", color: "var(--navy)", fontSize: "13px", padding: "7px 10px", resize: "none", fontFamily: "inherit", outline: "none", lineHeight: "1.5" }}
                            />
                            <button
                              onClick={e => { e.stopPropagation(); salvarAtualizacao(cliente.id); }}
                              disabled={saving[cliente.id] || !novaAtualizacao[cliente.id]?.trim()}
                              style={{ background: "var(--brand)", color: "#FFFFFF", border: "none", borderRadius: "6px", padding: "7px 16px", cursor: "pointer", fontSize: "12px", fontWeight: "700", whiteSpace: "nowrap", opacity: (saving[cliente.id] || !novaAtualizacao[cliente.id]?.trim()) ? 0.35 : 1 }}
                            >
                              {saving[cliente.id] ? "…" : "Salvar"}
                            </button>
                          </div>
                        </div>

                        {log.length > 0 && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <div style={{ fontSize: "10px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Histórico</div>
                            {log.slice(0, 5).map(a => (
                              <div key={a.id} style={{ display: "flex", gap: "10px", alignItems: "flex-start", padding: "8px 10px", background: "var(--hover-row)", borderRadius: "6px", border: "1px solid var(--border)" }}>
                                <span style={{ fontSize: "10px", color: "var(--text-secondary)", whiteSpace: "nowrap", marginTop: "2px", flexShrink: 0 }}>
                                  {new Date(a.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                                </span>
                                <span style={{ fontSize: "10px", color: "var(--text-secondary)", whiteSpace: "nowrap", marginTop: "2px", flexShrink: 0, fontStyle: "italic" }}>
                                  {a.gestor?.split(" ")[0]}
                                </span>
                                <span style={{ fontSize: "13px", color: "#c8c8c8", lineHeight: "1.45" }}>{a.texto}</span>
                              </div>
                            ))}
                            {log.length > 5 && (
                              <button onClick={e => { e.stopPropagation(); setLogAberto(cliente.id); }}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--brand)", fontSize: "12px", padding: "2px 0", textAlign: "left" }}>
                                Ver todos ({log.length})
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── CALENDÁRIO ── */}
      {aba === "calendario" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h2 style={{ fontSize: "16px", fontWeight: "600", color: "var(--navy)", margin: 0 }}>Calendário de Análises</h2>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button onClick={() => { if (calMes === 0) { setCalMes(11); setCalAno(calAno - 1); } else setCalMes(calMes - 1); }}
                style={{ background: "#252525", border: "1px solid #383838", borderRadius: "6px", width: "32px", height: "32px", cursor: "pointer", color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontSize: "15px", fontWeight: "600", color: "var(--navy)", minWidth: "160px", textAlign: "center" }}>
                {MESES_CAL[calMes]} {calAno}
              </span>
              <button onClick={() => { if (calMes === 11) { setCalMes(0); setCalAno(calAno + 1); } else setCalMes(calMes + 1); }}
                style={{ background: "#252525", border: "1px solid #383838", borderRadius: "6px", width: "32px", height: "32px", cursor: "pointer", color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div style={{ background: "var(--card-bg)", border: "2px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "2px solid var(--border)", background: "var(--hover-row)" }}>
              {DIAS_SEMANA.map((d, i) => (
                <div key={d} style={{ padding: "12px 0", textAlign: "center", fontSize: "11px", fontWeight: "700", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", borderRight: i < 6 ? "1px solid var(--border)" : "none" }}>
                  {d}
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
              {cells.map((dia, idx) => {
                const clientesDia = dia ? clientesNoDia(dia) : [];
                const ehHoje = dia ? isHoje(dia) : false;
                const isLastRow = idx >= cells.length - 7;
                const isLastCol = (idx + 1) % 7 === 0;
                const colIdx = idx % 7;
                const fimSemana = colIdx === 0 || colIdx === 6;
                return (
                  <div key={idx} style={{ minHeight: "320px", padding: "10px", borderRight: !isLastCol ? "1px solid var(--border)" : "none", borderBottom: !isLastRow ? "1px solid var(--border)" : "none", background: ehHoje ? "rgba(28,108,166,0.06)" : fimSemana ? "var(--hover-row)" : "transparent" }}>
                    {dia && (
                      <>
                        <div style={{ fontSize: "13px", fontWeight: "600", marginBottom: "8px", width: "26px", height: "26px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", ...(ehHoje ? { background: "var(--brand)", color: "#FFFFFF" } : { color: "var(--text-secondary)" }) }}>
                          {dia}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          {clientesDia.map(c => {
                            const p = PRIO[c.prioridade || "Media"] || PRIO.Media;
                            return (
                              <div key={c.id} title={c.nome} style={{ fontSize: "11px", padding: "4px 8px", borderRadius: "5px", background: p.bg, color: p.cor, fontWeight: "500", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {c.nome}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal histórico */}
      {logAberto && (
        <div className="modal-overlay" onClick={() => setLogAberto(null)}>
          <div className="modal animate-in" onClick={e => e.stopPropagation()} style={{ maxWidth: "520px", maxHeight: "75vh", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexShrink: 0 }}>
              <h2 style={{ fontSize: "16px", fontWeight: "600", color: "var(--navy)", margin: 0 }}>
                Histórico — {clientes.find(c => c.id === logAberto)?.nome}
              </h2>
              <button onClick={() => setLogAberto(null)} className="btn-ghost" style={{ padding: "4px" }}><X size={18} /></button>
            </div>
            <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
              {(atualizacoes[logAberto] || []).map(a => (
                <div key={a.id} style={{ background: "var(--hover-row)", borderRadius: "8px", padding: "10px 14px", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: "13px", color: "var(--navy)", marginBottom: "6px", lineHeight: "1.5" }}>{a.texto}</div>
                  <div style={{ display: "flex", gap: "8px", fontSize: "11px", color: "var(--text-secondary)" }}>
                    <span>{new Date(a.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                    <span>· {a.gestor}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
