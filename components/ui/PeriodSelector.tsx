"use client";

import { useState } from "react";
import { Calendar } from "lucide-react";

const PERIODS = ["Hoje", "Ontem", "Semana atual", "Mês atual", "Mês anterior", "30 dias", "90 dias"];

interface PeriodSelectorProps {
  onChange?: (period: string, from: string, to: string) => void;
}

function getDateRange(period: string): { from: string; to: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  switch (period) {
    case "Hoje": return { from: fmt(today), to: fmt(today) };
    case "Ontem": {
      const y = new Date(today); y.setDate(y.getDate() - 1);
      return { from: fmt(y), to: fmt(y) };
    }
    case "Semana atual": {
      const d = new Date(today); d.setDate(d.getDate() - d.getDay());
      return { from: fmt(d), to: fmt(today) };
    }
    case "Mês atual": return { from: fmt(firstOfMonth), to: fmt(lastOfMonth) };
    case "Mês anterior": {
      const f = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const l = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: fmt(f), to: fmt(l) };
    }
    case "30 dias": {
      const d = new Date(today); d.setDate(d.getDate() - 30);
      return { from: fmt(d), to: fmt(today) };
    }
    case "90 dias": {
      const d = new Date(today); d.setDate(d.getDate() - 90);
      return { from: fmt(d), to: fmt(today) };
    }
    default: return { from: fmt(firstOfMonth), to: fmt(lastOfMonth) };
  }
}

export default function PeriodSelector({ onChange }: PeriodSelectorProps) {
  const [active, setActive] = useState("Mês atual");
  const [range, setRange] = useState(getDateRange("Mês atual"));

  const handlePeriod = (p: string) => {
    const r = getDateRange(p);
    setActive(p);
    setRange(r);
    onChange?.(p, r.from, r.to);
  };

  return (
    <div
      style={{
        background: "#1e1e1e",
        border: "1px solid #2e2e2e",
        borderRadius: "12px",
        padding: "16px 20px",
        marginBottom: "24px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Calendar size={15} color="#a0a0a0" />
          <span style={{ fontSize: "13px", color: "#a0a0a0", fontWeight: "500" }}>Período</span>
        </div>
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
          {PERIODS.map((p) => (
            <button
              key={p}
              className={`period-pill ${active === p ? "active" : ""}`}
              onClick={() => handlePeriod(p)}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "12px" }}>
        <span style={{ fontSize: "12px", color: "#606060" }}>De</span>
        <input
          type="date"
          value={range.from}
          onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
          style={{ padding: "5px 8px", fontSize: "12px", borderRadius: "6px" }}
        />
        <span style={{ fontSize: "12px", color: "#606060" }}>Até</span>
        <input
          type="date"
          value={range.to}
          onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
          style={{ padding: "5px 8px", fontSize: "12px", borderRadius: "6px" }}
        />
      </div>
    </div>
  );
}
