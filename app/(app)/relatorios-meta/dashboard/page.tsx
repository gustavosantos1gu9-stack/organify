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

  useEffect(() => {
    if (!relatorioId) {
      setError("ID do relatório não informado");
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/relatorios/dashboard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ relatorio_id: relatorioId }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Erro ao carregar dados");
        setData(json);
      } catch (err: any) {
        setError(err.message || "Erro desconhecido");
      }
      setLoading(false);
    })();
  }, [relatorioId]);

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
        {/* --- Action buttons --- */}
        <div className="no-print" style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <button onClick={() => router.push("/relatorios-meta")} style={btnSecondary}>
            <ArrowLeft size={14} /> Voltar
          </button>
          <button onClick={handlePrint} style={btnPrimary}>
            <Printer size={14} /> Exportar PDF
          </button>
        </div>

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
      </div>
    </>
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
