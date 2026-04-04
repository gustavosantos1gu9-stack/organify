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

interface DashboardData {
  nomeCliente: string;
  periodo: { since: string; until: string; label: string };
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

  const [activeTab, setActiveTab] = useState<"dashboard" | "performance">("dashboard");

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
      const res = await fetch("/api/relatorios/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relatorio_id: relatorioId, date_from: dateFrom, date_to: dateTo }),
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

  const { resumo, diario, campanhas, anuncios, posicionamentos, idade } = data;
  const cpl = resumo.mensagens > 0 ? resumo.spend / resumo.mensagens : 0;

  const kpis = [
    { label: "Investimento", sub: "total", value: fmtMoney(resumo.spend) },
    { label: "Cliques", sub: "total", value: fmtNum(resumo.clicks) },
    { label: "Impressões", sub: "total", value: fmtNum(resumo.impressions) },
    { label: "Mensagens", sub: "total", value: fmtNum(resumo.mensagens) },
    { label: "CPM", sub: "total", value: fmtMoney(resumo.cpm) },
    { label: "CPL", sub: "total", value: fmtMoney(cpl) },
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
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              style={{ background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: 6, padding: "6px 10px", color: "#f0f0f0", fontSize: 13 }} />
            <span style={{ color: "#606060", fontSize: 13 }}>a</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
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
            Período: De {fmtDate(data.periodo.since)} a {fmtDate(data.periodo.until)}
          </p>
        </div>

        {/* ========================================================= */}
        {/*  KPI CARDS                                                 */}
        {/* ========================================================= */}
        {sections.kpis && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 28 }}>
            {kpis.map((kpi) => (
              <div key={kpi.label} style={cardStyle}>
                <div style={{ fontSize: 26, fontWeight: 700, color: "#f0f0f0", lineHeight: 1.1 }}>
                  {kpi.value}
                </div>
                <div style={{ marginTop: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "#a0a0a0" }}>
                    {kpi.label}
                  </span>
                  <span style={{ fontSize: 11, color: "#505050", marginLeft: 6 }}>{kpi.sub}</span>
                </div>
              </div>
            ))}
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [temWhatsApp, setTemWhatsApp] = useState(false);
  const [nomeCliente, setNomeCliente] = useState("");
  const [editando, setEditando] = useState<Record<string, any>>({});

  const carregar = async () => {
    setLoading(true);
    try {
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
          edit[s.semana_inicio] = { agendamentos: s.agendamentos, comparecimentos: s.comparecimentos, vendas: s.vendas };
        });
        setEditando(edit);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { if (relatorioId) carregar(); }, [relatorioId, dateFrom, dateTo]);

