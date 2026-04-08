"use client";

import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import PeriodSelector from "@/components/ui/PeriodSelector";
import KPICard from "@/components/ui/KPICard";
import { supabase, getAgenciaId } from "@/lib/hooks";
import {
  MessageCircle, Eye, EyeOff, Percent, TrendingUp, Link, Users,
  Mail, Clock, Star, Flame,
} from "lucide-react";

const tooltipStyle = {
  background: "#1e1e1e",
  border: "1px solid #2e2e2e",
  borderRadius: "8px",
  fontSize: "12px",
  color: "#f0f0f0",
};

const ORIGEM_COLORS: Record<string, string> = {
  "Meta Ads": "#3b82f6",
  "Google Ads": "#22c55e",
  "Link": "#f59e0b",
  "Não Rastreada": "#606060",
};

interface Conversa {
  id: string;
  contato_nome: string | null;
  contato_numero: string | null;
  origem: string | null;
  etapa_jornada: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  link_nome: string | null;
  nome_anuncio: string | null;
  fbclid: string | null;
  created_at: string;
  ultima_mensagem_at: string | null;
  primeira_mensagem_at: string | null;
  etapa_alterada_at: string | null;
  agendou_at: string | null;
  nao_lidas: number | null;
}

interface Etapa {
  id: string;
  nome: string;
  ordem: number;
}

