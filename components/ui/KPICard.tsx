"use client";

interface KPICardProps {
  label: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  iconBg?: "green" | "red" | "blue" | "amber";
  subtitle?: string;
}

// Tons do sistema: o ícone só indica a natureza do número (entrada, saída, neutro, alerta)
const tons = {
  green: { bg: "#E3F2EC", fg: "#1E6B52" },
  red: { bg: "#FBE3E1", fg: "#B42318" },
  blue: { bg: "#E8F1F9", fg: "#144E73" },
  amber: { bg: "#FCE9DA", fg: "#8A3B12" },
};

export default function KPICard({ label, value, change, icon, iconBg = "blue", subtitle }: KPICardProps) {
  const tom = tons[iconBg] ?? tons.blue;
  const changeColor = change === undefined || change === 0 ? "var(--ink-3)" : change > 0 ? "#1E6B52" : "#B42318";
  const changeLabel = change === undefined ? "" : `${change > 0 ? "+" : ""}${change.toFixed(1).replace(".", ",")}% sobre o período anterior`;

  return (
    <div className="kpi-card" style={{ position: "relative", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-2)" }}>{label}</span>
        <span
          aria-hidden="true"
          style={{ width: 30, height: 30, flex: "none", borderRadius: "50%", background: tom.bg, color: tom.fg, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          {icon}
        </span>
      </div>
      <div className="font-title" style={{ fontSize: 30, fontWeight: 600, color: "var(--ink)", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
        {value}
      </div>
      {subtitle
        ? <div style={{ fontSize: 12.5, color: "var(--brand-deep)" }}>{subtitle}</div>
        : change !== undefined && change !== 0
          ? <div style={{ fontSize: 12.5, color: changeColor }}>{changeLabel}</div>
          : null}
    </div>
  );
}
