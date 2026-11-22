"use client";

import { ReactNode } from "react";
import Link from "next/link";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** ReactNode — buttons, filters, etc. rendered on the right side */
  actions?: ReactNode;
  /** If provided, renders a back arrow link */
  backHref?: string;
}

export function PageHeader({ title, subtitle, actions, backHref }: PageHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 16,
        marginBottom: 28,
        flexWrap: "wrap",
      }}
    >
      {/* Left side */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        {backHref && (
          <Link
            href={backHref}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              borderRadius: "var(--radius-md)",
              background: "var(--card-bg)",
              boxShadow: "var(--shadow-btn)",
              color: "var(--text-secondary)",
              textDecoration: "none",
              flexShrink: 0,
              marginTop: 2,
              transition: "color 0.15s, transform 0.15s",
            }}
            aria-label="Voltar"
          >
            {/* Simple left arrow — no lucide dependency in layout util */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
        )}

        <div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 600,
              color: "var(--navy)",
              lineHeight: 1.2,
              letterSpacing: "-0.01em",
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              style={{
                fontSize: 14,
                color: "var(--text-secondary)",
                marginTop: 4,
                lineHeight: 1.4,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right side — actions */}
      {actions && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            flexShrink: 0,
          }}
        >
          {actions}
        </div>
      )}
    </div>
  );
}

export default PageHeader;
