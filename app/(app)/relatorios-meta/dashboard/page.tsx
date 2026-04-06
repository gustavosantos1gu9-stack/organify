"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Printer, Loader2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ComparacaoData {
  impressions: number; reach: number; clicks: number; ctr: number;
  cpm: number; spend: number; frequency: number; mensagens: number; custoMensagem: number;
}

interface DashboardData {
  nomeCliente: string;
  periodo: { since: string; until: string; label: string };
  comparacao?: ComparacaoData | null;
  resumo: {
    impressions: number;
    reach: number;
    clicks: number;
    ctr: number;
    cpm: number;
    spend: number;
    frequency: number;
    mensagens: number;
    custoMensagem: number;
    balance: number;
    currency: string;
  };
  diario: Array<{
    date: string;
    impressions: number;
    clicks: number;
    spend: number;
    mensagens: number;
  }>;
  campanhas: Array<{
    name: string;
    impressions: number;
    clicks: number;
    spend: number;
    mensagens: number;
    ctr: number;
    cpa: number;
  }>;
  anuncios: Array<{
    name: string;
    impressions: number;
    clicks: number;
    spend: number;
    mensagens: number;
    ctr: number;
    cpa: number;
  }>;
  posicionamentos: Array<{
    platform: string;
    position: string;
    impressions: number;
    clicks: number;
    spend: number;
    mensagens: number;
    ctr: number;
  }>;
  idade: Array<{
    age: string;
    impressions: number;
    clicks: number;
    spend: number;
    mensagens: number;
  }>;
}

/* ------------------------------------------------------------------ */
/*  Formatting helpers                                                 */
/* ------------------------------------------------------------------ */

const fmtNum = (n: number) =>
  isNaN(n) ? "0" : n.toLocaleString("pt-BR");

