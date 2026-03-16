"use client";

interface KPICardProps {
  label: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  iconBg?: "green" | "red" | "blue" | "amber";
}

const iconBgMap = {
  green: "rgba(34,197,94,0.12)",
  red: "rgba(239,68,68,0.12)",
  blue: "rgba(59,130,246,0.12)",
  amber: "rgba(245,158,11,0.12)",
};
const iconColorMap = {
  green: "#22c55e",
  red: "#ef4444",
  blue: "#3b82f6",
  amber: "#f59e0b",
};

export default function KPICard({
  label,
  value,
  change,
  icon,
  iconBg = "green",
}: KPICardProps) {
  const changeColor =
    change === undefined ? "#606060"
    : change > 0 ? "#22c55e"
    : change < 0 ? "#ef4444"
    : "#606060";

  const changeLabel =
    change === undefined ? "0% vs. último período"
    : `${change > 0 ? "+" : ""}${change.toFixed(1)}% vs. último período`;

  return (
    <div className="kpi-card" style={{ position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
        <span style={{ fontSize: "13px", color: "#a0a0a0" }}>{label}</span>
        <div
          style={{
            width: "34px",
            height: "34px",
            borderRadius: "8px",
            background: iconBgMap[iconBg],
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: iconColorMap[iconBg],
          }}
        >
          {icon}
        </div>
      </div>
      <div style={{ fontSize: "24px", fontWeight: "700", color: "#f0f0f0", marginBottom: "8px" }}>
        {value}
      </div>
      <div style={{ fontSize: "12px", color: changeColor }}>{changeLabel}</div>
    </div>
  );
}
