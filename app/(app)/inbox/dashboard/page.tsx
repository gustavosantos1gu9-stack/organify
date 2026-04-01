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
  const [historico, setHistorico] = useState<{etapa_nova: string; created_at: string}[]>([]);
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
          .select("etapa_nova, created_at")
          .eq("agencia_id", agId),
      ]);

      setConversas(convRes.data ?? []);
      setEtapas(etpRes.data ?? []);
      setHistorico(histRes.data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  // Filter by period — conversas criadas no período
  const cf = conversas.filter((c) => {
    const d = c.created_at.split("T")[0];
    return d >= from && d <= to;
  });

  // Transições de etapa que aconteceram no período (do histórico)
  const transicoesNoPeriodo = historico.filter((h) => {
    const d = h.created_at.split("T")[0];
    return d >= from && d <= to;
  });

  // ── KPI Row 1 ──
  const total = cf.length;
  const rastreadas = cf.filter(
    (c) => c.origem && c.origem !== "Não Rastreada"
  ).length;
  const naoRastreadas = total - rastreadas;
  const taxaRastreamento = total > 0 ? ((rastreadas / total) * 100).toFixed(1) : "0.0";

  // ── KPI Row 2 ──
  const metaAds = cf.filter((c) => c.origem === "Meta Ads").length;
  const googleAds = cf.filter((c) => c.origem === "Google Ads").length;
  const linkRastreavel = cf.filter((c) => c.link_nome && c.link_nome.trim() !== "").length;
  const organicas = cf.filter(
    (c) => (!c.origem || c.origem === "Não Rastreada") && !c.fbclid
  ).length;

  // ── KPI Row 3 ──
  const naoLidas = cf.reduce((sum, c) => sum + (c.nao_lidas || 0), 0);
  const naJornada = cf.filter(
    (c) => c.etapa_jornada && c.etapa_jornada.trim() !== ""
  ).length;
  const campanhasAtivas = new Set(
    cf.filter((c) => c.utm_campaign).map((c) => c.utm_campaign)
  ).size;

  // ── Funil de Conversão ──
  // Detectar etapas do funil diretamente pelo nome da etapa_jornada nas conversas
  const isAgendou = (e: string) => /agend|reuni/i.test(e);
  const isCompareceu = (e: string) => /comparec|realiz/i.test(e);
  const isFechou = (e: string) => /comprou|fechou|ganho|vend/i.test(e);

  // Todas etapas conhecidas: da jornada configurada + das conversas reais
  const todasEtapas = [...etapas.map(e => e.nome), ...Array.from(new Set(cf.map(c => c.etapa_jornada).filter(Boolean) as string[]))];
  const etapasUnicas = Array.from(new Set(todasEtapas));

  // Ordenar: usar ordem da jornada se existir, senão por detecção de funil
  const ordemMap: Record<string, number> = {};
  etapas.forEach(e => { ordemMap[e.nome] = e.ordem; });
  // Etapas que existem nas conversas mas não na jornada: mapear pela detecção
  etapasUnicas.forEach(e => {
    if (!(e in ordemMap)) {
      if (isFechou(e)) ordemMap[e] = 100;
      else if (isCompareceu(e)) ordemMap[e] = 90;
      else if (isAgendou(e)) ordemMap[e] = 80;
      else ordemMap[e] = 0;
    }
  });

  const getOrdem = (etapa: string) => ordemMap[etapa] ?? 0;

  const totalFunil = cf.length;
  const agendados = transicoesNoPeriodo.filter(h => isAgendou(h.etapa_nova)).length;
  const compareceram = transicoesNoPeriodo.filter(h => isCompareceu(h.etapa_nova)).length;
  const fecharam = transicoesNoPeriodo.filter(h => isFechou(h.etapa_nova)).length;

  const pctLeadsAgend = totalFunil > 0 ? ((agendados / totalFunil) * 100).toFixed(1) : "0.0";
  const pctAgendComp = agendados > 0 ? ((compareceram / agendados) * 100).toFixed(1) : "0.0";
  const pctCompVenda = compareceram > 0 ? ((fecharam / compareceram) * 100).toFixed(1) : "0.0";

  // ── Chart: Conversas por dia (stacked) ──
  const dayMap: Record<string, Record<string, number>> = {};
  cf.forEach((c) => {
    const day = c.created_at.split("T")[0];
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

  // ── Chart: Origem (pie) ──
  const pieData = [
    { name: "Meta Ads", value: metaAds },
    { name: "Google Ads", value: googleAds },
    { name: "Link Rastreável", value: linkRastreavel },
    { name: "Não Rastreada", value: naoRastreadas },
  ].filter((d) => d.value > 0);
  const pieTotal = pieData.reduce((s, d) => s + d.value, 0);

  // ── Funil da Jornada ──
  // Incluir etapas reais das conversas que podem não estar na configuração
  const etapasReais = Array.from(new Set(transicoesNoPeriodo.map(h => h.etapa_nova).filter(Boolean)));
  const etapasConfig = etapas.map(e => e.nome);
  const etapasFunil = [...etapasConfig, ...etapasReais.filter(e => !etapasConfig.includes(e))];
  const funilData = etapasFunil.map((nome) => ({
    nome,
    count: transicoesNoPeriodo.filter((h) => h.etapa_nova === nome).length,
  })).filter(d => d.count > 0);
  const funilMax = Math.max(...funilData.map((d) => d.count), 1);

  // ── Top Campanhas ──
  const campMap: Record<string, number> = {};
  cf.forEach((c) => {
    const key = c.utm_campaign || "";
    if (key) campMap[key] = (campMap[key] || 0) + 1;
  });
  const topCampanhas = Object.entries(campMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([name, value]) => ({ name, value }));

  // ── Top Anúncios ──
  const anuncioMap: Record<string, number> = {};
  cf.forEach((c) => {
    const key = c.nome_anuncio || "";
    if (key) anuncioMap[key] = (anuncioMap[key] || 0) + 1;
  });
  const topAnuncios = Object.entries(anuncioMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([name, value]) => ({ name, value }));

  // ── Tabela Campanha x Etapa ──
  const distinctCampaigns = Array.from(
    new Set(cf.map((c) => c.utm_campaign || "Sem campanha"))
  ).sort((a, b) => {
    if (a === "Sem campanha") return 1;
    if (b === "Sem campanha") return -1;
    return a.localeCompare(b);
  });

  const tabelaData = distinctCampaigns.map((camp) => {
    const rows = cf.filter(
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

      {/* ── KPI Row 1 ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "16px", marginBottom: "16px" }}>
        <KPICard label="Total de Conversas" value={total} icon={<MessageCircle size={16} />} iconBg="blue" />
        <KPICard label="Conversas Rastreadas" value={rastreadas} icon={<Eye size={16} />} iconBg="green" />
        <KPICard label="Não Rastreadas" value={naoRastreadas} icon={<EyeOff size={16} />} iconBg="red" />
        <KPICard label="Taxa de Rastreamento" value={`${taxaRastreamento}%`} icon={<Percent size={16} />} iconBg="amber" />
      </div>

      {/* ── KPI Row 2 ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "16px", marginBottom: "16px" }}>
        <KPICard label="Meta Ads" value={metaAds} icon={<TrendingUp size={16} />} iconBg="blue" />
        <KPICard label="Google Ads" value={googleAds} icon={<TrendingUp size={16} />} iconBg="green" />
        <KPICard label="Link Rastreável" value={linkRastreavel} icon={<Link size={16} />} iconBg="amber" />
        <KPICard label="Orgânicas" value={organicas} icon={<Users size={16} />} iconBg="red" />
      </div>

      {/* ── KPI Row 3 ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "16px", marginBottom: "28px" }}>
        <KPICard label="Mensagens não lidas" value={naoLidas} icon={<Mail size={16} />} iconBg="red" />
        <KPICard label="Tempo médio resposta" value="—" icon={<Clock size={16} />} iconBg="blue" />
        <KPICard label="Conversas na Jornada" value={naJornada} icon={<Star size={16} />} iconBg="green" />
        <KPICard label="Campanhas ativas" value={campanhasAtivas} icon={<Flame size={16} />} iconBg="amber" />
      </div>

      {/* ── Funil de Conversão ── */}
      <div className="card" style={{ marginBottom: "20px" }}>
        <h2 style={{ fontSize: "15px", fontWeight: "600", marginBottom: "20px" }}>Funil de Conversão</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 0, marginBottom: "20px", borderBottom: "1px solid #2e2e2e", paddingBottom: "16px" }}>
          {[
            { label: "Leads → Agendamentos", value: `${pctLeadsAgend}%` },
            { label: "Agendados → Compareceram", value: `${pctAgendComp}%` },
            { label: "Compareceram → Vendas", value: `${pctCompVenda}%` },
          ].map((item, i) => (
            <div key={i} style={{ textAlign: "center", padding: "0 16px", borderRight: i < 2 ? "1px solid #2e2e2e" : "none" }}>
              <p style={{ fontSize: "12px", color: "#606060", marginBottom: "6px" }}>{item.label}</p>
              <p style={{ fontSize: "22px", fontWeight: "700", color: item.value === "0.0%" ? "#404040" : "#22c55e" }}>{item.value}</p>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px" }}>
          {[
            { label: "Total Conversas", value: totalFunil },
            { label: "Agendados", value: agendados },
            { label: "Compareceram", value: compareceram },
            { label: "Fechadas", value: fecharam },
          ].map((item) => (
            <div key={item.label} style={{ background: "#1a1a1a", borderRadius: "8px", padding: "14px 16px" }}>
              <p style={{ fontSize: "12px", color: "#606060", marginBottom: "6px" }}>{item.label}</p>
              <p style={{ fontSize: "20px", fontWeight: "700", color: item.value > 0 ? "#f0f0f0" : "#404040" }}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Sem dados ── */}
      {total === 0 && (
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
          <h3 style={{ fontSize: "14px", fontWeight: "500", marginBottom: "20px" }}>Funil da Jornada</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {funilData.map((item, idx) => {
              const widthPct = funilMax > 0 ? Math.max((item.count / funilMax) * 100, 4) : 4;
              const opacity = 1 - idx * (0.6 / Math.max(funilData.length - 1, 1));
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
                        background: `rgba(41,171,226,${opacity})`,
                        borderRadius: "6px",
                        display: "flex",
                        alignItems: "center",
                        paddingLeft: "12px",
                        transition: "width 0.4s ease",
                        minWidth: "40px",
                      }}
                    >
                      <span style={{ fontSize: "12px", fontWeight: "600", color: "#f0f0f0" }}>
                        {item.count}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
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
