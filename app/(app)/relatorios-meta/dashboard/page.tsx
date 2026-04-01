"use client";

import { useState, useEffect } from "react";
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
  daily: {
    date: string;
    impressions: number;
    clicks: number;
    spend: number;
    mensagens: number;
  }[];
  campaigns: {
    name: string;
    impressions: number;
    clicks: number;
    spend: number;
    ctr: number;
    mensagens: number;
    cpa: number;
  }[];
  ads: {
    name: string;
    impressions: number;
    clicks: number;
    spend: number;
    ctr: number;
    mensagens: number;
    cpa: number;
  }[];
  placements: {
    platform: string;
    position: string;
    impressions: number;
    clicks: number;
    spend: number;
    ctr: number;
    mensagens: number;
  }[];
  ageGroups: {
    age: string;
    impressions: number;
    clicks: number;
    spend: number;
    mensagens: number;
  }[];
}

function formatNum(n: number): string {
  if (isNaN(n)) return "0";
  return n.toLocaleString("pt-BR");
}

function formatMoney(n: number): string {
  if (isNaN(n)) return "R$ 0,00";
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercent(n: number): string {
  if (isNaN(n)) return "0,00%";
  return `${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function formatDateBR(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatDateShort(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}`;
}

const ACCENT = "#29ABE2";
const AMBER = "#f59e0b";

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const relatorioId = searchParams.get("id");

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!relatorioId) {
      setError("ID do relatorio nao informado");
      setLoading(false);
      return;
    }
    fetchDashboard();
  }, [relatorioId]);

  async function fetchDashboard() {
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
  }

  function handlePrint() {
    window.print();
  }

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh", color: "#a0a0a0" }}>
        <Loader2 size={32} className="spin" style={{ marginRight: 12 }} />
        Carregando dashboard...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <p style={{ color: "#ef4444", marginBottom: 16 }}>{error || "Nenhum dado encontrado"}</p>
        <button onClick={() => router.push("/relatorios-meta")} style={btnSecondary}>
          <ArrowLeft size={14} /> Voltar
        </button>
      </div>
    );
  }

  const { resumo, daily, campaigns, ads, placements, ageGroups } = data;
  const cpl = resumo.mensagens > 0 ? resumo.spend / resumo.mensagens : 0;

  const kpis = [
    { label: "Investimento", sublabel: "Investimento total", value: formatMoney(resumo.spend), color: ACCENT },
    { label: "Cliques", sublabel: "Cliques totais", value: formatNum(resumo.clicks), color: "#22c55e" },
    { label: "Impressoes", sublabel: "Impressoes totais", value: formatNum(resumo.impressions), color: "#8b5cf6" },
    { label: "Mensagens", sublabel: "Mensagens recebidas", value: formatNum(resumo.mensagens), color: "#f59e0b" },
    { label: "CPM", sublabel: "CPM medio", value: formatMoney(resumo.cpm), color: "#ec4899" },
    { label: "CPL", sublabel: "Custo por mensagem", value: formatMoney(cpl), color: "#14b8a6" },
  ];

  return (
    <>
      <style>{printStyles}</style>
      <div className="dashboard-root" style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
        {/* Top buttons */}
        <div className="no-print" style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          <button onClick={() => router.push("/relatorios-meta")} style={btnSecondary}>
            <ArrowLeft size={14} /> Voltar
          </button>
          <button onClick={handlePrint} style={btnPrimary}>
            <Printer size={14} /> Exportar PDF
          </button>
        </div>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#f0f0f0", margin: 0 }}>
            CA {data.nomeCliente}
          </h1>
          <p style={{ fontSize: 16, color: "#a0a0a0", margin: "4px 0" }}>
            Relatorio de Desempenho
          </p>
          <p style={{ fontSize: 14, color: "#606060" }}>
            Periodo: De {formatDateBR(data.periodo.since)} a {formatDateBR(data.periodo.until)}
          </p>
        </div>

        {/* KPI Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32 }}>
          {kpis.map((kpi) => (
            <div key={kpi.label} style={cardStyle}>
              <div style={{ fontSize: 12, color: "#a0a0a0", marginBottom: 4 }}>{kpi.sublabel}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
              <div style={{ fontSize: 11, color: "#606060", marginTop: 2 }}>{kpi.label}</div>
            </div>
          ))}
        </div>

        {/* Desempenho diario - Mensagens */}
        <div style={sectionCard}>
          <h2 style={sectionTitle}>Desempenho diario</h2>
          <p style={{ fontSize: 12, color: "#606060", marginBottom: 16 }}>Mensagens recebidas por dia</p>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDateShort}
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
                  contentStyle={{ background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: 8, color: "#f0f0f0", fontSize: 12 }}
                  labelFormatter={formatDateBR}
                  formatter={(value: number) => [formatNum(value), "Mensagens"]}
                />
                <Bar dataKey="mensagens" radius={[4, 4, 0, 0]}>
                  {daily.map((_, i) => (
                    <Cell key={i} fill={ACCENT} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Investimento diario */}
        <div style={sectionCard}>
          <h2 style={sectionTitle}>Investimento diario</h2>
          <p style={{ fontSize: 12, color: "#606060", marginBottom: 16 }}>Valor investido por dia (R$)</p>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDateShort}
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
                  contentStyle={{ background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: 8, color: "#f0f0f0", fontSize: 12 }}
                  labelFormatter={formatDateBR}
                  formatter={(value: number) => [formatMoney(value), "Investimento"]}
                />
                <Bar dataKey="spend" radius={[4, 4, 0, 0]}>
                  {daily.map((_, i) => (
                    <Cell key={i} fill={AMBER} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Desempenho por Campanha */}
        <div style={sectionCard}>
          <h2 style={sectionTitle}>Desempenho por Campanha</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Nome</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Investimento</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Resultados</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>CPA</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>CTR</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.length === 0 && (
                  <tr><td colSpan={5} style={{ ...tdStyle, textAlign: "center", color: "#606060" }}>Sem dados no periodo</td></tr>
                )}
                {campaigns.map((c, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #2e2e2e" }}>
                    <td style={{ ...tdStyle, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{formatMoney(c.spend)}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{formatNum(c.mensagens)}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{formatMoney(c.cpa)}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{formatPercent(c.ctr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Desempenho por Anuncio */}
        <div style={sectionCard}>
          <h2 style={sectionTitle}>Desempenho por Anuncio</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Anuncio</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Investimento</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Resultados</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>CPA</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>CTR</th>
                </tr>
              </thead>
              <tbody>
                {ads.length === 0 && (
                  <tr><td colSpan={5} style={{ ...tdStyle, textAlign: "center", color: "#606060" }}>Sem dados no periodo</td></tr>
                )}
                {ads.map((a, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #2e2e2e" }}>
                    <td style={{ ...tdStyle, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{formatMoney(a.spend)}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{formatNum(a.mensagens)}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{formatMoney(a.cpa)}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{formatPercent(a.ctr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Desempenho por Posicionamento */}
        <div style={sectionCard}>
          <h2 style={sectionTitle}>Desempenho por posicionamento</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Posicionamento</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Valor gasto</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Impressoes</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Resultados</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>CTR</th>
                </tr>
              </thead>
              <tbody>
                {placements.length === 0 && (
                  <tr><td colSpan={5} style={{ ...tdStyle, textAlign: "center", color: "#606060" }}>Sem dados no periodo</td></tr>
                )}
                {placements.map((p, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #2e2e2e" }}>
                    <td style={tdStyle}>{p.platform} - {p.position}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{formatMoney(p.spend)}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{formatNum(p.impressions)}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{formatNum(p.mensagens)}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{formatPercent(p.ctr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Desempenho por Idade */}
        <div style={sectionCard}>
          <h2 style={sectionTitle}>Desempenho por idade</h2>
          <p style={{ fontSize: 12, color: "#606060", marginBottom: 16 }}>Distribuicao de resultados por faixa etaria</p>
          {ageGroups.length === 0 ? (
            <p style={{ textAlign: "center", color: "#606060", padding: 20 }}>Sem dados no periodo</p>
          ) : (
            <div style={{ width: "100%", height: Math.max(200, ageGroups.length * 45) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ageGroups} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
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
                    contentStyle={{ background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: 8, color: "#f0f0f0", fontSize: 12 }}
                    formatter={(value: number, name: string) => {
                      if (name === "mensagens") return [formatNum(value), "Mensagens"];
                      if (name === "spend") return [formatMoney(value), "Investimento"];
                      return [formatNum(value), name];
                    }}
                  />
                  <Bar dataKey="mensagens" radius={[0, 4, 4, 0]}>
                    {ageGroups.map((_, i) => (
                      <Cell key={i} fill={ACCENT} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", padding: "32px 0 16px", color: "#606060", fontSize: 12 }}>
          Relatorio gerado com SALX Convert
        </div>
      </div>
    </>
  );
}

// --- Styles ---

const cardStyle: React.CSSProperties = {
  background: "#1a1a1a",
  border: "1px solid #2e2e2e",
  borderRadius: 12,
  padding: "20px 24px",
  textAlign: "center",
};

const sectionCard: React.CSSProperties = {
  background: "#1a1a1a",
  border: "1px solid #2e2e2e",
  borderRadius: 12,
  padding: 24,
  marginBottom: 24,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  color: "#f0f0f0",
  margin: "0 0 4px 0",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const thStyle: React.CSSProperties = {
  padding: "10px 14px",
  textAlign: "left",
  color: "#a0a0a0",
  fontWeight: 500,
  fontSize: 11,
  textTransform: "uppercase",
  borderBottom: "1px solid #2e2e2e",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 14px",
  color: "#f0f0f0",
};

const btnPrimary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: ACCENT,
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

// --- Print CSS ---

const printStyles = `
@media print {
  body, html {
    background: #ffffff !important;
    color: #1a1a1a !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .no-print {
    display: none !important;
  }

  .dashboard-root {
    max-width: 100% !important;
    padding: 0 !important;
  }

  .dashboard-root h1 {
    color: #1a1a1a !important;
  }

  .dashboard-root p {
    color: #555 !important;
  }

  .dashboard-root div[style*="background: rgb(26, 26, 26)"],
  .dashboard-root div[style*="background: #1a1a1a"] {
    background: #ffffff !important;
    border-color: #e0e0e0 !important;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08) !important;
  }

  .dashboard-root table th {
    color: #555 !important;
    border-bottom-color: #e0e0e0 !important;
  }

  .dashboard-root table td {
    color: #1a1a1a !important;
    border-bottom-color: #e0e0e0 !important;
  }

  .dashboard-root table tr {
    border-bottom-color: #e0e0e0 !important;
  }

  .recharts-cartesian-axis-tick text {
    fill: #555 !important;
  }

  .recharts-cartesian-axis-line {
    stroke: #e0e0e0 !important;
  }

  @page {
    margin: 1cm;
    size: A4;
  }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.spin {
  animation: spin 1s linear infinite;
}
`;
