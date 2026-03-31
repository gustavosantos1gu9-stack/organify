"use client";

import { useState, useEffect, useRef } from "react";
import { User, LogOut, UserCircle, Building2, ChevronDown, ArrowLeftRight } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/hooks";

interface AgenciaOption {
  id: string;
  nome: string;
  parent_id: string | null;
}

export default function Topbar() {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Seletor de agência
  const [agencias, setAgencias] = useState<AgenciaOption[]>([]);
  const [agenciaAtual, setAgenciaAtual] = useState<AgenciaOption | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const selectorRef = useRef<HTMLDivElement>(null);
  const [isMaster, setIsMaster] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setNome(user.user_metadata?.nome || user.user_metadata?.full_name || user.email?.split("@")[0] || "Usuário");
      }
    });

    // Carregar agências filhas (se for admin)
    carregarAgencias();

    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) setSelectorOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function carregarAgencias() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch("/api/agencias-filhas", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) return;
      const filhas = await res.json();
      if (!Array.isArray(filhas)) return;

      // Buscar agência atual do localStorage ou padrão
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar a agência master
      const { data: usuario } = await supabase
        .from("usuarios")
        .select("agencia_id")
        .eq("auth_user_id", user.id)
        .single();

      let masterId: string | null = null;
      if (!usuario) {
        // Dono — buscar agência sem parent
        const { data: ag } = await supabase
          .from("agencias")
          .select("id, nome, parent_id")
          .is("parent_id", null)
          .limit(1)
          .single();
        if (ag) masterId = ag.id;
      }

      if (!masterId) return;
      setIsMaster(true);

      const master: AgenciaOption = { id: masterId, nome: "SALX (Master)", parent_id: null };
      const todas = [master, ...filhas.map((f: any) => ({ id: f.id, nome: f.nome, parent_id: masterId }))];
      setAgencias(todas);

      // Verificar se tem seleção salva
      const savedId = localStorage.getItem("agencia_selecionada");
      const saved = todas.find(a => a.id === savedId);
      setAgenciaAtual(saved || master);
    } catch {}
  }

  function selecionarAgencia(ag: AgenciaOption) {
    setAgenciaAtual(ag);
    localStorage.setItem("agencia_selecionada", ag.id);
    setSelectorOpen(false);
    // Redirecionar pra home e recarregar
    window.location.href = "/";
  }

  const handleSair = async () => {
    localStorage.removeItem("agencia_selecionada");
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <header style={{
      height: "60px", background: "#141414", borderBottom: "1px solid #2e2e2e",
      display: "flex", alignItems: "center", justifyContent: "flex-end",
      padding: "0 24px", gap: "12px", position: "sticky", top: 0, zIndex: 10,
    }}>
      {/* Seletor de agência */}
      {isMaster && agencias.length > 1 && (
        <div ref={selectorRef} style={{ position: "relative", marginRight: "auto" }}>
          <button onClick={() => setSelectorOpen(!selectorOpen)} style={{
            display: "flex", alignItems: "center", gap: "8px",
            background: agenciaAtual?.parent_id ? "rgba(41,171,226,0.1)" : "#1e1e1e",
            border: `1px solid ${agenciaAtual?.parent_id ? "rgba(41,171,226,0.3)" : "#3a3a3a"}`,
            borderRadius: "8px", padding: "6px 14px", cursor: "pointer",
            color: "#f0f0f0", fontSize: "13px", fontWeight: "500",
          }}>
            <ArrowLeftRight size={14} color="#29ABE2" />
            {agenciaAtual?.nome || "Selecionar agência"}
            <ChevronDown size={14} color="#606060" />
          </button>

          {selectorOpen && (
            <div style={{
              position: "absolute", left: 0, top: "calc(100% + 6px)",
              background: "#1e1e1e", border: "1px solid #3a3a3a",
              borderRadius: "10px", minWidth: "220px", overflow: "hidden",
              boxShadow: "0 4px 16px rgba(0,0,0,0.4)", zIndex: 100,
            }}>
              {agencias.map(ag => (
                <button key={ag.id} onClick={() => selecionarAgencia(ag)} style={{
                  width: "100%", display: "flex", alignItems: "center", gap: "10px",
                  padding: "10px 16px", background: ag.id === agenciaAtual?.id ? "rgba(41,171,226,0.08)" : "transparent",
                  border: "none", borderBottom: "1px solid #2e2e2e",
                  color: ag.id === agenciaAtual?.id ? "#29ABE2" : "#a0a0a0",
                  fontSize: "13px", cursor: "pointer", textAlign: "left",
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => { if (ag.id !== agenciaAtual?.id) e.currentTarget.style.background = "#2a2a2a"; }}
                onMouseLeave={e => { if (ag.id !== agenciaAtual?.id) e.currentTarget.style.background = "transparent"; }}>
                  <Building2 size={14} />
                  <span>{ag.nome}</span>
                  {!ag.parent_id && (
                    <span style={{
                      fontSize: "9px", fontWeight: "700", padding: "2px 6px",
                      borderRadius: "4px", background: "#29ABE2", color: "#000", marginLeft: "auto",
                    }}>MASTER</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {isMaster && (
        <span style={{
          background: "#29ABE2", color: "#000", fontSize: "10px",
          fontWeight: "700", padding: "3px 8px", borderRadius: "4px", letterSpacing: "0.05em",
        }}>ROOT</span>
      )}

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
