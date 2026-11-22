"use client";

import { ReactNode } from "react";

interface EmptyStateProps {
  /** Lucide icon element or any ReactNode */
  icon?: ReactNode;
  title: string;
  description?: string;
  /** Optional CTA — usually a Button */
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: "60px 24px",
        textAlign: "center",
      }}
    >
      {icon && (
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "var(--radius-lg)",
            background: "var(--hover-row)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-secondary)",
            marginBottom: 4,
          }}
        >
          {icon}
        </div>
      )}

      <p
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: "var(--navy)",
          lineHeight: 1.3,
        }}
      >
        {title}
      </p>

      {description && (
        <p
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            maxWidth: 360,
            lineHeight: 1.5,
          }}
        >
          {description}
        </p>
      )}

      {action && (
        <div style={{ marginTop: 8 }}>
          {action}
        </div>
      )}
    </div>
  );
}

export default EmptyState;
