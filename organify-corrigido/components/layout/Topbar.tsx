"use client";

import { Bell, User } from "lucide-react";

export default function Topbar() {
  return (
    <header
      style={{
        height: "60px",
        background: "#141414",
        borderBottom: "1px solid #2e2e2e",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        padding: "0 24px",
        gap: "12px",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <span
        style={{
          background: "#22c55e",
          color: "#000",
          fontSize: "10px",
          fontWeight: "700",
          padding: "3px 8px",
          borderRadius: "4px",
          letterSpacing: "0.05em",
        }}
      >
        ROOT
      </span>
      <button
        style={{
          width: "34px",
          height: "34px",
          borderRadius: "50%",
          background: "#2a2a2a",
          border: "1px solid #3a3a3a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "#a0a0a0",
        }}
      >
        <User size={16} />
      </button>
    </header>
  );
}
