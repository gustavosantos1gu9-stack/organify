"use client";

import { ReactNode } from "react";

interface SectionTitleProps {
  children: ReactNode;
  description?: string;
}

export function SectionTitle({ children, description }: SectionTitleProps) {
  return (
    <div style={{ marginBottom: description ? 16 : 12 }}>
      <h2
        style={{
          fontSize: 17,
          fontWeight: 600,
          color: "var(--navy)",
          lineHeight: 1.3,
          letterSpacing: "-0.005em",
        }}
      >
        {children}
      </h2>
      {description && (
        <p
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            marginTop: 4,
            lineHeight: 1.5,
          }}
        >
          {description}
        </p>
      )}
    </div>
  );
}

export default SectionTitle;
