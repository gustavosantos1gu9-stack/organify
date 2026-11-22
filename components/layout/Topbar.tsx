"use client";

import { useState, useEffect, useRef } from "react";
import { User, LogOut, UserCircle, Building2, ChevronDown, ArrowLeftRight, Wifi, WifiOff, Settings, Menu } from "lucide-react";
import Link from "next/link";
import { supabase, getAgenciaId } from "@/lib/hooks";

interface AgenciaOption {
  id: string;
  nome: string;
  parent_id: string | null;
}

interface TopbarProps {
  onMenuToggle?: () => void;
}

export default function Topbar({ onMenuToggle }: TopbarProps) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Agency selector
  const [agencias, setAgencias] = useState<AgenciaOption[]>([]);
  const [agenciaAtual, setAgenciaAtual] = useState<AgenciaOption | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const selectorRef = useRef<HTMLDivElement>(null);
  const [isMaster, setIsMaster] = useState(false);

  // WhatsApp status
  const [waConectado, setWaConectado] = useState<boolean | null>(null);
  const [reconexaoToken, setReconexaoToken] = useState<string | null>(null);
  const [linkCopiado, setLinkCopiado] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setNome(user.user_metadata?.nome || user.user_metadata?.full_name || user.email?.split("@")[0] || "Usuário");
      }
    });

    carregarAgencias();
    verificarWhatsApp();
    const waInterval = setInterval(verificarWhatsApp, 30000);

    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) setSelectorOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => { document.removeEventListener("mousedown", handler); clearInterval(waInterval); };
  }, []);

  async function verificarWhatsApp() {
    try {
      const agId = await getAgenciaId();
      if (!agId) return;
      const { data: ag } = await supabase.from("agencias").select("whatsapp_conectado, whatsapp_instancia, evolution_url, evolution_key, parent_id, reconexao_token").eq("id", agId).single();
      if (!ag) return;

      if (ag.reconexao_token) setReconexaoToken(ag.reconexao_token);
      if (ag.whatsapp_conectado) { setWaConectado(true); return; }

      let evoUrl = ag.evolution_url || "";
      let evoKey = ag.evolution_key || "";
      if (!evoUrl && ag.parent_id) {
        const { data: parent } = await supabase.from("agencias").select("evolution_url, evolution_key").eq("id", ag.parent_id).single();
        if (parent) { evoUrl = parent.evolution_url || ""; evoKey = parent.evolution_key || ""; }
      }

      if (!evoUrl || !evoKey || !ag.whatsapp_instancia) { setWaConectado(false); return; }

      const res = await fetch(`${evoUrl}/instance/connectionState/${ag.whatsapp_instancia}`, { headers: { apikey: evoKey } });
      const data = await res.json();
      const state = (data.instance?.state || data.state || "").toLowerCase();
      const conectado = state === "open" || state === "connected";
      setWaConectado(conectado);
      if (conectado) {
        await supabase.from("agencias").update({ whatsapp_conectado: true }).eq("id", agId);
      }
    } catch { setWaConectado(false); }
  }

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

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: _usuarios } = await supabase
        .from("usuarios")
        .select("agencia_id")
        .eq("auth_user_id", user.id)
        .limit(1);
      const usuario = _usuarios?.[0] || null;

      let masterId: string | null = null;
      if (!usuario) {
        const { data: ag } = await supabase
          .from("agencias")
          .select("id, nome, parent_id")
          .is("parent_id", null)
          .limit(1)
          .single();
        if (ag) masterId = ag.id;
      }

      if (!masterId && usuario) {
        // Usuário da equipe — verificar se tem acesso a agências filhas
        const { data: acessos } = await supabase
          .from("usuarios_agencias")
          .select("agencia_id")
          .eq("usuario_id", usuario.agencia_id ? undefined! : ""); // placeholder

        // Buscar por auth_user_id via query direta
        const { data: _userRows } = await supabase
          .from("usuarios")
          .select("id")
          .eq("auth_user_id", user.id)
          .limit(1);
        const userRow = _userRows?.[0] || null;

        if (userRow) {
          const { data: acessosFilhas } = await supabase
            .from("usuarios_agencias")
            .select("agencia_id, agencias!usuarios_agencias_agencia_id_fkey(nome)")
            .eq("usuario_id", userRow.id);

          if (acessosFilhas && acessosFilhas.length > 0) {
            const agPrincipal: AgenciaOption = { id: usuario.agencia_id, nome: "Minha Agência", parent_id: null };
            const filhasAcesso = acessosFilhas.map((a: any) => ({
              id: a.agencia_id,
              nome: (a.agencias as any)?.nome || a.agencia_id,
              parent_id: usuario.agencia_id,
            }));
            setAgencias([agPrincipal, ...filhasAcesso]);
            setIsMaster(true);
            const savedId = sessionStorage.getItem("agencia_selecionada");
            const saved = [agPrincipal, ...filhasAcesso].find(a => a.id === savedId);
            setAgenciaAtual(saved || agPrincipal);
            return;
          }
        }
        return;
      }

      if (!masterId) return;
      setIsMaster(true);

      const master: AgenciaOption = { id: masterId, nome: "SALX (Master)", parent_id: null };
      const todas = [master, ...filhas.map((f: any) => ({ id: f.id, nome: f.nome, parent_id: masterId }))];
      setAgencias(todas);

      const savedId = sessionStorage.getItem("agencia_selecionada");
      const saved = todas.find(a => a.id === savedId);
      setAgenciaAtual(saved || master);
    } catch {}
  }

  function selecionarAgencia(ag: AgenciaOption) {
    setAgenciaAtual(ag);
    sessionStorage.setItem("agencia_selecionada", ag.id);
    setSelectorOpen(false);
    window.location.href = "/";
  }

  const handleSair = async () => {
    sessionStorage.removeItem("agencia_selecionada");
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <header style={{
      height: "64px",
      background: "rgba(238,241,244,0.85)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      borderBottom: "1px solid var(--border)",
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-end",
      padding: "0 32px",
      gap: "12px",
      position: "sticky",
      top: 0,
      zIndex: 40,
    }}>
      {/* Mobile hamburger */}
      <button
        onClick={onMenuToggle}
        style={{
          display: "none",
          alignItems: "center",
          justifyContent: "center",
          width: "36px",
          height: "36px",
          borderRadius: "10px",
          background: "var(--card-bg)",
          border: "1px solid var(--border)",
          cursor: "pointer",
          color: "var(--navy)",
          marginRight: "auto",
        }}
        className="topbar-hamburger"
      >
        <Menu size={18} strokeWidth={1.8} />
      </button>

      {/* Agency selector */}
      {isMaster && agencias.length > 1 && (
        <div ref={selectorRef} style={{ position: "relative", marginRight: "auto" }}>
          <button onClick={() => setSelectorOpen(!selectorOpen)} style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: agenciaAtual?.parent_id ? "rgba(28,108,166,0.08)" : "var(--card-bg)",
            border: `1px solid ${agenciaAtual?.parent_id ? "rgba(28,108,166,0.25)" : "var(--border)"}`,
            borderRadius: "20px",
            padding: "6px 14px",
            cursor: "pointer",
            color: "var(--navy)",
            fontSize: "13px",
            fontWeight: "500",
            boxShadow: "var(--shadow-card)",
          }}>
            <ArrowLeftRight size={14} color="var(--brand)" strokeWidth={1.8} />
            {agenciaAtual?.nome || "Selecionar agência"}
            <ChevronDown size={14} color="var(--text-secondary)" strokeWidth={1.8} />
          </button>

          {selectorOpen && (
            <div style={{
              position: "absolute",
              left: 0,
              top: "calc(100% + 6px)",
              background: "var(--card-bg)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              minWidth: "220px",
              overflow: "hidden",
              boxShadow: "var(--shadow-hover)",
              zIndex: 100,
            }}>
              {agencias.map(ag => (
                <button key={ag.id} onClick={() => selecionarAgencia(ag)} style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 16px",
                  background: ag.id === agenciaAtual?.id ? "rgba(28,108,166,0.06)" : "transparent",
                  border: "none",
                  borderBottom: "1px solid var(--border)",
                  color: ag.id === agenciaAtual?.id ? "var(--brand)" : "var(--text-secondary)",
                  fontSize: "13px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => { if (ag.id !== agenciaAtual?.id) e.currentTarget.style.background = "var(--hover-row)"; }}
                onMouseLeave={e => { if (ag.id !== agenciaAtual?.id) e.currentTarget.style.background = "transparent"; }}>
                  <Building2 size={14} strokeWidth={1.8} />
                  <span>{ag.nome}</span>
                  {!ag.parent_id && (
                    <span style={{
                      fontSize: "9px",
                      fontWeight: "700",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      background: "var(--brand)",
                      color: "#FFFFFF",
                      marginLeft: "auto",
                    }}>MASTER</span>
                  )}
                </button>
              ))}
              <Link href="/configuracoes/whatsapp-contas" onClick={() => setSelectorOpen(false)} style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 16px",
                background: "transparent",
                border: "none",
                borderTop: "1px solid var(--border)",
                color: "var(--brand)",
                fontSize: "13px",
                cursor: "pointer",
                textDecoration: "none",
                transition: "background 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(28,108,166,0.06)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <Settings size={14} strokeWidth={1.8} />
                <span>Gerenciar Contas</span>
              </Link>
            </div>
          )}
        </div>
      )}

      {/* WhatsApp status */}
      {waConectado !== null && (
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Link href="/configuracoes/integracoes" style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "4px 10px",
            borderRadius: "20px",
            textDecoration: "none",
            fontSize: "11px",
            fontWeight: "500",
            cursor: "pointer",
            background: waConectado ? "rgba(30,107,82,0.08)" : "rgba(180,35,24,0.08)",
            border: `1px solid ${waConectado ? "rgba(30,107,82,0.25)" : "rgba(180,35,24,0.25)"}`,
            color: waConectado ? "var(--success)" : "var(--alert-text)",
          }}>
            {waConectado ? <Wifi size={12} strokeWidth={1.8} /> : <WifiOff size={12} strokeWidth={1.8} />}
            {waConectado ? "WhatsApp Conectado" : "WhatsApp Desconectado"}
          </Link>
          {!waConectado && reconexaoToken && (
            <button
              title="Copiar link de reconexão para enviar à cliente"
              onClick={() => {
                const link = `${window.location.origin}/reconectar/${reconexaoToken}`;
                navigator.clipboard.writeText(link).then(() => {
                  setLinkCopiado(true);
                  setTimeout(() => setLinkCopiado(false), 2500);
                }).catch(() => {});
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: "4px 8px",
                borderRadius: "20px",
                cursor: "pointer",
                background: linkCopiado ? "rgba(30,107,82,0.08)" : "rgba(180,35,24,0.06)",
                border: `1px solid ${linkCopiado ? "rgba(30,107,82,0.25)" : "rgba(180,35,24,0.2)"}`,
                color: linkCopiado ? "var(--success)" : "var(--alert-text)",
                fontSize: "11px",
                fontWeight: "500",
              }}
            >
              {linkCopiado ? "✓ Copiado" : "📋 Copiar link"}
            </button>
          )}
        </div>
      )}

      {isMaster && (
        <span style={{
          background: "var(--brand)",
          color: "#FFFFFF",
          fontSize: "10px",
          fontWeight: "700",
          padding: "3px 8px",
          borderRadius: "4px",
          letterSpacing: "0.05em",
        }}>ROOT</span>
      )}

      <div ref={ref} style={{ position: "relative" }}>
        <button onClick={() => setOpen(!open)} style={{
          width: "36px",
          height: "36px",
          borderRadius: "50%",
          background: "var(--card-bg)",
          border: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "var(--text-secondary)",
          boxShadow: "var(--shadow-card)",
        }}>
          <User size={16} strokeWidth={1.8} />
        </button>

        {open && (
          <div style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            background: "var(--card-bg)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            minWidth: "180px",
            overflow: "hidden",
            boxShadow: "var(--shadow-hover)",
            zIndex: 100,
          }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
              <p style={{ fontSize: "13px", fontWeight: "600", color: "var(--navy)" }}>{nome}</p>
              <p style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Administrador</p>
            </div>
            <Link href="/perfil" onClick={() => setOpen(false)} style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 16px",
              color: "var(--text-secondary)",
              textDecoration: "none",
              fontSize: "13px",
              transition: "background 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--hover-row)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              <UserCircle size={14} strokeWidth={1.8} />
              Perfil
            </Link>
            <button onClick={handleSair} style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 16px",
              background: "none",
              border: "none",
              color: "var(--alert-text)",
              fontSize: "13px",
              cursor: "pointer",
              textAlign: "left",
              borderTop: "1px solid var(--border)",
              transition: "background 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(180,35,24,0.06)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              <LogOut size={14} strokeWidth={1.8} />
              Sair
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
