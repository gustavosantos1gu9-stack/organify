"use client";

import { useState, useEffect, useRef } from "react";
import { User, LogOut, UserCircle } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/hooks";

export default function Topbar() {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setNome(user.user_metadata?.nome || user.user_metadata?.full_name || user.email?.split("@")[0] || "Usuário");
      }
    });
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSair = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <header style={{
      height: "60px", background: "#141414", borderBottom: "1px solid #2e2e2e",
      display: "flex", alignItems: "center", justifyContent: "flex-end",
      padding: "0 24px", gap: "12px", position: "sticky", top: 0, zIndex: 10,
    }}>
      <span style={{
        background: "#22c55e", color: "#000", fontSize: "10px",
        fontWeight: "700", padding: "3px 8px", borderRadius: "4px", letterSpacing: "0.05em",
      }}>ROOT</span>

      <div ref={ref} style={{ position: "relative" }}>
        <button onClick={() => setOpen(!open)} style={{
          width: "34px", height: "34px", borderRadius: "50%",
          background: "#2a2a2a", border: "1px solid #3a3a3a",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", color: "#a0a0a0",
        }}>
          <User size={16}/>
        </button>

        {open && (
          <div style={{
            position: "absolute", right: 0, top: "calc(100% + 8px)",
            background: "#1e1e1e", border: "1px solid #3a3a3a",
            borderRadius: "10px", minWidth: "180px", overflow: "hidden",
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)", zIndex: 100,
          }}>
            {/* Nome */}
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #2e2e2e" }}>
              <p style={{ fontSize: "13px", fontWeight: "600", color: "#f0f0f0" }}>{nome}</p>
              <p style={{ fontSize: "11px", color: "#606060" }}>Administrador</p>
            </div>

            {/* Perfil */}
            <Link href="/perfil" onClick={() => setOpen(false)} style={{
              display: "flex", alignItems: "center", gap: "10px",
              padding: "10px 16px", color: "#a0a0a0", textDecoration: "none",
              fontSize: "13px", transition: "background 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "#2a2a2a")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              <UserCircle size={14}/>
              Perfil
            </Link>

            {/* Sair */}
            <button onClick={handleSair} style={{
              width: "100%", display: "flex", alignItems: "center", gap: "10px",
              padding: "10px 16px", background: "none", border: "none",
              color: "#ef4444", fontSize: "13px", cursor: "pointer", textAlign: "left",
              borderTop: "1px solid #2e2e2e", transition: "background 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.08)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              <LogOut size={14}/>
              Sair
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
