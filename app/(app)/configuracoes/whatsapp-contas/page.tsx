"use client";

import { useState, useEffect } from "react";
import { Search, Plus, PowerOff, RefreshCw, Smartphone, Wifi, WifiOff, Building2, X, Eye, Trash2, AlertTriangle, Heart } from "lucide-react";
import Link from "next/link";
import { supabase, getAgenciaId } from "@/lib/hooks";

interface ClienteConta {
  id: string;
  nome: string;
  whatsapp_instancia: string | null;
  whatsapp_numero: string | null;
  whatsapp_conectado: boolean;
  reconexao_token: string | null;
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
  const [linkCopiado, setLinkCopiado] = useState<string | null>(null); // id da agência com link copiado
  const [alertasAbertos, setAlertasAbertos] = useState(0);

  const criarConta = async () => {
    if (!novoNome.trim()) { alert("Preencha o nome"); return; }
    setCriando(true);
    try {
      const { data: nova, error } = await supabase.from("agencias").insert({
        nome: novoNome.trim(),
        parent_id: agId,
      }).select().single();
      if (error) { alert("Erro: " + error.message); setCriando(false); return; }

      // Criar etapa padrão "Fez Contato" na jornada da nova agência filha
      await supabase.from("jornada_etapas").insert({
        agencia_id: nova.id,
        nome: "Fez Contato",
        evento_conversao: "Contact",
        eh_primeiro_contato: true,
        eh_venda: false,
        ordem: 1,
      });

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
      .select("id, nome, whatsapp_instancia, whatsapp_numero, whatsapp_conectado, reconexao_token, created_at")
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

  useEffect(() => {
    carregar();
    fetch("/api/heartbeat/status").then(r => r.json()).then(d => setAlertasAbertos(d.alertas_abertos || 0)).catch(() => {});
  }, []);

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

  const excluir = async (c: ClienteConta) => {
    const confirmado = prompt(`Para excluir "${c.nome}", digite o nome da conta:`);
    if (confirmado?.trim() !== c.nome.trim()) { alert("Nome não confere. Exclusão cancelada."); return; }
    try {
      if (c.whatsapp_instancia && evolutionUrl && evolutionKey) {
        await fetch(`/api/evolution/proxy?url=${encodeURIComponent(`${evolutionUrl}/instance/delete/${c.whatsapp_instancia}`)}&key=${encodeURIComponent(evolutionKey)}&method=DELETE`);
      }
      const { error } = await supabase.from("agencias").delete().eq("id", c.id);
      if (error) { alert("Erro ao excluir: " + error.message); return; }
      await carregar();
    } catch (e) { console.error(e); alert("Erro ao excluir"); }
  };

  const fixarWebhook = async (c: ClienteConta) => {
    if (!confirm(`Reconfigurar webhook da "${c.nome}"?\n\nIsso resolve quando mensagens param de chegar mesmo com WhatsApp conectado.`)) return;
    try {
      const res = await fetch("/api/evolution/fix-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agencia_id: c.id, instancia: c.whatsapp_instancia }),
      });
      const data = await res.json();
      if (data.ok) alert(`Webhook reconfigurado com sucesso para "${c.nome}"!`);
      else alert("Erro: " + (data.error || "falha"));
    } catch (e) { alert("Erro ao reconfigurar webhook"); }
  };

  const fixarTodosWebhooks = async () => {
    const comInstancia = clientes.filter(c => c.whatsapp_instancia);
    if (!comInstancia.length) { alert("Nenhuma conta com instância configurada."); return; }
    if (!confirm(`Reconfigurar webhook de ${comInstancia.length} conta(s)?\n\nIsso garante que todas recebam mensagens corretamente.`)) return;
    const erros: string[] = [];
    for (const c of comInstancia) {
      try {
        const res = await fetch("/api/evolution/fix-webhook", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agencia_id: c.id, instancia: c.whatsapp_instancia }),
        });
        const data = await res.json();
        if (!data.ok) erros.push(`${c.nome}: ${data.error || "falha"}`);
      } catch { erros.push(`${c.nome}: erro de conexão`); }
    }
    if (erros.length) alert(`Concluído com erros:\n${erros.join("\n")}`);
    else alert(`Webhook reconfigurado em ${comInstancia.length} conta(s) com sucesso!`);
  };

  const copiarLink = (c: ClienteConta) => {
    if (!c.reconexao_token) return;
    const link = `${window.location.origin}/reconectar/${c.reconexao_token}`;
    navigator.clipboard.writeText(link).then(() => {
      setLinkCopiado(c.id);
      setTimeout(() => setLinkCopiado(null), 2500);
    }).catch(() => alert(link));
  };

  const gerarToken = async (c: ClienteConta) => {
    if (!confirm(`Gerar novo link de reconexão para "${c.nome}"?\n\nO link anterior será invalidado.`)) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { alert("Sessão expirada. Recarregue a página."); return; }
      const res = await fetch("/api/reconexao/gerar-token", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ agencia_id: c.id }),
      });
      const data = await res.json();
      if (data.link) {
        await carregar();
        navigator.clipboard.writeText(data.link).then(() => {
          alert(`Link gerado e copiado!\n\n${data.link}`);
        }).catch(() => alert(`Link gerado:\n\n${data.link}`));
      } else {
        alert("Erro ao gerar link: " + (data.error || "falha"));
      }
    } catch (e) { console.error(e); alert("Erro ao gerar token"); }
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "16px", marginBottom: "28px" }}>
        <div className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(41,171,226,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Building2 size={18} color="#1C6CA6" />
          </div>
          <div>
            <p style={{ fontSize: 11, color: "#4A5B6C", margin: 0 }}>Total de Clientes</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: "#0A1826", margin: 0 }}>{total}</p>
          </div>
        </div>
        <div className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(30,107,82,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Wifi size={18} color="#1E6B52" />
          </div>
          <div>
            <p style={{ fontSize: 11, color: "#4A5B6C", margin: 0 }}>Conectadas</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: "#1E6B52", margin: 0 }}>{conectadas}</p>
          </div>
        </div>
        <div className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(180,35,24,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <WifiOff size={18} color="#B42318" />
          </div>
          <div>
            <p style={{ fontSize: 11, color: "#4A5B6C", margin: 0 }}>Desconectadas / Sem WhatsApp</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: "#B42318", margin: 0 }}>{total - conectadas}</p>
          </div>
        </div>
        <Link href="/configuracoes/whatsapp-status" style={{ textDecoration: "none" }}>
          <div className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", border: alertasAbertos > 0 ? "1px solid rgba(180,35,24,0.5)" : "1px solid #E6EBF0", transition: "border-color 0.2s" }}>
            <div style={{ position: "relative", width: 36, height: 36, borderRadius: 8, background: alertasAbertos > 0 ? "rgba(180,35,24,0.15)" : "rgba(100,100,100,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Heart size={18} color={alertasAbertos > 0 ? "#B42318" : "#4A5B6C"} />
              {alertasAbertos > 0 && (
                <span style={{ position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: "50%", background: "#B42318", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {alertasAbertos}
                </span>
              )}
            </div>
            <div>
              <p style={{ fontSize: 11, color: "#4A5B6C", margin: 0 }}>Monitor de Saúde</p>
              <p style={{ fontSize: alertasAbertos > 0 ? 13 : 22, fontWeight: 700, color: alertasAbertos > 0 ? "#B42318" : "#0A1826", margin: 0 }}>
                {alertasAbertos > 0 ? `${alertasAbertos} alerta${alertasAbertos > 1 ? "s" : ""}` : "OK"}
              </p>
            </div>
          </div>
        </Link>
      </div>

      <div className="table-wrapper">
        <div style={{ padding: "16px", display: "flex", gap: "12px", borderBottom: "1px solid #E6EBF0", alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1, minWidth: "200px" }}>
            <Search size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#4A5B6C" }} />
            <input className="search-input" placeholder="Buscar cliente ou WhatsApp..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          <button className="btn-ghost" onClick={carregar} style={{ padding: "8px" }}><RefreshCw size={14} /></button>
          <button className="btn-ghost" onClick={fixarTodosWebhooks} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }} title="Reconfigurar webhook de todas as contas">
            <Wifi size={14} /> Reconf. Webhooks
          </button>
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
              <tr><td colSpan={5} style={{ textAlign: "center", color: "#4A5B6C", padding: "40px" }}>Carregando...</td></tr>
            ) : !filtrados.length ? (
              <tr><td colSpan={5} style={{ textAlign: "center", color: "#4A5B6C", padding: "40px" }}>Nenhuma conta encontrada.</td></tr>
            ) : filtrados.map(c => (
              <tr key={c.id}>
                <td>
                  <div>
                    <p style={{ fontWeight: 500, margin: 0, color: "#0A1826" }}>{c.nome}</p>
                    {c.whatsapp_instancia && <p style={{ fontSize: 11, color: "#4A5B6C", margin: 0 }}>Instância: {c.whatsapp_instancia}</p>}
                  </div>
                </td>
                <td>
                  {!c.whatsapp_instancia ? (
                    <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, fontWeight: 500, background: "rgba(100,100,100,0.1)", color: "#4A5B6C" }}>Sem WhatsApp</span>
                  ) : (
                    <span style={{
                      fontSize: 12, padding: "3px 10px", borderRadius: 20, fontWeight: 500,
                      background: c.state === "open" ? "rgba(30,107,82,0.1)" : "rgba(180,35,24,0.1)",
                      color: c.state === "open" ? "#1E6B52" : "#B42318",
                    }}>
                      {c.state === "open" ? "Ativa" : "Inativa"}
                    </span>
                  )}
                </td>
                <td style={{ color: "#4A5B6C", fontSize: 13 }}>{formatNumber(c.whatsapp_numero)}</td>
                <td>
                  {!c.whatsapp_instancia ? (
                    <span style={{ fontSize: 12, color: "#4A5B6C" }}>—</span>
                  ) : (
                    <span style={{ fontSize: 12, fontWeight: 500, color: c.state === "open" ? "#1E6B52" : "#B42318" }}>
                      {c.state === "open" ? "Conectada" : "Desconectada"}
                    </span>
                  )}
                </td>
                <td>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <button onClick={() => {
                      sessionStorage.setItem("agencia_selecionada", c.id);
                      window.location.href = "/clientes-saas";
                    }} className="btn-ghost" style={{ padding: "5px 8px", display: "flex", alignItems: "center", cursor: "pointer" }} title="Ver painel">
                      <Eye size={13} />
                    </button>
                    {c.whatsapp_instancia && (
                      <>
                        <button onClick={() => fixarWebhook(c)} title="Reconfigurar webhook (usar quando mensagens pararem de chegar)" style={{
                          display: "flex", alignItems: "center", gap: 6,
                          padding: "5px 8px", borderRadius: 6, fontSize: 12, cursor: "pointer",
                          background: "rgba(41,171,226,0.08)", border: "1px solid rgba(41,171,226,0.2)", color: "#1C6CA6",
                        }}>
                          <Wifi size={12} />
                        </button>
                        <button onClick={() => desativar(c)} style={{
                          display: "flex", alignItems: "center", gap: 6,
                          padding: "5px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer",
                          background: "rgba(180,35,24,0.08)", border: "1px solid rgba(180,35,24,0.2)", color: "#B42318",
                        }}>
                          <PowerOff size={12} /> Desativar
                        </button>
                      </>
                    )}
                    {/* Link de reconexão */}
                    {c.reconexao_token ? (
                      <button
                        onClick={() => copiarLink(c)}
                        title="Copiar link de reconexão para enviar à cliente"
                        style={{
                          display: "flex", alignItems: "center", gap: 4,
                          padding: "5px 8px", borderRadius: 6, fontSize: 11, cursor: "pointer",
                          background: linkCopiado === c.id ? "rgba(37,211,102,0.08)" : "rgba(100,100,100,0.08)",
                          border: `1px solid ${linkCopiado === c.id ? "rgba(37,211,102,0.3)" : "rgba(100,100,100,0.2)"}`,
                          color: linkCopiado === c.id ? "#1E6B52" : "#4A5B6C",
                        }}
                      >
                        {linkCopiado === c.id ? "✓" : "🔗"}
                      </button>
                    ) : (
                      <button
                        onClick={() => gerarToken(c)}
                        title="Gerar link de reconexão"
                        style={{
                          display: "flex", alignItems: "center", gap: 4,
                          padding: "5px 8px", borderRadius: 6, fontSize: 11, cursor: "pointer",
                          background: "rgba(100,100,100,0.08)", border: "1px solid rgba(100,100,100,0.2)", color: "#4A5B6C",
                        }}
                      >
                        🔗
                      </button>
                    )}
                    <button onClick={() => excluir(c)} style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "5px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer",
                      background: "rgba(180,35,24,0.15)", border: "1px solid rgba(180,35,24,0.4)", color: "#B42318",
                    }} title="Excluir conta permanentemente">
                      <Trash2 size={12} /> Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNova && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowNova(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#FFFFFF", border: "1px solid #E6EBF0", borderRadius: 12, width: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #E6EBF0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#0A1826" }}>Nova Conta</h3>
              <button onClick={() => setShowNova(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#4A5B6C" }}><X size={16} /></button>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: "#4A5B6C", display: "block", marginBottom: 4 }}>Nome da cliente / agência</label>
                <input placeholder="Ex: Studio Maria" value={novoNome} onChange={e => setNovoNome(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && criarConta()}
                  style={{ width: "100%", background: "#FFFFFF", border: "1px solid #E6EBF0", borderRadius: 8, padding: "10px 12px", color: "#0A1826", fontSize: 13, boxSizing: "border-box" }} />
              </div>
              <p style={{ fontSize: 11, color: "#4A5B6C", margin: 0 }}>
                A conta será criada como agência filha. Depois configure o WhatsApp na página de Integrações dela.
              </p>
              <button onClick={criarConta} disabled={criando || !novoNome.trim()}
                style={{ background: !novoNome.trim() ? "#E6EBF0" : "#1C6CA6", border: "none", borderRadius: 8, padding: 10, cursor: !novoNome.trim() ? "default" : "pointer", color: !novoNome.trim() ? "#4A5B6C" : "#000", fontWeight: 600, fontSize: 13 }}>
                {criando ? "Criando..." : "Criar Conta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