export default function InboxDashboardPage() {
  const hoje = new Date();
  const [from, setFrom] = useState(
    new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split("T")[0]
  );
  const [to, setTo] = useState(
    new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split("T")[0]
  );
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [historico, setHistorico] = useState<{conversa_id: string; etapa_nova: string; created_at: string}[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const agId = await getAgenciaId();
      if (!agId) { setLoading(false); return; }

      const [convRes, etpRes, histRes] = await Promise.all([
        supabase
          .from("conversas")
          .select("*")
          .eq("agencia_id", agId)
          .order("created_at", { ascending: false }),
        supabase
          .from("jornada_etapas")
          .select("*")
          .eq("agencia_id", agId)
          .order("ordem"),
        supabase
          .from("etapas_historico")
          .select("conversa_id, etapa_nova, created_at")
          .eq("agencia_id", agId),
      ]);

      setConversas(convRes.data ?? []);
      setEtapas(etpRes.data ?? []);
      setHistorico(histRes.data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  // Converter timestamp para data local YYYY-MM-DD
  const toLocalDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  };

  const isAgendou = (e: string) => /agend|reuni/i.test(e);
  const isCompareceu = (e: string) => /comparec|realiz/i.test(e);
  const isFechou = (e: string) => /comprou|fechou|ganho|vend/i.test(e);

  // ── NOVOS CONTATOS: primeira mensagem dentro do período ──
  const novos = conversas.filter((c) => {
    const ref = c.primeira_mensagem_at || c.created_at;
    const d = toLocalDate(ref);
    return d >= from && d <= to;
  });

  // IDs dos novos para lookup rápido
  const novosIds = new Set(novos.map(c => c.id));

  // ── Transições de etapa no período (deduplicadas) ──
  const transicoesRaw = historico.filter((h) => {
    const d = toLocalDate(h.created_at);
    return d >= from && d <= to;
  });
  const dedup = new Map<string, typeof transicoesRaw[0]>();
  transicoesRaw.forEach((h) => {
    const key = `${h.conversa_id}_${h.etapa_nova}`;
    const existing = dedup.get(key);
    if (!existing || h.created_at > existing.created_at) dedup.set(key, h);
  });
  const transicoesNoPeriodo = Array.from(dedup.values());

  // ── RETORNOS: contatos antigos que avançaram no funil NESTE período ──
  const retornoIds = new Set<string>();
  transicoesNoPeriodo.forEach((h) => {
    if (!novosIds.has(h.conversa_id) && (isAgendou(h.etapa_nova) || isCompareceu(h.etapa_nova) || isFechou(h.etapa_nova))) {
      retornoIds.add(h.conversa_id);
    }
  });
  const retornos = conversas.filter((c) => retornoIds.has(c.id));

  // ── Helpers de KPI por lista ──
  const calcKPIs = (lista: Conversa[]) => {
    const total = lista.length;
    const rastreadas = lista.filter(c => c.origem && c.origem !== "Não Rastreada").length;
    const naoRastreadas = total - rastreadas;
    const metaAds = lista.filter(c => c.origem === "Meta Ads").length;
    const googleAds = lista.filter(c => c.origem === "Google Ads").length;
    const linkRastreavel = lista.filter(c => c.link_nome && c.link_nome.trim() !== "").length;
    const organicas = lista.filter(c => (!c.origem || c.origem === "Não Rastreada") && !c.fbclid).length;
    return { total, rastreadas, naoRastreadas, metaAds, googleAds, linkRastreavel, organicas };
  };

  const kpiNovos = calcKPIs(novos);
  const kpiRetornos = calcKPIs(retornos);

  // ── Funil separado: novos vs retornos ──
  const transicoesNovos = transicoesNoPeriodo.filter(h => novosIds.has(h.conversa_id));
  const transicoesRetornos = transicoesNoPeriodo.filter(h => retornoIds.has(h.conversa_id));

  const calcFunil = (transicoes: typeof transicoesNoPeriodo, totalBase: number) => {
    const agendados = transicoes.filter(h => isAgendou(h.etapa_nova)).length;
    const compareceram = transicoes.filter(h => isCompareceu(h.etapa_nova)).length;
    const fecharam = transicoes.filter(h => isFechou(h.etapa_nova)).length;
    const pctAgend = totalBase > 0 ? ((agendados / totalBase) * 100).toFixed(1) : "0.0";
    const pctComp = agendados > 0 ? ((compareceram / agendados) * 100).toFixed(1) : "0.0";
    const pctVenda = compareceram > 0 ? ((fecharam / compareceram) * 100).toFixed(1) : "0.0";
    return { agendados, compareceram, fecharam, pctAgend, pctComp, pctVenda, total: totalBase };
  };

  const funilNovos = calcFunil(transicoesNovos, kpiNovos.total);
  const funilRetornos = calcFunil(transicoesRetornos, kpiRetornos.total);
  const funilTotal = calcFunil(transicoesNoPeriodo, kpiNovos.total + kpiRetornos.total);

  // Total combinado
  const totalGeral = kpiNovos.total + kpiRetornos.total;

  // ── KPI Row 3 ──
  const naoLidas = novos.reduce((sum, c) => sum + (c.nao_lidas || 0), 0);
  const naJornada = novos.filter(
    (c) => c.etapa_jornada && c.etapa_jornada.trim() !== ""
  ).length;
  const campanhasAtivas = new Set(
    novos.filter((c) => c.utm_campaign).map((c) => c.utm_campaign)
  ).size;

  // ── Chart: Novos por dia (stacked) ──
  const dayMap: Record<string, Record<string, number>> = {};
  novos.forEach((c) => {
    const ref = c.primeira_mensagem_at || c.created_at;
    const day = ref.split("T")[0];
    if (!dayMap[day]) dayMap[day] = { "Meta Ads": 0, "Google Ads": 0, Link: 0, "Não Rastreada": 0 };
    if (c.origem === "Meta Ads") dayMap[day]["Meta Ads"]++;
    else if (c.origem === "Google Ads") dayMap[day]["Google Ads"]++;
    else if (c.link_nome && c.link_nome.trim() !== "") dayMap[day]["Link"]++;
    else dayMap[day]["Não Rastreada"]++;
  });
  const barDia = Object.entries(dayMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, counts]) => ({
      dia: day.split("-").reverse().slice(0, 2).join("/"),
      ...counts,
    }));

  // ── Chart: Origem (pie) — novos ──
  const pieData = [
    { name: "Meta Ads", value: kpiNovos.metaAds },
    { name: "Google Ads", value: kpiNovos.googleAds },
    { name: "Link Rastreável", value: kpiNovos.linkRastreavel },
    { name: "Não Rastreada", value: kpiNovos.naoRastreadas },
  ].filter((d) => d.value > 0);
  const pieTotal = pieData.reduce((s, d) => s + d.value, 0);

  // ── Funil da Jornada ──
  const etapasReais = Array.from(new Set(transicoesNoPeriodo.map(h => h.etapa_nova).filter(Boolean)));
  const etapasConfig = etapas.map(e => e.nome);
  const etapasFunil = [...etapasConfig, ...etapasReais.filter(e => !etapasConfig.includes(e))];
  const funilData = etapasFunil.map((nome) => {
    const novosCount = transicoesNovos.filter(h => h.etapa_nova === nome).length;
    const retornosCount = transicoesRetornos.filter(h => h.etapa_nova === nome).length;
    return { nome, novos: novosCount, retornos: retornosCount, count: novosCount + retornosCount };
  }).filter(d => d.count > 0);
  const funilMax = Math.max(...funilData.map((d) => d.count), 1);

  // ── Top Campanhas (novos) ──
  const campMap: Record<string, number> = {};
  novos.forEach((c) => {
    const key = c.utm_campaign || "";
    if (key) campMap[key] = (campMap[key] || 0) + 1;
  });
  const topCampanhas = Object.entries(campMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([name, value]) => ({ name, value }));

  // ── Top Anúncios (novos) ──
  const anuncioMap: Record<string, number> = {};
  novos.forEach((c) => {
    const key = c.nome_anuncio || "";
    if (key) anuncioMap[key] = (anuncioMap[key] || 0) + 1;
  });
  const topAnuncios = Object.entries(anuncioMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([name, value]) => ({ name, value }));

  // ── Tabela Campanha x Etapa (novos) ──
  const distinctCampaigns = Array.from(
    new Set(novos.map((c) => c.utm_campaign || "Sem campanha"))
  ).sort((a, b) => {
    if (a === "Sem campanha") return 1;
    if (b === "Sem campanha") return -1;
    return a.localeCompare(b);
  });

  const tabelaData = distinctCampaigns.map((camp) => {
    const rows = novos.filter(
      (c) => (c.utm_campaign || "Sem campanha") === camp
    );
    const porEtapa = etapas.map(
      (et) => rows.filter((c) => c.etapa_jornada === et.nome).length
    );
    return { campaign: camp, porEtapa, total: rows.length };
  });

  if (loading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "40px", height: "40px", borderRadius: "50%", border: "3px solid #2e2e2e", borderTop: "3px solid #29ABE2", animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="animate-in">
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <a href="/">Início</a><span>›</span>
        <a href="/inbox">Inbox</a><span>›</span>
        <span className="current">Dashboard</span>
      </div>
      <h1 style={{ fontSize: "22px", fontWeight: "600", marginBottom: "24px" }}>
        Dashboard do Inbox
      </h1>

      <PeriodSelector onChange={(_, f, t) => { setFrom(f); setTo(t); }} />

      {/* ══════════════════════════════════════════════════ */}
      {/* ── SEÇÃO 1: NOVOS CONTATOS DO PERÍODO ── */}
      {/* ══════════════════════════════════════════════════ */}
      <div style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "16px", color: "#29ABE2", display: "flex", alignItems: "center", gap: "8px" }}>
          <MessageCircle size={18} /> Novos Contatos no Período
          <span style={{ fontSize: "12px", fontWeight: "400", color: "#606060" }}>(primeira mensagem no período)</span>
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "16px", marginBottom: "16px" }}>
          <KPICard label="Novos Contatos" value={kpiNovos.total} icon={<MessageCircle size={16} />} iconBg="blue" />
          <KPICard label="Rastreados" value={kpiNovos.rastreadas} icon={<Eye size={16} />} iconBg="green" />
          <KPICard label="Não Rastreados" value={kpiNovos.naoRastreadas} icon={<EyeOff size={16} />} iconBg="red" />
          <KPICard label="Taxa Rastreamento" value={`${kpiNovos.total > 0 ? ((kpiNovos.rastreadas / kpiNovos.total) * 100).toFixed(1) : "0.0"}%`} icon={<Percent size={16} />} iconBg="amber" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "16px", marginBottom: "16px" }}>
          <KPICard label="Meta Ads" value={kpiNovos.metaAds} icon={<TrendingUp size={16} />} iconBg="blue" />
          <KPICard label="Google Ads" value={kpiNovos.googleAds} icon={<TrendingUp size={16} />} iconBg="green" />
          <KPICard label="Link Rastreável" value={kpiNovos.linkRastreavel} icon={<Link size={16} />} iconBg="amber" />
          <KPICard label="Orgânicas" value={kpiNovos.organicas} icon={<Users size={16} />} iconBg="red" />
        </div>

        {/* Funil dos Novos */}
        <div className="card" style={{ marginBottom: "16px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: "500", marginBottom: "16px" }}>Funil dos Novos Contatos</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 0, marginBottom: "16px", borderBottom: "1px solid #2e2e2e", paddingBottom: "16px" }}>
            {[
              { label: "Leads → Agendamentos", value: `${funilNovos.pctAgend}%` },
              { label: "Agendados → Compareceram", value: `${funilNovos.pctComp}%` },
              { label: "Compareceram → Vendas", value: `${funilNovos.pctVenda}%` },
            ].map((item, i) => (
              <div key={i} style={{ textAlign: "center", padding: "0 16px", borderRight: i < 2 ? "1px solid #2e2e2e" : "none" }}>
                <p style={{ fontSize: "12px", color: "#606060", marginBottom: "6px" }}>{item.label}</p>
                <p style={{ fontSize: "22px", fontWeight: "700", color: item.value === "0.0%" ? "#404040" : "#22c55e" }}>{item.value}</p>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px" }}>
            {[
              { label: "Novos Contatos", value: funilNovos.total },
              { label: "Agendados", value: funilNovos.agendados },
              { label: "Compareceram", value: funilNovos.compareceram },
              { label: "Fechadas", value: funilNovos.fecharam },
            ].map((item) => (
              <div key={item.label} style={{ background: "#1a1a1a", borderRadius: "8px", padding: "14px 16px" }}>
                <p style={{ fontSize: "12px", color: "#606060", marginBottom: "6px" }}>{item.label}</p>
                <p style={{ fontSize: "20px", fontWeight: "700", color: item.value > 0 ? "#f0f0f0" : "#404040" }}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════ */}
      {/* ── SEÇÃO 2: RETORNOS (contatos antigos que avançaram) ── */}
      {/* ══════════════════════════════════════════════════ */}
      {retornos.length > 0 && (
        <div style={{ marginBottom: "32px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "16px", color: "#f59e0b", display: "flex", alignItems: "center", gap: "8px" }}>
            <TrendingUp size={18} /> Retornos de Meses Anteriores
            <span style={{ fontSize: "12px", fontWeight: "400", color: "#606060" }}>(contatos antigos que agendaram/compareceram/fecharam neste período)</span>
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "16px", marginBottom: "16px" }}>
            <KPICard label="Retornos" value={kpiRetornos.total} icon={<TrendingUp size={16} />} iconBg="amber" />
            <KPICard label="Agendados" value={funilRetornos.agendados} icon={<Star size={16} />} iconBg="blue" />
            <KPICard label="Compareceram" value={funilRetornos.compareceram} icon={<Eye size={16} />} iconBg="green" />
            <KPICard label="Fecharam" value={funilRetornos.fecharam} icon={<Flame size={16} />} iconBg="red" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "16px", marginBottom: "16px" }}>
            <KPICard label="Meta Ads" value={kpiRetornos.metaAds} icon={<TrendingUp size={16} />} iconBg="blue" />
            <KPICard label="Google Ads" value={kpiRetornos.googleAds} icon={<TrendingUp size={16} />} iconBg="green" />
            <KPICard label="Link Rastreável" value={kpiRetornos.linkRastreavel} icon={<Link size={16} />} iconBg="amber" />
            <KPICard label="Orgânicas" value={kpiRetornos.organicas} icon={<Users size={16} />} iconBg="red" />
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* ── SEÇÃO 3: TOTAL GERAL ── */}
      {/* ══════════════════════════════════════════════════ */}
      <div style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "16px", color: "#22c55e", display: "flex", alignItems: "center", gap: "8px" }}>
          <Flame size={18} /> Total Geral do Período
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "16px", marginBottom: "16px" }}>
          <KPICard label="Total (Novos + Retornos)" value={totalGeral} icon={<MessageCircle size={16} />} iconBg="green" />
          <KPICard label="Agendados (Total)" value={funilTotal.agendados} icon={<Star size={16} />} iconBg="blue" />
          <KPICard label="Compareceram (Total)" value={funilTotal.compareceram} icon={<Eye size={16} />} iconBg="green" />
          <KPICard label="Fecharam (Total)" value={funilTotal.fecharam} icon={<Flame size={16} />} iconBg="amber" />
        </div>

        {/* Funil Total */}
        <div className="card" style={{ marginBottom: "16px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: "500", marginBottom: "16px" }}>Funil Total (Novos + Retornos)</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 0, marginBottom: "16px", borderBottom: "1px solid #2e2e2e", paddingBottom: "16px" }}>
            {[
              { label: "Leads → Agendamentos", value: `${funilTotal.pctAgend}%` },
              { label: "Agendados → Compareceram", value: `${funilTotal.pctComp}%` },
              { label: "Compareceram → Vendas", value: `${funilTotal.pctVenda}%` },
            ].map((item, i) => (
              <div key={i} style={{ textAlign: "center", padding: "0 16px", borderRight: i < 2 ? "1px solid #2e2e2e" : "none" }}>
                <p style={{ fontSize: "12px", color: "#606060", marginBottom: "6px" }}>{item.label}</p>
                <p style={{ fontSize: "22px", fontWeight: "700", color: item.value === "0.0%" ? "#404040" : "#22c55e" }}>{item.value}</p>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px" }}>
            {[
              { label: "Total Conversas", value: totalGeral },
              { label: "Agendados", value: funilTotal.agendados },
              { label: "Compareceram", value: funilTotal.compareceram },
              { label: "Fechadas", value: funilTotal.fecharam },
            ].map((item) => (
              <div key={item.label} style={{ background: "#1a1a1a", borderRadius: "8px", padding: "14px 16px" }}>
                <p style={{ fontSize: "12px", color: "#606060", marginBottom: "6px" }}>{item.label}</p>
                <p style={{ fontSize: "20px", fontWeight: "700", color: item.value > 0 ? "#f0f0f0" : "#404040" }}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── KPI extras ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "16px", marginBottom: "28px" }}>
        <KPICard label="Mensagens não lidas" value={naoLidas} icon={<Mail size={16} />} iconBg="red" />
        <KPICard label="Tempo médio resposta" value="—" icon={<Clock size={16} />} iconBg="blue" />
        <KPICard label="Conversas na Jornada" value={naJornada} icon={<Star size={16} />} iconBg="green" />
        <KPICard label="Campanhas ativas" value={campanhasAtivas} icon={<Flame size={16} />} iconBg="amber" />
      </div>

      {/* ── Sem dados ── */}
      {totalGeral === 0 && (
        <div style={{ background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: "12px", padding: "32px", textAlign: "center", marginBottom: "20px" }}>
          <p style={{ color: "#606060", fontSize: "14px" }}>Nenhuma conversa encontrada no período selecionado.</p>
        </div>
      )}

      {/* ── Charts Row 1: Bar + Pie ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
        <div className="card">
          <h3 style={{ fontSize: "14px", fontWeight: "500", marginBottom: "20px" }}>Conversas por dia</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barDia}>
              <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "#606060" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#606060" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="Meta Ads" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Google Ads" stackId="a" fill="#22c55e" />
              <Bar dataKey="Link" stackId="a" fill="#f59e0b" />
              <Bar dataKey="Não Rastreada" stackId="a" fill="#606060" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: "16px", justifyContent: "center", marginTop: "12px" }}>
            {Object.entries(ORIGEM_COLORS).map(([label, color]) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "2px", background: color }} />
                <span style={{ fontSize: "11px", color: "#a0a0a0" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: "14px", fontWeight: "500", marginBottom: "20px" }}>Origem das Conversas</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value }) =>
                    `${name} ${((value / pieTotal) * 100).toFixed(0)}%`
                  }
                >
                  {pieData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={
                        entry.name === "Meta Ads" ? "#3b82f6"
                        : entry.name === "Google Ads" ? "#22c55e"
                        : entry.name === "Link Rastreável" ? "#f59e0b"
                        : "#606060"
                      }
                    />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <p style={{ color: "#606060", fontSize: "13px" }}>Sem dados</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Funil da Jornada ── */}
      {etapas.length > 0 && (
        <div className="card" style={{ marginBottom: "20px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: "500", marginBottom: "20px" }}>Funil da Jornada (Novos + Retornos)</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {funilData.map((item, idx) => {
              const widthPct = funilMax > 0 ? Math.max((item.count / funilMax) * 100, 4) : 4;
              const novosPct = item.count > 0 ? (item.novos / item.count) * 100 : 100;
              return (
                <div key={item.nome} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "12px", color: "#a0a0a0", width: "140px", textAlign: "right", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.nome}
                  </span>
                  <div style={{ flex: 1, position: "relative" }}>
                    <div
                      style={{
                        height: "32px",
                        width: `${widthPct}%`,
                        background: `linear-gradient(to right, #29ABE2 ${novosPct}%, #f59e0b ${novosPct}%)`,
                        borderRadius: "6px",
                        display: "flex",
                        alignItems: "center",
                        paddingLeft: "12px",
                        transition: "width 0.4s ease",
                        minWidth: "40px",
                        gap: "6px",
                      }}
                    >
                      <span style={{ fontSize: "12px", fontWeight: "600", color: "#f0f0f0" }}>
                        {item.count}
                      </span>
                      {item.retornos > 0 && (
                        <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.7)" }}>
                          ({item.novos}N + {item.retornos}R)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: "16px", justifyContent: "center", marginTop: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "10px", height: "10px", borderRadius: "2px", background: "#29ABE2" }} />
              <span style={{ fontSize: "11px", color: "#a0a0a0" }}>Novos</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "10px", height: "10px", borderRadius: "2px", background: "#f59e0b" }} />
              <span style={{ fontSize: "11px", color: "#a0a0a0" }}>Retornos</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Charts Row 2: Top Campanhas + Top Anúncios ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
        <div className="card">
          <h3 style={{ fontSize: "14px", fontWeight: "500", marginBottom: "20px" }}>Top Campanhas</h3>
          {topCampanhas.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(topCampanhas.length * 36, 120)}>
              <BarChart data={topCampanhas} layout="vertical" margin={{ left: 10, right: 20 }}>
                <XAxis type="number" tick={{ fontSize: 11, fill: "#606060" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#a0a0a0" }}
                  axisLine={false}
                  tickLine={false}
                  width={160}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" fill="#29ABE2" radius={[0, 4, 4, 0]} name="Conversas" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <p style={{ color: "#606060", fontSize: "13px" }}>Sem campanhas no período</p>
            </div>
          )}
        </div>

        <div className="card">
          <h3 style={{ fontSize: "14px", fontWeight: "500", marginBottom: "20px" }}>Top Anúncios</h3>
          {topAnuncios.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(topAnuncios.length * 36, 120)}>
              <BarChart data={topAnuncios} layout="vertical" margin={{ left: 10, right: 20 }}>
                <XAxis type="number" tick={{ fontSize: 11, fill: "#606060" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#a0a0a0" }}
                  axisLine={false}
                  tickLine={false}
                  width={160}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" fill="#22c55e" radius={[0, 4, 4, 0]} name="Conversas" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <p style={{ color: "#606060", fontSize: "13px" }}>Sem anúncios no período</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Tabela: Conversas por Campanha e Etapa ── */}
      {etapas.length > 0 && (
        <div className="card">
          <h3 style={{ fontSize: "14px", fontWeight: "500", marginBottom: "16px" }}>
            Conversas por Campanha e Etapa
          </h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontSize: "11px", color: "#606060", fontWeight: "600", textTransform: "uppercase", borderBottom: "1px solid #2e2e2e" }}>
                    CAMPANHA
                  </th>
                  {etapas.map((et) => (
                    <th key={et.id} style={{ padding: "10px", textAlign: "center", fontSize: "11px", color: "#606060", fontWeight: "600", textTransform: "uppercase", borderBottom: "1px solid #2e2e2e", whiteSpace: "nowrap" }}>
                      {et.nome.toUpperCase()}
                    </th>
                  ))}
                  <th style={{ padding: "10px", textAlign: "center", fontSize: "11px", color: "#606060", fontWeight: "600", textTransform: "uppercase", borderBottom: "1px solid #2e2e2e" }}>
                    TOTAL
                  </th>
                </tr>
              </thead>
              <tbody>
                {tabelaData.map((row) => (
                  <tr key={row.campaign} style={{ borderBottom: "1px solid #2e2e2e" }}>
                    <td style={{ padding: "10px 14px", fontSize: "13px", fontWeight: "500", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {row.campaign}
                    </td>
                    {row.porEtapa.map((v, i) => (
                      <td key={i} style={{ padding: "10px", textAlign: "center", fontSize: "13px", color: v > 0 ? "#29ABE2" : "#404040" }}>
                        {v}
                      </td>
                    ))}
                    <td style={{ padding: "10px", textAlign: "center", fontSize: "13px", fontWeight: "600", color: row.total > 0 ? "#f0f0f0" : "#404040" }}>
                      {row.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
