"use client";

import { useState, useEffect } from "react";
import { Save, Bell, MessageCircle } from "lucide-react";
import { supabase, getAgenciaId } from "@/lib/hooks";

export default function FerramentasConfigPage() {
  const [agenciaId, setAgenciaId] = useState("");
  const [grupoJid, setGrupoJid] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const id = await getAgenciaId();
      if (!id) return;
      setAgenciaId(id);
      const { data } = await supabase
        .from("agencias")
        .select("grupo_notificacao_jid")
        .eq("id", id)
        .single();
      setGrupoJid(data?.grupo_notificacao_jid || "");
      setLoading(false);
    }
    load();
  }, []);

  const salvar = async () => {
    setSalvando(true);
    await supabase
      .from("agencias")
      .update({ grupo_notificacao_jid: grupoJid.trim() || null })
      .eq("id", agenciaId);
    setSalvando(false);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2500);
  };

  const inp: React.CSSProperties = {
    background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: 8,
    padding: "10px 14px", color: "#f0f0f0", fontSize: 14, width: "100%",
    boxSizing: "border-box", outline: "none",
  };

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f0f0f0", margin: 0 }}>Configurações de Ferramentas</h1>
        <p style={{ fontSize: 13, color: "#606060", margin: "4px 0 0" }}>Notificações e integrações para formulários e landing pages</p>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid #1a1a1a", borderTop: "3px solid #29ABE2", animation: "spin 1s linear infinite" }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : (
        <div style={{ background: "#141414", border: "1px solid #2e2e2e", borderRadius: 12, padding: 24 }}>
          {/* Header da seção */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "#29ABE215", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Bell size={18} style={{ color: "#29ABE2" }} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f0", margin: 0 }}>Notificação de Leads</p>
              <p style={{ fontSize: 12, color: "#606060", margin: 0 }}>Grupo WhatsApp que recebe os dados de cada novo lead</p>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#808080", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              JID do Grupo WhatsApp
            </label>
            <input
              style={inp}
              placeholder="120363xxxxxxx@g.us"
              value={grupoJid}
              onChange={e => setGrupoJid(e.target.value)}
              onFocus={e => e.currentTarget.style.borderColor = "#29ABE2"}
              onBlur={e => e.currentTarget.style.borderColor = "#2e2e2e"}
            />

            {/* Como pegar o JID */}
            <div style={{ background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 8, padding: 14, marginTop: 4 }}>
              <p style={{ fontSize: 12, color: "#808080", fontWeight: 600, margin: "0 0 8px" }}>Como encontrar o JID do grupo:</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <p style={{ fontSize: 12, color: "#606060", margin: 0 }}>
                  <span style={{ color: "#29ABE2", fontWeight: 600 }}>Opção 1:</span> No Evolution API → Chats → encontra o grupo → copia o ID (termina em <code style={{ background: "#1a1a1a", padding: "1px 5px", borderRadius: 4 }}>@g.us</code>)
                </p>
                <p style={{ fontSize: 12, color: "#606060", margin: 0 }}>
                  <span style={{ color: "#29ABE2", fontWeight: 600 }}>Opção 2:</span> No WhatsApp, abra o grupo → Dados do grupo → Link de convite → o número longo antes de <code style={{ background: "#1a1a1a", padding: "1px 5px", borderRadius: 4 }}>@g.us</code> é o JID
                </p>
              </div>
            </div>

            <p style={{ fontSize: 12, color: "#404040", margin: "4px 0 0" }}>
              Usado para: leads do Meta Lead Ads, formulários SALX e landing pages sem cliente externo configurado.
            </p>
          </div>

          <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={salvar}
              disabled={salvando}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 20px", borderRadius: 8, border: "none",
                background: salvo ? "#22c55e" : "#29ABE2",
                color: "#000", fontSize: 14, fontWeight: 700,
                cursor: "pointer", transition: "background 0.2s",
                opacity: salvando ? 0.7 : 1,
              }}
            >
              <Save size={15} />
              {salvando ? "Salvando..." : salvo ? "Salvo!" : "Salvar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
