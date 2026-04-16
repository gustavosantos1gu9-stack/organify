"use client";

import { useState, useEffect } from "react";
import { Search, Plus, PowerOff, RefreshCw, Smartphone, Wifi, WifiOff, Building2, X, Eye } from "lucide-react";
import Link from "next/link";
import { supabase, getAgenciaId } from "@/lib/hooks";

interface ClienteConta {
  id: string;
  nome: string;
  whatsapp_instancia: string | null;
  whatsapp_numero: string | null;
  whatsapp_conectado: boolean;
  created_at: string;
  state?: string;
  profileName?: string;
}

export default function WhatsAppContasPage() {
  const [clientes, setClientes] = useState<ClienteConta[]>([]);
  const [loading, setLoading] = useState(true);
  const [agId, setAgId] = useState("");
  const [evolutionUrl, setEvolutionUrl] = useState("");
  const [evolutionKey, setEvolutionKey] = useState("");
  const [busca, setBusca] = useState("");
  const [showNova, setShowNova] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [criando, setCriando] = useState(false);

  const criarConta = async () => {
    if (!novoNome.trim()) { alert("Preencha o nome"); return; }
    setCriando(true);
    try {
      const { data: nova, error } = await supabase.from("agencias").insert({
        nome: novoNome.trim(),
        parent_id: agId,
      }).select().single();
      if (error) { alert("Erro: " + error.message); setCriando(false); return; }
      setNovoNome("");
      setShowNova(false);
      await carregar();
    } catch (e) { console.error(e); alert("Erro ao criar"); }
    setCriando(false);
  };

  const carregar = async () => {
    setLoading(true);
    const id = await getAgenciaId();
    if (!id) return;
    setAgId(id);

    const { data: ag } = await supabase.from("agencias")
      .select("evolution_url, evolution_key")
      .eq("id", id).single();
    if (ag?.evolution_url) setEvolutionUrl(ag.evolution_url);
    if (ag?.evolution_key) setEvolutionKey(ag.evolution_key);

    // Buscar agências filhas (clientes SaaS)
    const { data: filhas } = await supabase.from("agencias")
      .select("id, nome, whatsapp_instancia, whatsapp_numero, whatsapp_conectado, created_at")
      .eq("parent_id", id)
      .order("nome");

    // Enriquecer com status do Evolution
    const enriched = await Promise.all((filhas || []).map(async (c) => {
      if (!c.whatsapp_instancia || !ag?.evolution_url || !ag?.evolution_key) {
        return { ...c, state: "none", profileName: "" };
      }
      try {
        const res = await fetch(`/api/evolution/proxy?url=${encodeURIComponent(`${ag.evolution_url}/instance/fetchInstances?instanceName=${c.whatsapp_instancia}`)}&key=${encodeURIComponent(ag.evolution_key)}`);
        const data = await res.json();
        const evo = Array.isArray(data) ? data[0] : data;
        return {
          ...c,
          state: evo?.connectionStatus || "closed",
          profileName: evo?.profileName || "",
        };
      } catch {
        return { ...c, state: "unknown", profileName: "" };
      }
    }));

    setClientes(enriched);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const formatNumber = (n: string | null) => {
    if (!n || n.length < 10) return n || "—";
    const limpo = n.replace(/\D/g, "");
    if (limpo.length < 10) return n;
    const ddd = limpo.slice(limpo.length - 11, limpo.length - 8) || limpo.slice(0, 2);
    const num = limpo.slice(-8);
    return `(${ddd}) ${num.slice(0, -4)}-${num.slice(-4)}`;
  };

  const desativar = async (c: ClienteConta) => {
    if (!confirm(`Desativar a conta da "${c.nome}"?\n\nIsso vai:\n- Desconectar o WhatsApp\n- Remover a instância do Evolution\n- O inbox dessa cliente para de funcionar`)) return;
    try {
      if (c.whatsapp_instancia && evolutionUrl && evolutionKey) {
        await fetch(`/api/evolution/proxy?url=${encodeURIComponent(`${evolutionUrl}/instance/delete/${c.whatsapp_instancia}`)}&key=${encodeURIComponent(evolutionKey)}&method=DELETE`);
      }
      await supabase.from("whatsapp_instancias").delete().eq("instancia", c.whatsapp_instancia);
      await supabase.from("agencias").update({
        whatsapp_instancia: null, whatsapp_conectado: false, whatsapp_numero: null,
      }).eq("id", c.id);
      await carregar();
    } catch (e) { console.error(e); alert("Erro ao desativar"); }
  };

  const filtrados = clientes.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (c.whatsapp_numero || "").includes(busca)
  );

  const conectadas = filtrados.filter(c => c.state === "open").length;
  const total = filtrados.length;
  const semWhatsApp = filtrados.filter(c => !c.whatsapp_instancia).length;

  return (
    <div className="animate-in">
      <div className="breadcrumb">
        <a href="/">Início</a><span>›</span>
        <span className="current">Gerenciar Contas</span>
      </div>
      <h1 style={{ fontSize: "22px", fontWeight: "600", marginBottom: "24px" }}>Gerenciar Contas</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "16px", marginBottom: "28px" }}>
        <div className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(41,171,226,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Building2 size={18} color="#29ABE2" />
          </div>
          <div>
            <p style={{ fontSize: 11, color: "#606060", margin: 0 }}>Total de Clientes</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: "#f0f0f0", margin: 0 }}>{total}</p>
          </div>
        </div>
        <div className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(34,197,94,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Wifi size={18} color="#22c55e" />
          </div>
          <div>
            <p style={{ fontSize: 11, color: "#606060", margin: 0 }}>Conectadas</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: "#22c55e", margin: 0 }}>{conectadas}</p>
          </div>
        </div>
        <div className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <WifiOff size={18} color="#ef4444" />
          </div>
          <div>
            <p style={{ fontSize: 11, color: "#606060", margin: 0 }}>Desconectadas / Sem WhatsApp</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: "#ef4444", margin: 0 }}>{total - conectadas}</p>
          </div>
        </div>
      </div>

      <div className="table-wrapper">
        <div style={{ padding: "16px", display: "flex", gap: "12px", borderBottom: "1px solid #2e2e2e", alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1, minWidth: "200px" }}>
            <Search size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#606060" }} />
            <input className="search-input" placeholder="Buscar cliente ou WhatsApp..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          <button className="btn-ghost" onClick={carregar} style={{ padding: "8px" }}><RefreshCw size={14} /></button>
          <button className="btn-primary" onClick={() => setShowNova(true)}>
            <Plus size={14} /> Nova Conta
          </button>
        </div>

        <table>
          <thead>
            <tr>
              <th>CONTA</th>
              <th>STATUS</th>
              <th>WHATSAPP</th>
              <th>CONEXÃO</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign: "center", color: "#606060", padding: "40px" }}>Carregando...</td></tr>
            ) : !filtrados.length ? (
              <tr><td colSpan={5} style={{ textAlign: "center", color: "#606060", padding: "40px" }}>Nenhuma conta encontrada.</td></tr>
            ) : filtrados.map(c => (
              <tr key={c.id}>
                <td>
                  <div>
                    <p style={{ fontWeight: 500, margin: 0, color: "#f0f0f0" }}>{c.nome}</p>
                    {c.whatsapp_instancia && <p style={{ fontSize: 11, color: "#606060", margin: 0 }}>Instância: {c.whatsapp_instancia}</p>}
                  </div>
                </td>
                <td>
                  {!c.whatsapp_instancia ? (
                    <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, fontWeight: 500, background: "rgba(100,100,100,0.1)", color: "#606060" }}>Sem WhatsApp</span>
                  ) : (
                    <span style={{
                      fontSize: 12, padding: "3px 10px", borderRadius: 20, fontWeight: 500,
                      background: c.state === "open" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                      color: c.state === "open" ? "#22c55e" : "#ef4444",
                    }}>
                      {c.state === "open" ? "Ativa" : "Inativa"}
                    </span>
                  )}
                </td>
                <td style={{ color: "#a0a0a0", fontSize: 13 }}>{formatNumber(c.whatsapp_numero)}</td>
                <td>
                  {!c.whatsapp_instancia ? (
                    <span style={{ fontSize: 12, color: "#606060" }}>—</span>
                  ) : (
                    <span style={{ fontSize: 12, fontWeight: 500, color: c.state === "open" ? "#22c55e" : "#ef4444" }}>
                      {c.state === "open" ? "Conectada" : "Desconectada"}
                    </span>
                  )}
                </td>
                <td>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <Link href={`/clientes-saas`} onClick={() => {
                      sessionStorage.setItem("agencia_selecionada", c.id);
                    }} className="btn-ghost" style={{ padding: "5px 8px", textDecoration: "none", display: "flex", alignItems: "center" }} title="Ver painel">
                      <Eye size={13} />
                    </Link>
                    {c.whatsapp_instancia && (
                      <button onClick={() => desativar(c)} style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "5px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer",
                        background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444",
                      }}>
                        <PowerOff size={12} /> Desativar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNova && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowNova(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#141414", border: "1px solid #2e2e2e", borderRadius: 12, width: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #2e2e2e", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#f0f0f0" }}>Nova Conta</h3>
              <button onClick={() => setShowNova(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#606060" }}><X size={16} /></button>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: "#a0a0a0", display: "block", marginBottom: 4 }}>Nome da cliente / agência</label>
                <input placeholder="Ex: Studio Maria" value={novoNome} onChange={e => setNovoNome(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && criarConta()}
                  style={{ width: "100%", background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: 8, padding: "10px 12px", color: "#f0f0f0", fontSize: 13, boxSizing: "border-box" }} />
              </div>
              <p style={{ fontSize: 11, color: "#606060", margin: 0 }}>
                A conta será criada como agência filha. Depois configure o WhatsApp na página de Integrações dela.
              </p>
              <button onClick={criarConta} disabled={criando || !novoNome.trim()}
                style={{ background: !novoNome.trim() ? "#2e2e2e" : "#29ABE2", border: "none", borderRadius: 8, padding: 10, cursor: !novoNome.trim() ? "default" : "pointer", color: !novoNome.trim() ? "#606060" : "#000", fontWeight: 600, fontSize: 13 }}>
                {criando ? "Criando..." : "Criar Conta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