  const salvar = async () => {
    setSaving(true);
    const semsToSave = semanas.map(s => ({
      ...s,
      agendamentos: editando[s.semana_inicio]?.agendamentos ?? s.agendamentos,
      comparecimentos: editando[s.semana_inicio]?.comparecimentos ?? s.comparecimentos,
      vendas: editando[s.semana_inicio]?.vendas ?? s.vendas,
      modo: "manual",
    }));

    try {
      await fetch("/api/relatorios/performance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "salvar",
          relatorio_id: relatorioId,
          agencia_id: "auto",
          semanas: semsToSave,
        }),
      });
      await carregar();
      alert("Dados salvos!");
    } catch { alert("Erro ao salvar"); }
    setSaving(false);
  };

  const updateEdit = (semInicio: string, campo: string, valor: number) => {
    setEditando(prev => ({
      ...prev,
      [semInicio]: { ...prev[semInicio], [campo]: valor },
    }));
  };

  const totalMensagens = semanas.reduce((s, w) => s + (w.mensagens || 0), 0);
  const totalAgendamentos = semanas.reduce((s, w) => s + (editando[w.semana_inicio]?.agendamentos ?? w.agendamentos ?? 0), 0);
  const totalComparecimentos = semanas.reduce((s, w) => s + (editando[w.semana_inicio]?.comparecimentos ?? w.comparecimentos ?? 0), 0);
  const totalVendas = semanas.reduce((s, w) => s + (editando[w.semana_inicio]?.vendas ?? w.vendas ?? 0), 0);
  const totalInvestimento = semanas.reduce((s, w) => s + (w.investimento || 0), 0);

  const taxaAgendamento = totalMensagens > 0 ? ((totalAgendamentos / totalMensagens) * 100) : 0;
  const taxaComparecimento = totalAgendamentos > 0 ? ((totalComparecimentos / totalAgendamentos) * 100) : 0;
  const taxaFechamento = totalComparecimentos > 0 ? ((totalVendas / totalComparecimentos) * 100) : 0;
  const custoAgendamento = totalAgendamentos > 0 ? totalInvestimento / totalAgendamentos : 0;
  const custoVenda = totalVendas > 0 ? totalInvestimento / totalVendas : 0;

  const pfmtNum = (n: number) => n.toLocaleString("pt-BR");
  const pfmtMoney = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const pfmtPct = (n: number) => `${n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  const pfmtDateShort = (d: string) => { const [y, m, day] = d.split("-"); return `${day}/${m}`; };

  const inputStyle = { background: "#222", border: "1px solid #333", borderRadius: 4, padding: "4px 8px", color: "#f0f0f0", fontSize: 13, width: 70, textAlign: "center" as const };

  if (loading) return <div style={{ textAlign: "center", padding: 40, color: "#606060" }}>Carregando performance...</div>;

  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f0f0f0", marginBottom: 4 }}>Performance — {nomeCliente}</h1>
        <p style={{ fontSize: 13, color: "#606060" }}>
          {pfmtDateShort(dateFrom)} a {pfmtDateShort(dateTo)}
          {temWhatsApp && <span style={{ marginLeft: 8, color: "#22c55e", fontSize: 11 }}>● Modo automático</span>}
          {!temWhatsApp && <span style={{ marginLeft: 8, color: "#f59e0b", fontSize: 11 }}>● Modo manual</span>}
        </p>
      </div>

      <div className="card" style={{ background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20, color: "#f0f0f0" }}>Funil de Conversão</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 0, marginBottom: 20, borderBottom: "1px solid #2e2e2e", paddingBottom: 16 }}>
          {[
            { label: "Mensagens → Agendamentos", value: pfmtPct(taxaAgendamento) },
            { label: "Agendamentos → Compareceram", value: pfmtPct(taxaComparecimento) },
            { label: "Compareceram → Vendas", value: pfmtPct(taxaFechamento) },
          ].map((item, i) => (
            <div key={i} style={{ textAlign: "center", padding: "0 16px", borderRight: i < 2 ? "1px solid #2e2e2e" : "none" }}>
              <p style={{ fontSize: 12, color: "#606060", marginBottom: 6 }}>{item.label}</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: item.value === "0,0%" ? "#404040" : "#22c55e" }}>{item.value}</p>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12 }}>
          {[
            { label: "Mensagens", value: pfmtNum(totalMensagens) },
            { label: "Agendamentos", value: pfmtNum(totalAgendamentos) },
            { label: "Compareceram", value: pfmtNum(totalComparecimentos) },
            { label: "Vendas", value: pfmtNum(totalVendas) },
            { label: "Investimento", value: pfmtMoney(totalInvestimento) },
          ].map(item => (
            <div key={item.label} style={{ background: "#141414", borderRadius: 8, padding: "14px 16px" }}>
              <p style={{ fontSize: 12, color: "#606060", marginBottom: 6 }}>{item.label}</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: "#f0f0f0" }}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Custo por Agendamento", value: pfmtMoney(custoAgendamento) },
          { label: "Custo por Venda", value: pfmtMoney(custoVenda) },
          { label: "Custo por Mensagem", value: pfmtMoney(totalMensagens > 0 ? totalInvestimento / totalMensagens : 0) },
          { label: "Taxa Geral (Msg → Venda)", value: pfmtPct(totalMensagens > 0 ? (totalVendas / totalMensagens) * 100 : 0) },
        ].map(item => (
          <div key={item.label} style={{ background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: 12, padding: "16px 20px" }}>
            <p style={{ fontSize: 11, color: "#606060", marginBottom: 6 }}>{item.label}</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: "#f0f0f0" }}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="card" style={{ background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: 12, padding: 0, overflow: "hidden", marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #2e2e2e" }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "#f0f0f0", margin: 0 }}>Desempenho Semanal</h3>
          <button onClick={salvar} disabled={saving} className="no-print" style={{
            background: "#29ABE2", color: "#fff", border: "none", borderRadius: 6,
            padding: "6px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}>{saving ? "Salvando..." : "Salvar"}</button>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {["Semana", "Mensagens", "Investimento", "Agendamentos", "Compareceu", "Vendas", "CPL", "CPA"].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: h === "Semana" ? "left" : "center", fontSize: 11, color: "#606060", fontWeight: 600, borderBottom: "1px solid #2e2e2e" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {semanas.map((s, i) => {
              const ed = editando[s.semana_inicio] || {};
              const ag = ed.agendamentos ?? s.agendamentos ?? 0;
              const comp = ed.comparecimentos ?? s.comparecimentos ?? 0;
              const ven = ed.vendas ?? s.vendas ?? 0;
              const cpl = s.mensagens > 0 ? s.investimento / s.mensagens : 0;
              const cpa = ag > 0 ? s.investimento / ag : 0;
              return (
                <tr key={s.semana_inicio} style={{ borderBottom: "1px solid #1e1e1e", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                  <td style={{ padding: "10px 14px", fontWeight: 500, color: "#f0f0f0" }}>{pfmtDateShort(s.semana_inicio)} - {pfmtDateShort(s.semana_fim)}</td>
                  <td style={{ padding: "10px 14px", textAlign: "center", color: "#a0a0a0" }}>{pfmtNum(s.mensagens)}</td>
                  <td style={{ padding: "10px 14px", textAlign: "center", color: "#a0a0a0" }}>{pfmtMoney(s.investimento)}</td>
                  <td style={{ padding: "10px 14px", textAlign: "center" }}>
                    {temWhatsApp && s.modo === "auto" ? (
                      <span style={{ color: "#22c55e" }}>{pfmtNum(ag)}</span>
                    ) : (
                      <input type="number" value={ag} onChange={e => updateEdit(s.semana_inicio, "agendamentos", parseInt(e.target.value) || 0)} style={inputStyle} className="no-print" />
                    )}
                    <span className="print-only" style={{ display: "none" }}>{ag}</span>
                  </td>
                  <td style={{ padding: "10px 14px", textAlign: "center" }}>
                    {temWhatsApp && s.modo === "auto" ? (
                      <span style={{ color: "#22c55e" }}>{pfmtNum(comp)}</span>
                    ) : (
                      <input type="number" value={comp} onChange={e => updateEdit(s.semana_inicio, "comparecimentos", parseInt(e.target.value) || 0)} style={inputStyle} className="no-print" />
                    )}
                    <span className="print-only" style={{ display: "none" }}>{comp}</span>
                  </td>
                  <td style={{ padding: "10px 14px", textAlign: "center" }}>
                    {temWhatsApp && s.modo === "auto" ? (
                      <span style={{ color: "#22c55e" }}>{pfmtNum(ven)}</span>
                    ) : (
                      <input type="number" value={ven} onChange={e => updateEdit(s.semana_inicio, "vendas", parseInt(e.target.value) || 0)} style={inputStyle} className="no-print" />
                    )}
                    <span className="print-only" style={{ display: "none" }}>{ven}</span>
                  </td>
                  <td style={{ padding: "10px 14px", textAlign: "center", color: "#a0a0a0" }}>{pfmtMoney(cpl)}</td>
                  <td style={{ padding: "10px 14px", textAlign: "center", color: "#a0a0a0" }}>{pfmtMoney(cpa)}</td>
                </tr>
              );
            })}
            <tr style={{ borderTop: "2px solid #2e2e2e", background: "rgba(41,171,226,0.05)" }}>
              <td style={{ padding: "12px 14px", fontWeight: 700, color: "#f0f0f0" }}>TOTAL</td>
              <td style={{ padding: "12px 14px", textAlign: "center", fontWeight: 700, color: "#f0f0f0" }}>{pfmtNum(totalMensagens)}</td>
              <td style={{ padding: "12px 14px", textAlign: "center", fontWeight: 700, color: "#f0f0f0" }}>{pfmtMoney(totalInvestimento)}</td>
              <td style={{ padding: "12px 14px", textAlign: "center", fontWeight: 700, color: "#29ABE2" }}>{pfmtNum(totalAgendamentos)}</td>
              <td style={{ padding: "12px 14px", textAlign: "center", fontWeight: 700, color: "#29ABE2" }}>{pfmtNum(totalComparecimentos)}</td>
              <td style={{ padding: "12px 14px", textAlign: "center", fontWeight: 700, color: "#22c55e" }}>{pfmtNum(totalVendas)}</td>
              <td style={{ padding: "12px 14px", textAlign: "center", fontWeight: 700, color: "#f0f0f0" }}>{pfmtMoney(totalMensagens > 0 ? totalInvestimento / totalMensagens : 0)}</td>
              <td style={{ padding: "12px 14px", textAlign: "center", fontWeight: 700, color: "#f0f0f0" }}>{pfmtMoney(custoAgendamento)}</td>
            </tr>
          </tbody>
        </table>
      </div>

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
