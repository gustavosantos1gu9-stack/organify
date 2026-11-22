"use client";

import { ReactNode, CSSProperties } from "react";

interface Trend {
  value: number;
  label: string;
}

interface StatCardProps {
  label: string;
  value: string | number;
  note?: string;
  /** Lucide icon element */
  icon?: ReactNode;
  trend?: Trend;
  /** Accent color for the icon background — defaults to navy */
  color?: string;
  className?: string;
  style?: CSSProperties;
}

export function StatCard({
  label,
  value,
  note,
  icon,
  trend,
  color = "var(--navy)",
  className = "",
  style,
}: StatCardProps) {
  const trendPositive = trend && trend.value > 0;
  const trendNegative = trend && trend.value < 0;

  const trendColor = trendPositive
    ? "var(--success)"
    : trendNegative
    ? "var(--alert-text)"
    : "var(--text-secondary)";

  return (
    <div
      className={`kpi-card${className ? ` ${className}` : ""}`}
      style={style}
    >
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--text-secondary)",
          }}
        >
          {label}
        </span>

        {icon && (
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "var(--radius-md)",
              background: color === "var(--navy)" ? "var(--phase3-bg)" : `${color}18`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color,
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
        )}
      </div>

      {/* Value */}
      <div
        style={{
          fontSize: 30,
          fontWeight: 700,
          color: "var(--navy)",
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>

      {/* Trend + Note row */}
      {(trend || note) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 8,
          }}
        >
          {trend && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: trendColor,
              }}
            >
              {trendPositive ? "+" : ""}
              {trend.value}% {trend.label}
            </span>
          )}
          {note && (
            <span
              style={{
                fontSize: 12,
                color: "var(--text-secondary)",
              }}
            >
              {note}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default StatCard;
