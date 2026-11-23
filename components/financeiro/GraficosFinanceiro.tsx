"use client";

// Gráficos do Financeiro, carregados à parte (a biblioteca de gráficos é pesada)
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

const fmt = (v: number) => formatCurrency(v);
const tooltipStyle = { background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px", color: "var(--navy)" };

export default function GraficosFinanceiro({ graficos, pieData }: {
  graficos: { mes: string; entrada: number; saida: number }[];
  pieData: { name: string; value: number }[];
}) {
  return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
        <div className="card">
          <h3 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "20px", color: "var(--navy)" }}>Entrada x Saída</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={graficos ?? []}>
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} tickFormatter={v => `R$${v}`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
              <Line type="monotone" dataKey="entrada" stroke="var(--brand)" strokeWidth={2} dot={false} name="Entrada" />
              <Line type="monotone" dataKey="saida" stroke="var(--alert-text)" strokeWidth={2} dot={false} name="Saída" />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "20px", color: "var(--navy)" }}>Distribuição de clientes</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                <Cell fill="var(--brand)" /><Cell fill="var(--alert-text)" />
              </Pie>
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>


  );
}
