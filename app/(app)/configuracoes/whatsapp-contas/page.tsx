"use client";

import { useState, useEffect } from "react";
import { Search, Plus, Trash2, Power, PowerOff, RefreshCw, Smartphone, Wifi, WifiOff } from "lucide-react";
import { supabase, getAgenciaId } from "@/lib/hooks";

interface Instancia {
  id: string;
  instancia: string;
  agencia_id: string;
  created_at: string;
  // Evolution data
  state?: string;
  ownerJid?: string;
  profileName?: string;
  number?: string;
}

export default function WhatsAppContasPage() {
  const [instancias, setInstancias] = useState<Instancia[]>([]);
  const [loading, setLoading] = useState(true);
  const [agId, setAgId] = useState("");
  const [evolutionUrl, setEvolutionUrl] = useState("");
  const [evolutionKey, setEvolutionKey] = useState("");
  const [busca, setBusca] = useState("");
  const [criando, setCriando] = useState(false);
  const [novoNome, setNovoNome] = useState("");

  const carregar = async () => {
    setLoading(true);
    const id = await getAgenciaId();
    if (!id) return;
    setAgId(id);

    // Buscar config da agência
    const { data: ag } = await supabase.from("agencias")
      .select("evolution_url, evolution_key")
      .eq("id", id).single();
    if (!ag?.evolution_url || !ag?.evolution_key) { setLoading(false); return; }
    setEvolutionUrl(ag.evolution_url);
    setEvolutionKey(ag.evolution_key);

    // Buscar instâncias do banco
    const { data: insts } = await supabase.from("whatsapp_instancias")
      .select("*").eq("agencia_id", id).order("created_at", { ascending: true });

    // Buscar estado de cada instância no Evolution
    const enriched = await Promise.all((insts || []).map(async (inst) => {
      try {
        const res = await fetch(`/api/evolution/proxy?url=${encodeURIComponent(`${ag.evolution_url}/instance/fetchInstances?instanceName=${inst.instancia}`)}&key=${encodeURIComponent(ag.evolution_key)}`);
        const data = await res.json();
        const evo = Array.isArray(data) ? data[0] : data;
        return {
          ...inst,
          state: evo?.connectionStatus || "unknown",
          ownerJid: evo?.ownerJid || "",
          profileName: evo?.profileName || "",
          number: evo?.ownerJid?.split("@")[0] || "",
        };
      } catch {
        return { ...inst, state: "unknown", ownerJid: "", profileName: "", number: "" };
      }
    }));

    setInstancias(enriched);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const formatNumber = (n: string) => {
    if (!n || n.length < 10) return n || "—";
    const ddd = n.slice(2, 4);
    const num = n.slice(4);
    return `(${ddd}) ${num.slice(0, -4)}-${num.slice(-4)}`;
  };

  const desativar = async (inst: Instancia) => {
    if (!confirm(`Desativar e excluir a instância "${inst.instancia}"? Isso remove do Evolution e do sistema.`)) return;
    try {
      // Delete from Evolution
      await fetch(`/api/evolution/proxy?url=${encodeURIComponent(`${evolutionUrl}/instance/delete/${inst.instancia}`)}&key=${encodeURIComponent(evolutionKey)}&method=DELETE`);
      // Delete from DB
      await supabase.from("whatsapp_instancias").delete().eq("id", inst.id);
      // If it was the main instance of any agencia, clear it
      await supabase.from("agencias").update({ whatsapp_instancia: null, whatsapp_conectado: false })
        .eq("whatsapp_instancia", inst.instancia).eq("id", agId);
      await carregar();
    } catch (e) { console.error(e); alert("Erro ao desativar"); }
  };

  const criarInstancia = async () => {
    const nome = novoNome.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!nome) { alert("Nome inválido"); return; }
    setCriando(true);
    try {
      // Create in Evolution
      const res = await fetch(`/api/evolution/proxy?url=${encodeURIComponent(`${evolutionUrl}/instance/create`)}&key=${encodeURIComponent(evolutionKey)}&method=POST`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceName: nome,
          integration: "WHATSAPP-BAILEYS",
          qrcode: true,
          webhook: {
            url: `https://salxconvert-blond.vercel.app/api/webhook/whatsapp?secret=60efd4060d088e27af797cb1b2e8cdc198d34ee3a7260ebbe1d2160e9ab2453c`,
            enabled: true,
            events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
            webhookByEvents: false,
            webhookBase64: false,
          },
        }),
      });
      const data = await res.json();
      if (data.error) { alert("Erro: " + JSON.stringify(data.error)); setCriando(false); return; }

      // Save to DB
      await supabase.from("whatsapp_instancias").insert({
        agencia_id: agId,
        instancia: nome,
      });

      setNovoNome("");
      await carregar();
    } catch (e) { console.error(e); alert("Erro ao criar instância"); }
    setCriando(false);
  };

  const filtradas = instancias.filter(i =>
    i.instancia.toLowerCase().includes(busca.toLowerCase()) ||
    (i.profileName || "").toLowerCase().includes(busca.toLowerCase()) ||
    (i.number || "").includes(busca)
  );

  const conectadas = filtradas.filter(i => i.state === "open").length;
  const total = filtradas.length;

  return (
    <div className="animate-in">
      <div className="breadcrumb">
        <a href="/">Início</a><span>›</span>
        <span style={{ color: "#a0a0a0" }}>Configurações</span><span>›</span>
        <span className="current">WhatsApp Contas</span>
      </div>
      <h1 style={{ fontSize: "22px", fontWeight: "600", marginBottom: "24px" }}>Gerenciar Contas WhatsApp</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "16px", marginBottom: "28px" }}>
        <div className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(41,171,226,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Smartphone size={18} color="#29ABE2" />
          </div>
          <div>
            <p style={{ fontSize: 11, color: "#606060", margin: 0 }}>Total de Contas</p>
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
            <p style={{ fontSize: 11, color: "#606060", margin: 0 }}>Desconectadas</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: "#ef4444", margin: 0 }}>{total - conectadas}</p>
          </div>
        </div>
      </div>

      <div className="table-wrapper">
        <div style={{ padding: "16px", display: "flex", gap: "12px", borderBottom: "1px solid #2e2e2e", alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1, minWidth: "200px" }}>
            <Search size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#606060" }} />
            <input className="search-input" placeholder="Buscar por nome ou WhatsApp..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          <button className="btn-ghost" onClick={carregar} style={{ padding: "8px" }}><RefreshCw size={14} /></button>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input placeholder="Nome da instância" value={novoNome} onChange={e => setNovoNome(e.target.value)}
              style={{ background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: 8, padding: "8px 12px", color: "#f0f0f0", fontSize: 13, width: 180 }}
              onKeyDown={e => e.key === "Enter" && criarInstancia()} />
            <button className="btn-primary" onClick={criarInstancia} disabled={criando || !novoNome.trim()}>
              <Plus size={14} /> {criando ? "Criando..." : "Adicionar nova conta"}
            </button>
          </div>
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
            ) : !filtradas.length ? (
              <tr><td colSpan={5} style={{ textAlign: "center", color: "#606060", padding: "40px" }}>Nenhuma conta encontrada.</td></tr>
            ) : filtradas.map(inst => (
              <tr key={inst.id}>
                <td>
                  <div>
                    <p style={{ fontWeight: 500, margin: 0, color: "#f0f0f0" }}>{inst.profileName || inst.instancia}</p>
                    <p style={{ fontSize: 11, color: "#606060", margin: 0 }}>Instância: {inst.instancia}</p>
                  </div>
                </td>
                <td>
                  <span style={{
                    fontSize: 12, padding: "3px 10px", borderRadius: 20, fontWeight: 500,
                    background: inst.state === "open" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                    color: inst.state === "open" ? "#22c55e" : "#ef4444",
                  }}>
                    {inst.state === "open" ? "Ativa" : "Inativa"}
                  </span>
                </td>
                <td style={{ color: "#a0a0a0", fontSize: 13 }}>{formatNumber(inst.number || "")}</td>
                <td>
                  <span style={{
                    fontSize: 12, fontWeight: 500,
                    color: inst.state === "open" ? "#22c55e" : "#ef4444",
                  }}>
                    {inst.state === "open" ? "Conectada" : "Desconectada"}
                  </span>
                </td>
                <td>
                  <button onClick={() => desativar(inst)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "5px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer",
                      background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444",
                    }}>
                    <PowerOff size={12} /> Desativar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