const fmtMoney = (n: number) =>
  isNaN(n)
    ? "R$ 0,00"
    : `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtPct = (n: number) =>
  isNaN(n)
    ? "0,00%"
    : `${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

const fmtDate = (d: string) => {
  if (!d) return "";
  const p = d.split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
};

const fmtDateShort = (d: string) => {
  if (!d) return "";
  const p = d.split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}` : d;
};

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const BLUE = "#29ABE2";
const AMBER = "#f59e0b";

type SectionKey =
  | "kpis"
  | "desempenho"
  | "investimento"
  | "campanhas"
  | "anuncios"
  | "posicionamentos"
  | "idade";

const SECTION_LABELS: Record<SectionKey, string> = {
  kpis: "KPIs principais",
  desempenho: "Desempenho diário",
  investimento: "Investimento diário",
  campanhas: "Campanhas",
  anuncios: "Anúncios",
  posicionamentos: "Posicionamentos",
  idade: "Idade",
};

/* ------------------------------------------------------------------ */
/*  Inner component (uses useSearchParams)                             */
/* ------------------------------------------------------------------ */

function DashboardInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const relatorioId = searchParams.get("id");

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Período customizável
  const hoje = new Date();
  const [dateFrom, setDateFrom] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split("T")[0]);
  const [dateTo, setDateTo] = useState(hoje.toISOString().split("T")[0]);
  const [periodoTipo, setPeriodoTipo] = useState<"semana" | "mes" | "custom">("mes");

  const [activeTab, setActiveTab] = useState<"dashboard" | "performance">("dashboard");

  // Helpers de período
  const fmtD = (d: Date | string) => typeof d === "string" ? d : d.toISOString().split("T")[0];
  const getSegunda = (d: Date) => { const r = new Date(d); r.setDate(r.getDate() - ((r.getDay() + 6) % 7)); return r; };

  const setPeriodo = (tipo: "semana" | "mes" | "custom") => {
    setPeriodoTipo(tipo);
    const h = new Date();
    if (tipo === "semana") {
      const seg = getSegunda(h);
      const dom = new Date(seg); dom.setDate(dom.getDate() + 6);
      setDateFrom(fmtD(seg));
      setDateTo(fmtD(dom > h ? h : dom));
    } else if (tipo === "mes") {
      setDateFrom(fmtD(new Date(h.getFullYear(), h.getMonth(), 1)));
      setDateTo(fmtD(h));
    }
  };

  // Calcular período anterior para comparação
  const getCompareDates = () => {
    const from = new Date(dateFrom + "T12:00:00");
    const to = new Date(dateTo + "T12:00:00");
    if (periodoTipo === "semana") {
      const prevFrom = new Date(from); prevFrom.setDate(prevFrom.getDate() - 7);
      const prevTo = new Date(to); prevTo.setDate(prevTo.getDate() - 7);
      return { compare_from: fmtD(prevFrom), compare_to: fmtD(prevTo) };
    }
    // Mês anterior
    const prevFrom = new Date(from.getFullYear(), from.getMonth() - 1, from.getDate());
    const prevTo = new Date(to.getFullYear(), to.getMonth() - 1, to.getDate());
    return { compare_from: fmtD(prevFrom), compare_to: fmtD(prevTo) };
  };

  const [sections, setSections] = useState<Record<SectionKey, boolean>>({
    kpis: true,
    desempenho: true,
    investimento: true,
    campanhas: true,
    anuncios: true,
    posicionamentos: true,
    idade: true,
  });

  /* Fetch ---------------------------------------------------------- */

  const carregarDados = async () => {
    if (!relatorioId) {
      setError("ID do relatório não informado");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const comp = getCompareDates();
      const res = await fetch("/api/relatorios/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relatorio_id: relatorioId, date_from: dateFrom, date_to: dateTo, compare: true, ...comp }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao carregar dados");
      setData(json);
    } catch (err: any) {
      setError(err.message || "Erro desconhecido");
    }
    setLoading(false);
  };

  useEffect(() => { carregarDados(); }, [relatorioId]);

  /* Handlers ------------------------------------------------------- */

  const toggle = (key: SectionKey) =>
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const handlePrint = () => window.print();

  /* Loading / Error ------------------------------------------------ */

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "60vh",
          color: "#a0a0a0",
          gap: 12,
        }}
      >
        <Loader2 size={28} className="spin" />
        Carregando dashboard...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <p style={{ color: "#ef4444", marginBottom: 16 }}>
          {error || "Nenhum dado encontrado"}
        </p>
        <button onClick={() => router.push("/relatorios-meta")} style={btnSecondary}>
          <ArrowLeft size={14} /> Voltar
        </button>
      </div>
    );
  }

  /* Derived data --------------------------------------------------- */

  const { resumo, comparacao, diario, campanhas, anuncios, posicionamentos, idade } = data;
  const cpl = resumo.mensagens > 0 ? resumo.spend / resumo.mensagens : 0;
  const prevCpl = comparacao && comparacao.mensagens > 0 ? comparacao.spend / comparacao.mensagens : 0;

  // Calcular % de variação (positivo = cresceu, negativo = caiu)
  const pctChange = (curr: number, prev: number) => prev > 0 ? ((curr - prev) / prev) * 100 : curr > 0 ? 100 : 0;

  // Para CPM e CPL, menor é melhor (invertido)
  const kpis = [
    { label: "Investimento", sub: periodoTipo === "semana" ? "vs semana anterior" : "vs mês anterior", value: fmtMoney(resumo.spend), pct: comparacao ? pctChange(resumo.spend, comparacao.spend) : null },
    { label: "Cliques", sub: periodoTipo === "semana" ? "vs semana anterior" : "vs mês anterior", value: fmtNum(resumo.clicks), pct: comparacao ? pctChange(resumo.clicks, comparacao.clicks) : null },
    { label: "Impressões", sub: periodoTipo === "semana" ? "vs semana anterior" : "vs mês anterior", value: fmtNum(resumo.impressions), pct: comparacao ? pctChange(resumo.impressions, comparacao.impressions) : null },
    { label: "Mensagens", sub: periodoTipo === "semana" ? "vs semana anterior" : "vs mês anterior", value: fmtNum(resumo.mensagens), pct: comparacao ? pctChange(resumo.mensagens, comparacao.mensagens) : null },
    { label: "CPM", sub: periodoTipo === "semana" ? "vs semana anterior" : "vs mês anterior", value: fmtMoney(resumo.cpm), pct: comparacao ? pctChange(resumo.cpm, comparacao.cpm) : null, inverted: true },
    { label: "CPL", sub: periodoTipo === "semana" ? "vs semana anterior" : "vs mês anterior", value: fmtMoney(cpl), pct: comparacao ? pctChange(cpl, prevCpl) : null, inverted: true },
  ];

  /* Render --------------------------------------------------------- */

  return (
    <>
      <style>{printCSS}</style>

      <div className="dashboard-root" style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
        {/* --- Action buttons + date selector --- */}
        <div className="no-print" style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={() => router.push("/relatorios-meta")} style={btnSecondary}>
            <ArrowLeft size={14} /> Voltar
          </button>
          <button onClick={handlePrint} style={btnPrimary}>
            <Printer size={14} /> Exportar PDF
          </button>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {(["semana", "mes", "custom"] as const).map(t => (
              <button key={t} onClick={() => { setPeriodo(t); if (t !== "custom") setTimeout(carregarDados, 50); }}
                style={{
                  padding: "6px 14px", fontSize: 12, fontWeight: periodoTipo === t ? 600 : 400, borderRadius: 6, border: "1px solid #2e2e2e", cursor: "pointer",
                  background: periodoTipo === t ? "#29ABE2" : "#1a1a1a", color: periodoTipo === t ? "#fff" : "#a0a0a0",
                }}>
                {t === "semana" ? "Semana" : t === "mes" ? "Mês" : "Personalizado"}
              </button>
            ))}
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPeriodoTipo("custom"); }}
              style={{ background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: 6, padding: "6px 10px", color: "#f0f0f0", fontSize: 13 }} />
            <span style={{ color: "#606060", fontSize: 13 }}>a</span>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPeriodoTipo("custom"); }}
              style={{ background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: 6, padding: "6px 10px", color: "#f0f0f0", fontSize: 13 }} />
            <button onClick={carregarDados} disabled={loading} style={{ ...btnPrimary, padding: "6px 16px" }}>
              {loading ? "Carregando..." : "Gerar"}
            </button>
          </div>
        </div>

        {/* --- Tab selector --- */}
        <div className="no-print" style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: "1px solid #2e2e2e" }}>
          <button onClick={() => setActiveTab("dashboard")} style={{
            padding: "10px 24px", fontSize: 14, fontWeight: activeTab === "dashboard" ? "600" : "400",
            background: "none", border: "none", cursor: "pointer",
            color: activeTab === "dashboard" ? "#29ABE2" : "#606060",
            borderBottom: activeTab === "dashboard" ? "2px solid #29ABE2" : "2px solid transparent",
          }}>Dashboard</button>
          <button onClick={() => setActiveTab("performance")} style={{
            padding: "10px 24px", fontSize: 14, fontWeight: activeTab === "performance" ? "600" : "400",
            background: "none", border: "none", cursor: "pointer",
            color: activeTab === "performance" ? "#29ABE2" : "#606060",
            borderBottom: activeTab === "performance" ? "2px solid #29ABE2" : "2px solid transparent",
          }}>Performance</button>
        </div>

        {activeTab === "dashboard" && (
        <>
        {/* --- Metric selector --- */}
        <div
          className="no-print"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px 20px",
            marginBottom: 28,
            padding: "12px 16px",
            background: "#111",
            border: "1px solid #2e2e2e",
            borderRadius: 10,
          }}
        >
          {(Object.keys(SECTION_LABELS) as SectionKey[]).map((key) => (
            <label
              key={key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                color: sections[key] ? "#f0f0f0" : "#606060",
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <input
                type="checkbox"
                checked={sections[key]}
                onChange={() => toggle(key)}
                style={{ accentColor: BLUE, width: 15, height: 15, cursor: "pointer" }}
              />
              {SECTION_LABELS[key]}
            </label>
          ))}
        </div>

        {/* ========================================================= */}
        {/*  HEADER                                                    */}
        {/* ========================================================= */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#f0f0f0", margin: 0, letterSpacing: "-0.02em" }}>
            CA {data.nomeCliente}
          </h1>
          <p style={{ fontSize: 16, color: "#a0a0a0", margin: "6px 0 2px" }}>
            Relatório de Desempenho
          </p>
          <p style={{ fontSize: 13, color: "#606060" }}>
            Período: De {fmtD(data.periodo.since)} a {fmtD(data.periodo.until)}
          </p>
        </div>

        {/* ========================================================= */}
        {/*  KPI CARDS                                                 */}
        {/* ========================================================= */}
        {sections.kpis && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 28 }}>
            {kpis.map((kpi: any) => {
              const hasPct = kpi.pct !== null && kpi.pct !== undefined && isFinite(kpi.pct);
              const isPositive = kpi.inverted ? kpi.pct < 0 : kpi.pct > 0;
              const isNeg = kpi.inverted ? kpi.pct > 0 : kpi.pct < 0;
              return (
                <div key={kpi.label} style={cardStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 26, fontWeight: 700, color: "#f0f0f0", lineHeight: 1.1 }}>{kpi.value}</span>
                    {hasPct && Math.abs(kpi.pct) >= 0.1 && (
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: "2px 6px", borderRadius: 6,
                        background: isPositive ? "rgba(34,197,94,0.15)" : isNeg ? "rgba(239,68,68,0.15)" : "rgba(100,100,100,0.15)",
                        color: isPositive ? "#22c55e" : isNeg ? "#ef4444" : "#888",
                      }}>
                        {kpi.pct > 0 ? "+" : ""}{kpi.pct.toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: "#a0a0a0" }}>{kpi.label}</span>
                    <span style={{ fontSize: 11, color: "#505050", marginLeft: 6 }}>{kpi.sub}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ========================================================= */}
        {/*  DESEMPENHO DIÁRIO                                         */}
        {/* ========================================================= */}
        {sections.desempenho && (
          <div style={sectionCard}>
            <div style={sectionHeaderRow}>
              <h2 style={sectionTitle}>Desempenho diário</h2>
              <div style={sectionLine} />
            </div>
            <p style={{ fontSize: 12, color: "#606060", margin: "0 0 16px" }}>
              Mensagens recebidas por dia
            </p>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={diario} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <XAxis
                    dataKey="date"
                    tickFormatter={fmtDateShort}
                    tick={{ fill: "#a0a0a0", fontSize: 11 }}
                    axisLine={{ stroke: "#2e2e2e" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#a0a0a0", fontSize: 11 }}
                    axisLine={{ stroke: "#2e2e2e" }}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelFormatter={fmtDate}
                    formatter={(value: number) => [fmtNum(value), "Mensagens"]}
                  />
                  <Bar dataKey="mensagens" radius={[4, 4, 0, 0]}>
                    {diario.map((_, i) => (
                      <Cell key={i} fill={BLUE} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/*  INVESTIMENTO DIÁRIO                                       */}
        {/* ========================================================= */}
        {sections.investimento && (
          <div style={sectionCard}>
            <div style={sectionHeaderRow}>
              <h2 style={sectionTitle}>Investimento diário</h2>
              <div style={sectionLine} />
            </div>
            <p style={{ fontSize: 12, color: "#606060", margin: "0 0 16px" }}>
              Valor investido por dia (R$)
            </p>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={diario} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <XAxis
                    dataKey="date"
                    tickFormatter={fmtDateShort}
                    tick={{ fill: "#a0a0a0", fontSize: 11 }}
                    axisLine={{ stroke: "#2e2e2e" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#a0a0a0", fontSize: 11 }}
                    axisLine={{ stroke: "#2e2e2e" }}
                    tickLine={false}
                    tickFormatter={(v: number) => `R$${v.toFixed(0)}`}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelFormatter={fmtDate}
                    formatter={(value: number) => [fmtMoney(value), "Investimento"]}
                  />
                  <Bar dataKey="spend" radius={[4, 4, 0, 0]}>
                    {diario.map((_, i) => (
                      <Cell key={i} fill={AMBER} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/*  CAMPANHAS                                                 */}
        {/* ========================================================= */}
        {sections.campanhas && (
          <div style={sectionCard}>
            <div style={sectionHeaderRow}>
              <h2 style={sectionTitle}>Campanhas</h2>
              <div style={sectionLine} />
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={tableBase}>
                <thead>
                  <tr>
                    <th style={th}>Nome</th>
                    <th style={thR}>Investimento</th>
                    <th style={thR}>Resultados</th>
                    <th style={thR}>CPA</th>
                    <th style={thR}>CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {campanhas.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ ...td, textAlign: "center", color: "#606060" }}>
                        Sem dados no período
                      </td>
                    </tr>
                  )}
                  {campanhas.map((c, i) => (
                    <tr key={i} style={i % 2 === 1 ? rowAlt : undefined}>
                      <td style={{ ...td, maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.name}
                      </td>
                      <td style={tdR}>{fmtMoney(c.spend)}</td>
                      <td style={tdR}>{fmtNum(c.mensagens)}</td>
                      <td style={tdR}>{fmtMoney(c.cpa)}</td>
                      <td style={tdR}>{fmtPct(c.ctr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/*  ANÚNCIOS                                                  */}
        {/* ========================================================= */}
        {sections.anuncios && (
          <div style={sectionCard}>
            <div style={sectionHeaderRow}>
              <h2 style={sectionTitle}>Anúncios</h2>
              <div style={sectionLine} />
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={tableBase}>
                <thead>
                  <tr>
                    <th style={th}>Anúncio</th>
                    <th style={thR}>Investimento</th>
                    <th style={thR}>Resultados</th>
                    <th style={thR}>CPA</th>
                    <th style={thR}>CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {anuncios.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ ...td, textAlign: "center", color: "#606060" }}>
                        Sem dados no período
                      </td>
                    </tr>
                  )}
                  {anuncios.map((a, i) => (
                    <tr key={i} style={i % 2 === 1 ? rowAlt : undefined}>
                      <td style={{ ...td, maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {a.name}
                      </td>
                      <td style={tdR}>{fmtMoney(a.spend)}</td>
                      <td style={tdR}>{fmtNum(a.mensagens)}</td>
                      <td style={tdR}>{fmtMoney(a.cpa)}</td>
                      <td style={tdR}>{fmtPct(a.ctr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/*  POSICIONAMENTOS                                           */}
        {/* ========================================================= */}
        {sections.posicionamentos && (
          <div style={sectionCard}>
            <div style={sectionHeaderRow}>
              <h2 style={sectionTitle}>Posicionamentos</h2>
              <div style={sectionLine} />
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={tableBase}>
                <thead>
                  <tr>
                    <th style={th}>Posicionamento</th>
                    <th style={thR}>Valor gasto</th>
                    <th style={thR}>Impressões</th>
                    <th style={thR}>Resultados</th>
                    <th style={thR}>CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {posicionamentos.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ ...td, textAlign: "center", color: "#606060" }}>
                        Sem dados no período
                      </td>
                    </tr>
                  )}
                  {posicionamentos.map((p, i) => {
                    const label = `${p.platform} ${p.position}`.toLowerCase().replace(/_/g, " ");
                    return (
                      <tr key={i} style={i % 2 === 1 ? rowAlt : undefined}>
                        <td style={td}>{label}</td>
                        <td style={tdR}>{fmtMoney(p.spend)}</td>
                        <td style={tdR}>{fmtNum(p.impressions)}</td>
                        <td style={tdR}>{fmtNum(p.mensagens)}</td>
                        <td style={tdR}>{fmtPct(p.ctr)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/*  IDADE                                                     */}
        {/* ========================================================= */}
        {sections.idade && (
          <div style={sectionCard}>
            <div style={sectionHeaderRow}>
              <h2 style={sectionTitle}>Idade</h2>
              <div style={sectionLine} />
            </div>
            <p style={{ fontSize: 12, color: "#606060", margin: "0 0 16px" }}>
              Distribuição de impressões por faixa etária
            </p>
            {idade.length === 0 ? (
              <p style={{ textAlign: "center", color: "#606060", padding: 20 }}>
                Sem dados no período
              </p>
            ) : (
              <div style={{ width: "100%", height: Math.max(200, idade.length * 48) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={idade} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                    <XAxis
                      type="number"
                      tick={{ fill: "#a0a0a0", fontSize: 11 }}
                      axisLine={{ stroke: "#2e2e2e" }}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="age"
                      tick={{ fill: "#a0a0a0", fontSize: 12 }}
                      axisLine={{ stroke: "#2e2e2e" }}
                      tickLine={false}
                      width={50}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value: number, name: string) => {
                        if (name === "impressions") return [fmtNum(value), "Impressões"];
                        return [fmtNum(value), name];
                      }}
                    />
                    <Bar dataKey="impressions" radius={[0, 4, 4, 0]}>
                      {idade.map((_, i) => (
                        <Cell key={i} fill={BLUE} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/*  FOOTER                                                    */}
        {/* ========================================================= */}
        <div
          style={{
            textAlign: "center",
            padding: "36px 0 20px",
            color: "#505050",
            fontSize: 12,
            letterSpacing: "0.04em",
          }}
        >
          Relatório gerado com SALX Convert
        </div>
        </>
        )}

        {activeTab === "performance" && (
          <PerformanceTab relatorioId={relatorioId || ""} dateFrom={dateFrom} dateTo={dateTo} />
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Performance Tab                                                    */
/* ------------------------------------------------------------------ */

function PerformanceTab({ relatorioId, dateFrom, dateTo }: { relatorioId: string; dateFrom: string; dateTo: string }) {
  const [semanas, setSemanas] = useState<any[]>([]);
  const [prevTotals, setPrevTotals] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [temWhatsApp, setTemWhatsApp] = useState(false);
  const [nomeCliente, setNomeCliente] = useState("");
  const [editando, setEditando] = useState<Record<string, {
    mensagens: number; investimento: number; agendamentos: number;
    realizados: number; vendas: number; valorVendas: number; faturamento: number;
  }>>({});
  const [metaExtras, setMetaExtras] = useState<Record<string, boolean>>({
    impressoes: false, alcance: false, cliques: false, ctr: false, cpm: false, frequencia: false,
  });

  /* --- helpers ---------------------------------------------------- */
  const pfmtNum = (n: number) => isNaN(n) ? "0" : n.toLocaleString("pt-BR");
  const pfmtMoney = (n: number) => isNaN(n) ? "R$ 0,00" : `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const pfmtPct = (n: number) => isNaN(n) || !isFinite(n) ? "0,0%" : `${n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  const pfmtDateShort = (d: string) => { if (!d) return ""; const [y, m, day] = d.split("-"); return `${day}/${m}`; };
  const safe = (a: number, b: number) => b > 0 ? a / b : 0;

  /* --- data loading ----------------------------------------------- */
  const carregar = async () => {
    setLoading(true);
    try {
      // Período atual
      const res = await fetch("/api/relatorios/performance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "carregar", relatorio_id: relatorioId, date_from: dateFrom, date_to: dateTo }),
      });
      const data = await res.json();
      if (data.semanas) {
        setSemanas(data.semanas);
        setTemWhatsApp(data.temWhatsApp);
        setNomeCliente(data.nomeCliente || "");
        const edit: Record<string, any> = {};
        data.semanas.forEach((s: any) => {
          edit[s.semana_inicio] = {
            mensagens: s.mensagens ?? 0,
            investimento: s.investimento ?? 0,
            agendamentos: s.agendamentos ?? 0,
            realizados: s.comparecimentos ?? 0,
            vendas: s.vendas ?? 0,
            valorVendas: s.valor_vendas ?? 0,
            faturamento: s.faturamento ?? 0,
          };
        });
        setEditando(edit);
      }
      // Buscar mês anterior para comparação dos totais
      try {
        const from = new Date(dateFrom + "T12:00:00");
        const to = new Date(dateTo + "T12:00:00");
        const prevFrom = new Date(from.getFullYear(), from.getMonth() - 1, from.getDate());
        const prevTo = new Date(to.getFullYear(), to.getMonth() - 1, to.getDate());
        const fmt = (d: Date) => d.toISOString().split("T")[0];
        const prevRes = await fetch("/api/relatorios/performance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "carregar", relatorio_id: relatorioId, date_from: fmt(prevFrom), date_to: fmt(prevTo) }),
        });
        const prevData = await prevRes.json();
        if (prevData.semanas) {
          const totals: any = { investimento: 0, mensagens: 0, agendamentos: 0, realizados: 0, vendas: 0, valorVendas: 0, faturamento: 0 };
          prevData.semanas.forEach((s: any) => {
            totals.investimento += s.investimento ?? 0;
            totals.mensagens += s.mensagens ?? 0;
            totals.agendamentos += s.agendamentos ?? 0;
            totals.realizados += s.comparecimentos ?? 0;
            totals.vendas += s.vendas ?? 0;
            totals.valorVendas += s.valor_vendas ?? 0;
            totals.faturamento += s.faturamento ?? 0;
          });
          setPrevTotals(totals);
        }
      } catch {}
    } catch {}
    setLoading(false);
  };

  useEffect(() => { if (relatorioId) carregar(); }, [relatorioId, dateFrom, dateTo]);

  /* --- save ------------------------------------------------------- */
  const salvar = async () => {
    setSaving(true);
    const semsToSave = semanas.map(s => {
      const ed = editando[s.semana_inicio] || {} as any;
      return {
        ...s,
        mensagens: ed.mensagens ?? s.mensagens,
        investimento: ed.investimento ?? s.investimento,
        agendamentos: ed.agendamentos ?? s.agendamentos,
        comparecimentos: ed.realizados ?? s.comparecimentos,
        vendas: ed.vendas ?? s.vendas,
        valor_vendas: ed.valorVendas ?? 0,
        faturamento: ed.faturamento ?? 0,
        modo: "manual",
      };
    });
    try {
      await fetch("/api/relatorios/performance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "salvar", relatorio_id: relatorioId, agencia_id: "auto", semanas: semsToSave }),
      });
      await carregar();
      alert("Dados salvos!");
    } catch { alert("Erro ao salvar"); }
    setSaving(false);
  };

  /* --- edit handler ----------------------------------------------- */
  const updateEdit = (semInicio: string, campo: string, valor: number) => {
    setEditando(prev => ({
      ...prev,
      [semInicio]: { ...prev[semInicio], [campo]: valor },
    }));
  };

  /* --- computed totals -------------------------------------------- */
  const getVal = (key: string, s: any) => {
    const ed = editando[s.semana_inicio];
    if (!ed) return 0;
    return (ed as any)[key] ?? 0;
  };
  const sumField = (key: string) => semanas.reduce((acc, s) => acc + getVal(key, s), 0);

  const totInvestimento = sumField("investimento");
  const totMensagens = sumField("mensagens");
  const totAgendamentos = sumField("agendamentos");
  const totRealizados = sumField("realizados");
  const totVendas = sumField("vendas");
  const totValorVendas = sumField("valorVendas");
  const totFaturamento = sumField("faturamento");

  // Helper comparação %
  const pctChg = (curr: number, prev: number) => prev > 0 ? ((curr - prev) / prev) * 100 : curr > 0 ? 100 : 0;
  const PctBadge = ({ curr, prev, inverted }: { curr: number; prev: number; inverted?: boolean }) => {
    if (!prevTotals || prev === 0 && curr === 0) return null;
    const pct = pctChg(curr, prev);
    if (Math.abs(pct) < 0.1) return null;
    const isGood = inverted ? pct < 0 : pct > 0;
    const isBad = inverted ? pct > 0 : pct < 0;
    return <span style={{ fontSize: 10, fontWeight: 600, marginLeft: 4, padding: "1px 5px", borderRadius: 4, background: isGood ? "rgba(34,197,94,0.15)" : isBad ? "rgba(239,68,68,0.15)" : "rgba(100,100,100,0.15)", color: isGood ? "#22c55e" : isBad ? "#ef4444" : "#888" }}>{pct > 0 ? "+" : ""}{pct.toFixed(1)}%</span>;
  };

  // Helper comparação semana anterior (dentro da tabela)
  const getWeekPct = (semIdx: number, field: string) => {
    if (semIdx === 0) return null;
    const curr = getVal(field, semanas[semIdx]);
    const prev = getVal(field, semanas[semIdx - 1]);
    if (prev === 0 && curr === 0) return null;
    return pctChg(curr, prev);
  };

  const totTicketMedio = safe(totValorVendas, totVendas);
  const totRoas = safe(totValorVendas, totInvestimento);
  const totTaxaLeadAgend = safe(totAgendamentos, totMensagens) * 100;
  const totTaxaAgendRealiz = safe(totRealizados, totAgendamentos) * 100;
  const totTaxaRealizVenda = safe(totVendas, totRealizados) * 100;
  const totTaxaLeadVenda = safe(totVendas, totMensagens) * 100;
  const totCustoLead = safe(totInvestimento, totMensagens);
  const totCustoAgend = safe(totInvestimento, totAgendamentos);
  const totCustoRealiz = safe(totInvestimento, totRealizados);
  const totCustoVenda = safe(totInvestimento, totVendas);

  /* --- styles ----------------------------------------------------- */
  const inputStyle: React.CSSProperties = { background: "#222", border: "1px solid #333", borderRadius: 4, padding: "4px 8px", color: "#f0f0f0", fontSize: 13, width: 80, textAlign: "center" };
  const moneyInputStyle: React.CSSProperties = { ...inputStyle, width: 100 };
  const manualCellBg: React.CSSProperties = { background: "#2a2a1a", border: "1px solid #3a3a2a" };
  const autoCellStyle: React.CSSProperties = { color: "#a0a0a0", textAlign: "center", padding: "8px 6px", fontSize: 13 };
  const totalColStyle: React.CSSProperties = { fontWeight: 700, color: "#f0f0f0", background: "rgba(41,171,226,0.05)", textAlign: "center", padding: "8px 6px", fontSize: 13 };
  const headerCellStyle: React.CSSProperties = { background: "#1e1e1e", fontWeight: 600, textAlign: "center", padding: "10px 6px", fontSize: 11, color: "#a0a0a0", borderBottom: "1px solid #2e2e2e", whiteSpace: "nowrap" };
  const rowLabelStyle: React.CSSProperties = { fontWeight: 500, color: "#f0f0f0", paddingLeft: 16, padding: "8px 8px 8px 16px", fontSize: 13, whiteSpace: "nowrap", position: "sticky", left: 0, background: "#1a1a1a", zIndex: 1 };

  if (loading) return <div style={{ textAlign: "center", padding: 40, color: "#606060" }}><Loader2 size={20} className="spin" style={{ display: "inline-block", marginRight: 8 }} />Carregando performance...</div>;

  /* --- row definitions -------------------------------------------- */
  type RowDef = {
    label: string;
    type: "manual" | "auto";
    field?: string;
    money?: boolean;
    getValue: (ed: any) => number;
    getTotal: () => number;
    getPrev?: () => number;
    inverted?: boolean;
    format: (n: number) => string;
  };

  const manualRows: RowDef[] = [
    { label: "Investimento", type: "manual", field: "investimento", money: true, getValue: (ed) => ed.investimento ?? 0, getTotal: () => totInvestimento, getPrev: () => prevTotals?.investimento ?? 0, format: pfmtMoney },
    { label: "Mensagens", type: "manual", field: "mensagens", getValue: (ed) => ed.mensagens ?? 0, getTotal: () => totMensagens, getPrev: () => prevTotals?.mensagens ?? 0, format: pfmtNum },
    { label: "Nº de Agendamentos", type: "manual", field: "agendamentos", getValue: (ed) => ed.agendamentos ?? 0, getTotal: () => totAgendamentos, getPrev: () => prevTotals?.agendamentos ?? 0, format: pfmtNum },
    { label: "Nº de Realizados", type: "manual", field: "realizados", getValue: (ed) => ed.realizados ?? 0, getTotal: () => totRealizados, getPrev: () => prevTotals?.realizados ?? 0, format: pfmtNum },
    { label: "Nº de Vendas", type: "manual", field: "vendas", getValue: (ed) => ed.vendas ?? 0, getTotal: () => totVendas, getPrev: () => prevTotals?.vendas ?? 0, format: pfmtNum },
    { label: "Valor em Vendas", type: "manual", field: "valorVendas", money: true, getValue: (ed) => ed.valorVendas ?? 0, getTotal: () => totValorVendas, getPrev: () => prevTotals?.valorVendas ?? 0, format: pfmtMoney },
    { label: "Faturamento", type: "manual", field: "faturamento", money: true, getValue: (ed) => ed.faturamento ?? 0, getTotal: () => totFaturamento, getPrev: () => prevTotals?.faturamento ?? 0, format: pfmtMoney },
  ];

  const prevCL = prevTotals ? safe(prevTotals.investimento, prevTotals.mensagens) : 0;
  const prevCA = prevTotals ? safe(prevTotals.investimento, prevTotals.agendamentos) : 0;
  const prevCR = prevTotals ? safe(prevTotals.investimento, prevTotals.realizados) : 0;
  const prevCV = prevTotals ? safe(prevTotals.investimento, prevTotals.vendas) : 0;

  const autoRows: RowDef[] = [
    { label: "Ticket Médio", type: "auto", getValue: (ed) => safe(ed.valorVendas, ed.vendas), getTotal: () => totTicketMedio, getPrev: () => prevTotals ? safe(prevTotals.valorVendas, prevTotals.vendas) : 0, format: pfmtMoney },
    { label: "ROAS", type: "auto", getValue: (ed) => safe(ed.valorVendas, ed.investimento), getTotal: () => totRoas, getPrev: () => prevTotals ? safe(prevTotals.valorVendas, prevTotals.investimento) : 0, format: (n) => isNaN(n) || !isFinite(n) ? "0,0x" : `${n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}x` },
    { label: "Taxa Lead → Agend.", type: "auto", getValue: (ed) => safe(ed.agendamentos, ed.mensagens) * 100, getTotal: () => totTaxaLeadAgend, getPrev: () => prevTotals ? safe(prevTotals.agendamentos, prevTotals.mensagens) * 100 : 0, format: pfmtPct },
    { label: "Taxa Agend. → Realiz.", type: "auto", getValue: (ed) => safe(ed.realizados, ed.agendamentos) * 100, getTotal: () => totTaxaAgendRealiz, getPrev: () => prevTotals ? safe(prevTotals.realizados, prevTotals.agendamentos) * 100 : 0, format: pfmtPct },
    { label: "Taxa Realiz. → Venda", type: "auto", getValue: (ed) => safe(ed.vendas, ed.realizados) * 100, getTotal: () => totTaxaRealizVenda, getPrev: () => prevTotals ? safe(prevTotals.vendas, prevTotals.realizados) * 100 : 0, format: pfmtPct },
    { label: "Taxa Lead → Venda", type: "auto", getValue: (ed) => safe(ed.vendas, ed.mensagens) * 100, getTotal: () => totTaxaLeadVenda, getPrev: () => prevTotals ? safe(prevTotals.vendas, prevTotals.mensagens) * 100 : 0, format: pfmtPct },
    { label: "Custo por Lead", type: "auto", inverted: true, getValue: (ed) => safe(ed.investimento, ed.mensagens), getTotal: () => totCustoLead, getPrev: () => prevCL, format: pfmtMoney },
    { label: "Custo por Agend.", type: "auto", inverted: true, getValue: (ed) => safe(ed.investimento, ed.agendamentos), getTotal: () => totCustoAgend, getPrev: () => prevCA, format: pfmtMoney },
    { label: "Custo por Realiz.", type: "auto", inverted: true, getValue: (ed) => safe(ed.investimento, ed.realizados), getTotal: () => totCustoRealiz, getPrev: () => prevCR, format: pfmtMoney },
    { label: "Custo por Venda", type: "auto", inverted: true, getValue: (ed) => safe(ed.investimento, ed.vendas), getTotal: () => totCustoVenda, getPrev: () => prevCV, format: pfmtMoney },
  ];

  const allRows = [...manualRows, ...autoRows];

  /* === RENDER ==================================================== */
  return (
    <div>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f0f0f0", marginBottom: 4 }}>Performance — {nomeCliente}</h1>
        <p style={{ fontSize: 13, color: "#606060" }}>
          {pfmtDateShort(dateFrom)} a {pfmtDateShort(dateTo)}
          {temWhatsApp && <span style={{ marginLeft: 8, color: "#22c55e", fontSize: 11 }}>● Modo automático</span>}
          {!temWhatsApp && <span style={{ marginLeft: 8, color: "#f59e0b", fontSize: 11 }}>● Modo manual</span>}
        </p>
      </div>

      {/* ============================================================ */}
      {/* SECTION 1: Weekly Table (horizontal - weeks as columns)      */}
      {/* ============================================================ */}
      <div className="card" style={{ background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: 12, padding: 0, overflow: "hidden", marginBottom: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #2e2e2e" }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "#f0f0f0", margin: 0 }}>Desempenho Semanal</h3>
          <button onClick={salvar} disabled={saving} className="no-print" style={{
            background: "#29ABE2", color: "#fff", border: "none", borderRadius: 6,
            padding: "6px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer",
            opacity: saving ? 0.6 : 1,
          }}>{saving ? "Salvando..." : "Salvar"}</button>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: semanas.length * 100 + 200 }}>
            <thead>
              <tr>
                <th style={{ ...headerCellStyle, textAlign: "left", paddingLeft: 16, position: "sticky", left: 0, background: "#1e1e1e", zIndex: 2 }}>Métrica</th>
                {semanas.map(s => (
                  <th key={s.semana_inicio} style={headerCellStyle}>
                    {pfmtDateShort(s.semana_inicio)} - {pfmtDateShort(s.semana_fim)}
                  </th>
                ))}
                <th style={{ ...headerCellStyle, color: "#f0f0f0", background: "rgba(41,171,226,0.1)" }}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {allRows.map((row, ri) => {
                const isManual = row.type === "manual";
                const isSeparator = ri === manualRows.length;
                return (
                  <tr key={row.label} style={{
                    borderTop: isSeparator ? "2px solid #2e2e2e" : ri > 0 ? "1px solid #1e1e1e" : "none",
                  }}>
                    <td style={{
                      ...rowLabelStyle,
                      background: isManual ? "#1a1a1a" : "#1a1a1a",
                      color: isManual ? "#f0f0f0" : "#808080",
                      fontSize: 12,
                    }}>
                      {row.label}
                      {isManual && <span style={{ marginLeft: 4, fontSize: 9, color: "#7a7a3a" }}>●</span>}
                    </td>
                    {semanas.map(s => {
                      const ed = editando[s.semana_inicio] || {} as any;
                      const val = row.getValue(ed);
                      if (isManual && row.field) {
                        return (
                          <td key={s.semana_inicio} style={{ textAlign: "center", padding: "6px 4px", ...manualCellBg }}>
                            <input
                              type="number"
                              step={row.money ? "0.01" : "1"}
                              value={val || ""}
                              onChange={e => updateEdit(s.semana_inicio, row.field!, parseFloat(e.target.value) || 0)}
                              style={row.money ? moneyInputStyle : inputStyle}
                              className="no-print"
                            />
                            <span className="print-only" style={{ display: "none" }}>{row.format(val)}</span>
                          </td>
                        );
                      }
                      return (
                        <td key={s.semana_inicio} style={autoCellStyle}>
                          {row.format(val)}
                        </td>
                      );
                    })}
                    <td style={totalColStyle}>
                      {row.format(row.getTotal())}
                      {row.getPrev && prevTotals && <PctBadge curr={row.getTotal()} prev={row.getPrev()} inverted={row.inverted} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============================================================ */}
      {/* SECTION 2: Dashboard Panel                                    */}
      {/* ============================================================ */}
      <div className="card" style={{ background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: 12, padding: 24, marginBottom: 32 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: "#f0f0f0" }}>Painel de Performance</h3>
        {prevTotals && <p style={{ fontSize: 11, color: "#606060", marginBottom: 20 }}>Comparação com mês anterior</p>}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 32 }}>
          {/* Left side - KPI grid */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Row 1 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div style={{ background: "rgba(34,197,94,0.15)", borderRadius: 10, padding: "14px 16px" }}>
                <p style={{ fontSize: 11, color: "#86efac", marginBottom: 4 }}>Investimento em Ads</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: "#f0f0f0" }}>{pfmtMoney(totInvestimento)} <PctBadge curr={totInvestimento} prev={prevTotals?.investimento ?? 0} /></p>
              </div>
              <div style={{ background: "rgba(59,130,246,0.15)", borderRadius: 10, padding: "14px 16px" }}>
                <p style={{ fontSize: 11, color: "#93c5fd", marginBottom: 4 }}>Nº de Leads</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: "#f0f0f0" }}>{pfmtNum(totMensagens)} <PctBadge curr={totMensagens} prev={prevTotals?.mensagens ?? 0} /></p>
              </div>
              <div style={{ background: "rgba(245,158,11,0.15)", borderRadius: 10, padding: "14px 16px" }}>
                <p style={{ fontSize: 11, color: "#fcd34d", marginBottom: 4 }}>Custo por Lead</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: "#f0f0f0" }}>{pfmtMoney(totCustoLead)} <PctBadge curr={totCustoLead} prev={prevCL} inverted /></p>
              </div>
            </div>
            {/* Row 2 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div style={{ background: "rgba(249,115,22,0.15)", borderRadius: 10, padding: "14px 16px" }}>
                <p style={{ fontSize: 11, color: "#fdba74", marginBottom: 4 }}>Tx. Conv. p/ Agendamento</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: "#f0f0f0" }}>{pfmtPct(totTaxaLeadAgend)} <PctBadge curr={totTaxaLeadAgend} prev={prevTotals ? safe(prevTotals.agendamentos, prevTotals.mensagens) * 100 : 0} /></p>
              </div>
              <div style={{ background: "rgba(59,130,246,0.15)", borderRadius: 10, padding: "14px 16px" }}>
                <p style={{ fontSize: 11, color: "#93c5fd", marginBottom: 4 }}>Nº de Agendamentos</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: "#f0f0f0" }}>{pfmtNum(totAgendamentos)} <PctBadge curr={totAgendamentos} prev={prevTotals?.agendamentos ?? 0} /></p>
              </div>
              <div />
            </div>
            {/* Row 3 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div style={{ background: "rgba(249,115,22,0.15)", borderRadius: 10, padding: "14px 16px" }}>
                <p style={{ fontSize: 11, color: "#fdba74", marginBottom: 4 }}>Tx. Conv. p/ Comparecimento</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: "#f0f0f0" }}>{pfmtPct(totTaxaAgendRealiz)} <PctBadge curr={totTaxaAgendRealiz} prev={prevTotals ? safe(prevTotals.realizados, prevTotals.agendamentos) * 100 : 0} /></p>
              </div>
              <div style={{ background: "rgba(59,130,246,0.15)", borderRadius: 10, padding: "14px 16px" }}>
                <p style={{ fontSize: 11, color: "#93c5fd", marginBottom: 4 }}>Nº de Realizados</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: "#f0f0f0" }}>{pfmtNum(totRealizados)} <PctBadge curr={totRealizados} prev={prevTotals?.realizados ?? 0} /></p>
              </div>
              <div />
            </div>
            {/* Row 4 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div style={{ background: "rgba(249,115,22,0.15)", borderRadius: 10, padding: "14px 16px" }}>
                <p style={{ fontSize: 11, color: "#fdba74", marginBottom: 4 }}>Tx. Conv. p/ Venda</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: "#f0f0f0" }}>{pfmtPct(totTaxaRealizVenda)} <PctBadge curr={totTaxaRealizVenda} prev={prevTotals ? safe(prevTotals.vendas, prevTotals.realizados) * 100 : 0} /></p>
              </div>
              <div style={{ background: "rgba(59,130,246,0.15)", borderRadius: 10, padding: "14px 16px" }}>
                <p style={{ fontSize: 11, color: "#93c5fd", marginBottom: 4 }}>Nº de Vendas</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: "#f0f0f0" }}>{pfmtNum(totVendas)} <PctBadge curr={totVendas} prev={prevTotals?.vendas ?? 0} /></p>
              </div>
              <div />
            </div>
            {/* Row 5 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div style={{ background: "rgba(139,92,246,0.15)", borderRadius: 10, padding: "14px 16px" }}>
                <p style={{ fontSize: 11, color: "#c4b5fd", marginBottom: 4 }}>TKM</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: "#f0f0f0" }}>{pfmtMoney(totTicketMedio)}</p>
              </div>
              <div style={{ background: "rgba(34,197,94,0.15)", borderRadius: 10, padding: "14px 16px" }}>
                <p style={{ fontSize: 11, color: "#86efac", marginBottom: 4 }}>Faturamento</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: "#f0f0f0" }}>{pfmtMoney(totFaturamento)}</p>
              </div>
              <div style={{ background: "rgba(239,68,68,0.15)", borderRadius: 10, padding: "14px 16px" }}>
                <p style={{ fontSize: 11, color: "#fca5a5", marginBottom: 4 }}>ROAS</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: "#f0f0f0" }}>{totRoas.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}x</p>
              </div>
            </div>
          </div>

          {/* Right side - Funnel */}
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#a0a0a0", marginBottom: 16 }}>Funil de Conversão</p>
            {[
              { label: "Leads", count: totMensagens, bg: "#ef4444", width: "100%" },
              { label: "Agendamentos", count: totAgendamentos, bg: "#f59e0b", width: "80%" },
              { label: "Realizado", count: totRealizados, bg: "#eab308", width: "60%" },
              { label: "Vendas", count: totVendas, bg: "#22c55e", width: "40%" },
            ].map((step, i) => (
              <div key={step.label} style={{
                width: step.width, background: step.bg, borderRadius: 8,
                padding: "12px 16px", textAlign: "center", marginBottom: i < 3 ? 4 : 0,
                transition: "all 0.2s",
              }}>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", marginBottom: 2 }}>{step.label}</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>{pfmtNum(step.count)}</p>
              </div>
            ))}
            <div style={{
              marginTop: 12, background: "rgba(59,130,246,0.2)", borderRadius: 20,
              padding: "6px 16px", fontSize: 11, color: "#93c5fd", fontWeight: 600,
            }}>
              Tx. de Conversão: {pfmtPct(totTaxaLeadVenda)}
            </div>
          </div>
        </div>

        {/* Meta extras KPI cards */}
        {Object.values(metaExtras).some(Boolean) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 20, paddingTop: 16, borderTop: "1px solid #2e2e2e" }}>
            {metaExtras.impressoes && (
              <div style={{ background: "rgba(59,130,246,0.1)", borderRadius: 10, padding: "12px 16px", minWidth: 140 }}>
                <p style={{ fontSize: 11, color: "#93c5fd", marginBottom: 4 }}>Impressões</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: "#f0f0f0" }}>-</p>
              </div>
            )}
            {metaExtras.alcance && (
              <div style={{ background: "rgba(59,130,246,0.1)", borderRadius: 10, padding: "12px 16px", minWidth: 140 }}>
                <p style={{ fontSize: 11, color: "#93c5fd", marginBottom: 4 }}>Alcance</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: "#f0f0f0" }}>-</p>
              </div>
            )}
            {metaExtras.cliques && (
              <div style={{ background: "rgba(59,130,246,0.1)", borderRadius: 10, padding: "12px 16px", minWidth: 140 }}>
                <p style={{ fontSize: 11, color: "#93c5fd", marginBottom: 4 }}>Cliques</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: "#f0f0f0" }}>-</p>
              </div>
            )}
            {metaExtras.ctr && (
              <div style={{ background: "rgba(59,130,246,0.1)", borderRadius: 10, padding: "12px 16px", minWidth: 140 }}>
                <p style={{ fontSize: 11, color: "#93c5fd", marginBottom: 4 }}>CTR</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: "#f0f0f0" }}>-</p>
              </div>
            )}
            {metaExtras.cpm && (
              <div style={{ background: "rgba(59,130,246,0.1)", borderRadius: 10, padding: "12px 16px", minWidth: 140 }}>
                <p style={{ fontSize: 11, color: "#93c5fd", marginBottom: 4 }}>CPM</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: "#f0f0f0" }}>-</p>
              </div>
            )}
            {metaExtras.frequencia && (
              <div style={{ background: "rgba(59,130,246,0.1)", borderRadius: 10, padding: "12px 16px", minWidth: 140 }}>
                <p style={{ fontSize: 11, color: "#93c5fd", marginBottom: 4 }}>Frequência</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: "#f0f0f0" }}>-</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* SECTION 3: Meta Metrics selector                              */}
      {/* ============================================================ */}
      <div className="no-print card" style={{ background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: 12, padding: "16px 20px", marginBottom: 32 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: "#a0a0a0", marginBottom: 12 }}>Métricas Meta (exibir no painel)</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 24px" }}>
          {[
            { key: "impressoes", label: "Impressões" },
            { key: "alcance", label: "Alcance" },
            { key: "cliques", label: "Cliques" },
            { key: "ctr", label: "CTR" },
            { key: "cpm", label: "CPM" },
            { key: "frequencia", label: "Frequência" },
          ].map(item => (
            <label key={item.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#c0c0c0", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={metaExtras[item.key] || false}
                onChange={() => setMetaExtras(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                style={{ accentColor: "#29ABE2" }}
              />
              {item.label}
            </label>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", padding: "20px 0", color: "#404040", fontSize: 12 }}>
        Relatório gerado com <strong style={{ color: "#606060" }}>SALX Convert</strong>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Default export with Suspense wrapper                               */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "60vh",
            color: "#a0a0a0",
            gap: 12,
          }}
        >
          <Loader2 size={28} className="spin" />
          Carregando...
        </div>
      }
    >
      <DashboardInner />
    </Suspense>
  );
}

/* ================================================================== */
/*  STYLES                                                             */
/* ================================================================== */

const cardStyle: React.CSSProperties = {
  background: "#1a1a1a",
  border: "1px solid #2e2e2e",
  borderRadius: 12,
  padding: "22px 24px",
  textAlign: "center",
};

const sectionCard: React.CSSProperties = {
  background: "#1a1a1a",
  border: "1px solid #2e2e2e",
  borderRadius: 12,
  padding: 24,
  marginBottom: 24,
};

const sectionHeaderRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  marginBottom: 4,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  color: "#f0f0f0",
  margin: 0,
  whiteSpace: "nowrap",
};

const sectionLine: React.CSSProperties = {
  flex: 1,
  height: 1,
  background: "#2e2e2e",
};

const tooltipStyle: React.CSSProperties = {
  background: "#1a1a1a",
  border: "1px solid #2e2e2e",
  borderRadius: 8,
  color: "#f0f0f0",
  fontSize: 12,
};

/* --- Table --- */

const tableBase: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const th: React.CSSProperties = {
  padding: "10px 14px",
  textAlign: "left",
  color: "#606060",
  fontWeight: 600,
  fontSize: 11,
  textTransform: "uppercase",
  borderBottom: "1px solid #2e2e2e",
  whiteSpace: "nowrap",
};

const thR: React.CSSProperties = { ...th, textAlign: "right" };

const td: React.CSSProperties = {
  padding: "10px 14px",
  color: "#f0f0f0",
  borderBottom: "1px solid #1f1f1f",
};

const tdR: React.CSSProperties = { ...td, textAlign: "right" };

const rowAlt: React.CSSProperties = {
  background: "rgba(255,255,255,0.02)",
};

/* --- Buttons --- */

const btnPrimary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: BLUE,
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "8px 16px",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "#1a1a1a",
  color: "#a0a0a0",
  border: "1px solid #2e2e2e",
  borderRadius: 8,
  padding: "8px 16px",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
};

/* ================================================================== */
/*  PRINT CSS                                                          */
/* ================================================================== */

const printCSS = `
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.spin {
  animation: spin 1s linear infinite;
}

@media print {
  body, html {
    background: #fff !important;
    color: #1a1a1a !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  /* Show print-only elements */
  .print-only { display: inline !important; }
  input[type="number"] { display: none !important; }

  /* Hide non-print elements */
  .no-print,
  nav,
  aside,
  [data-sidebar],
  header:not(.dashboard-root *) {
    display: none !important;
  }

  .dashboard-root {
    max-width: 100% !important;
    padding: 0 !important;
    margin: 0 !important;
  }

  /* Text colors */
  .dashboard-root h1,
  .dashboard-root h2 {
    color: #1a1a1a !important;
  }

  .dashboard-root p,
  .dashboard-root span {
    color: #444 !important;
  }

  /* Cards white bg */
  .dashboard-root div[style*="background: rgb(26, 26, 26)"],
  .dashboard-root div[style*="background: #1a1a1a"],
  .dashboard-root div[style*="background: #111"] {
    background: #ffffff !important;
    border-color: #ddd !important;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06) !important;
  }

  /* KPI values */
  .dashboard-root div[style*="font-weight: 700"][style*="font-size: 26px"] {
    color: #1a1a1a !important;
  }

  /* Section lines */
  .dashboard-root div[style*="background: rgb(46, 46, 46)"],
  .dashboard-root div[style*="background: #2e2e2e"] {
    background: #ddd !important;
  }

  /* Tables */
  .dashboard-root table th {
    color: #606060 !important;
    border-bottom-color: #ddd !important;
  }

  .dashboard-root table td {
    color: #1a1a1a !important;
    border-bottom-color: #eee !important;
  }

  .dashboard-root table tr[style*="background: rgba(255"] {
    background: #f8f8f8 !important;
  }

  /* Chart axes */
  .recharts-cartesian-axis-tick text {
    fill: #555 !important;
  }

  .recharts-cartesian-axis-line {
    stroke: #ddd !important;
  }

  /* Footer */
  .dashboard-root > div:last-child {
    color: #999 !important;
  }

  @page {
    margin: 1cm;
    size: A4;
  }
}
`;
