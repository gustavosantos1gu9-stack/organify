"use client";

import { useState, useEffect } from "react";
import {
  Check, Eye, EyeOff, RefreshCw, Wifi, WifiOff, Plus, Trash2,
  Target, MessageCircle, X,
} from "lucide-react";
import { supabase, getAgenciaId } from "@/lib/hooks";

interface Instancia {
  id: string;
  name: string;
  connectionStatus: string;
  profileName?: string;
  profilePicUrl?: string;
  instance?: { instanceName: string; status?: string; state?: string };
  state?: string;
}

export default function ConexoesPage() {
  // Facebook
  const [metaToken, setMetaToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [metaNome, setMetaNome] = useState("");
  const [metaUserId, setMetaUserId] = useState("");
  const [validandoMeta, setValidandoMeta] = useState(false);
  const [metaConectado, setMetaConectado] = useState(false);
  const [contas, setContas] = useState<any[]>([]);
  const [loadingContas, setLoadingContas] = useState(false);

  // WhatsApp / Evolution
  const [evoUrl, setEvoUrl] = useState("");
  const [evoKey, setEvoKey] = useState("");
  const [instancia, setInstancia] = useState("");
  const [instancias, setInstancias] = useState<Instancia[]>([]);
  const [loadingInst, setLoadingInst] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrInstancia, setQrInstancia] = useState<string | null>(null);
  const [novaInstancia, setNovaInstancia] = useState("");
  const [criandoInst, setCriandoInst] = useState(false);
  const [waConectado, setWaConectado] = useState(false);

  const [salvando, setSalvando] = useState(false);
  const [conexaoId, setConexaoId] = useState<string | null>(null);

  useEffect(() => {
    carregarConexao();
  }, []);

  async function carregarConexao() {
    const agId = await getAgenciaId();
    const { data } = await supabase
      .from("relatorios_conexoes")
      .select("*")
      .eq("agencia_id", agId!)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (data) {
      setConexaoId(data.id);
      setMetaToken(data.meta_token || "");
      setMetaNome(data.meta_nome || "");
      setMetaUserId(data.meta_user_id || "");
      setMetaConectado(!!data.meta_token);
      setEvoUrl(data.evolution_url || "");
      setEvoKey(data.evolution_key || "");
      setInstancia(data.whatsapp_instancia || "");
      setWaConectado(data.whatsapp_conectado || false);
      if (data.evolution_url && data.evolution_key) {
        carregarInstancias(data.evolution_url, data.evolution_key);
      }
      if (data.meta_token) {
        carregarContasAnuncio(data.meta_token);
      }
    }
  }

  // ─── Facebook ───────────────────────────────────────────────

  async function validarToken() {
    if (!metaToken.trim()) { alert("Cole o token do Facebook"); return; }
    setValidandoMeta(true);
    try {
      const res = await fetch("/api/meta-ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "validar_token", token: metaToken }),
      });
      const data = await res.json();
      if (data.valid) {
        setMetaNome(data.name || "");
        setMetaUserId(data.id || "");
        setMetaConectado(true);
        await salvarConexao({ meta_token: metaToken, meta_nome: data.name, meta_user_id: data.id });
        carregarContasAnuncio(metaToken);
      } else {
        alert(data.error || "Token inválido");
      }
    } catch { alert("Erro ao validar token"); }
    setValidandoMeta(false);
  }

  async function carregarContasAnuncio(token: string) {
    setLoadingContas(true);
    try {
      const res = await fetch("/api/meta-ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "listar_contas", token }),
      });
      const data = await res.json();
      if (Array.isArray(data)) setContas(data);
    } catch {}
    setLoadingContas(false);
  }

  async function desconectarMeta() {
    if (!confirm("Desconectar Facebook?")) return;
    setMetaToken("");
    setMetaNome("");
    setMetaUserId("");
    setMetaConectado(false);
    setContas([]);
    await salvarConexao({ meta_token: null, meta_nome: null, meta_user_id: null });
  }

  // ─── WhatsApp / Evolution ───────────────────────────────────

  async function evoCall(action: string, instanceName?: string, payload?: Record<string, unknown>, url?: string, key?: string) {
    const res = await fetch("/api/evolution", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, instanceName, payload, customUrl: url || evoUrl, customKey: key || evoKey }),
    });
    return res.json();
  }

  async function carregarInstancias(url?: string, key?: string) {
    setLoadingInst(true);
    try {
      // Chamar direto a Evolution API
      const targetUrl = url || evoUrl;
      const targetKey = key || evoKey;
      if (!targetUrl || !targetKey) { setLoadingInst(false); return; }

      const res = await fetch(`${targetUrl}/instance/fetchInstances`, {
        headers: { apikey: targetKey },
      });
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setInstancias(list);

      // Verificar se a instância salva está conectada
      if (instancia) {
        const inst = list.find((i: any) => (i.name || i.instance?.instanceName) === instancia);
        if (inst) {
          const status = (inst.connectionStatus || inst.instance?.state || inst.state || "").toLowerCase();
          setWaConectado(status === "open" || status === "connected");
        }
      }
    } catch (e) {
      console.error("Erro ao carregar instâncias:", e);
    }
    setLoadingInst(false);
  }

  async function salvarWhatsApp() {
    if (!evoUrl.trim() || !evoKey.trim()) { alert("Preencha URL e API Key"); return; }
    setSalvando(true);
    await salvarConexao({ evolution_url: evoUrl, evolution_key: evoKey, whatsapp_instancia: instancia });
    await carregarInstancias();
    setSalvando(false);
    alert("WhatsApp configurado!");
  }

  async function criarInstancia() {
    if (!novaInstancia.trim() || !evoUrl || !evoKey) { alert("Preencha o nome e configure a API"); return; }
    setCriandoInst(true);
    try {
      const res = await fetch(`${evoUrl}/instance/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evoKey },
        body: JSON.stringify({
          instanceName: novaInstancia,
          token: novaInstancia,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
        }),
      });
      const data = await res.json();
      if (data.qrcode?.base64) {
        setQrCode(data.qrcode.base64);
        setQrInstancia(novaInstancia);
      }
      setNovaInstancia("");
      await carregarInstancias();
    } catch { alert("Erro ao criar instância"); }
    setCriandoInst(false);
  }

  async function gerarQR(nome: string) {
    try {
      setQrInstancia(nome);
      setQrCode(null);
      const res = await fetch(`${evoUrl}/instance/connect/${nome}`, {
        headers: { apikey: evoKey },
      });
      const data = await res.json();
      if (data.base64) setQrCode(data.base64);
      else if (data.qrcode?.base64) setQrCode(data.qrcode.base64);
      else if (data.code) setQrCode(`qr:${data.code}`);
    } catch { alert("Erro ao gerar QR Code"); }
  }

  async function selecionarInstancia(nome: string) {
    setInstancia(nome);
    await salvarConexao({ whatsapp_instancia: nome, whatsapp_conectado: true });
  }

  async function deletarInstancia(nome: string) {
    if (!confirm(`Deletar instância ${nome}?`)) return;
    try {
      await fetch(`${evoUrl}/instance/delete/${nome}`, {
        method: "DELETE",
        headers: { apikey: evoKey },
      });
      if (instancia === nome) {
        setInstancia("");
        setWaConectado(false);
        await salvarConexao({ whatsapp_instancia: null, whatsapp_conectado: false });
      }
      await carregarInstancias();
    } catch { alert("Erro ao deletar"); }
  }

  // ─── Salvar conexão ─────────────────────────────────────────

  async function salvarConexao(fields: Record<string, any>) {
    const agId = await getAgenciaId();
    if (conexaoId) {
      await supabase.from("relatorios_conexoes").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", conexaoId);
    } else {
      const { data } = await supabase.from("relatorios_conexoes").insert({ agencia_id: agId, ...fields }).select("id").single();
      if (data) setConexaoId(data.id);
    }
  }

  const getStatus = (inst: Instancia) =>
    (inst.connectionStatus || inst.instance?.state || inst.instance?.status || inst.state || "disconnected").toLowerCase();
  const isConectado = (inst: Instancia) => {
    const s = getStatus(inst);
    return s === "open" || s === "connected";
  };
  const getNome = (inst: Instancia) => inst.name || inst.instance?.instanceName || "";

  return (
    <div className="animate-in">
      <div className="breadcrumb">
        <a href="/">Início</a><span>›</span>
        <span style={{ color: "#a0a0a0" }}>Relatórios Meta</span><span>›</span>
        <span className="current">Conexões</span>
      </div>
      <h1 style={{ fontSize: "22px", fontWeight: "600", marginBottom: "28px" }}>Conexões</h1>

      {/* ─── Facebook ──────────────────────────── */}
      <div className="card" style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: metaConectado ? "#22c55e" : "#ef4444" }} />
            <Target size={18} color="#1877f2" />
            <h2 style={{ fontSize: "16px", fontWeight: "600" }}>Facebook / Meta Ads</h2>
          </div>
          {metaConectado && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "12px", color: "#22c55e" }}>Conectado como {metaNome}</span>
              <button onClick={desconectarMeta} style={{
                background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: "6px", padding: "4px 10px", cursor: "pointer", color: "#ef4444", fontSize: "11px",
              }}>Desconectar</button>
            </div>
          )}
        </div>

        {!metaConectado ? (
          <>
            <p style={{ fontSize: "13px", color: "#606060", marginBottom: "16px" }}>
              Cole o token do Gerenciador de Negócios (System User com permissão ads_read) para conectar todas as contas de anúncio.
            </p>
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              <div style={{ position: "relative", flex: 1 }}>
                <input className="form-input" placeholder="EAAxxxxxxx..." type={showToken ? "text" : "password"}
                  value={metaToken} onChange={e => setMetaToken(e.target.value)} style={{ paddingRight: "40px" }} />
                <button onClick={() => setShowToken(!showToken)} style={{
                  position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", color: "#606060",
                }}>
                  {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button className="btn-primary" onClick={validarToken} disabled={validandoMeta} style={{ cursor: "pointer", whiteSpace: "nowrap" }}>
                <Check size={14} /> {validandoMeta ? "Validando..." : "Conectar"}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Contas de anúncio vinculadas */}
            <div style={{ borderTop: "1px solid #2e2e2e", paddingTop: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <p style={{ fontSize: "13px", fontWeight: "600", color: "#f0f0f0" }}>
                  Contas de anúncio vinculadas ({contas.length})
                </p>
                <button className="btn-ghost" onClick={() => carregarContasAnuncio(metaToken)} style={{ cursor: "pointer", padding: "4px" }}>
                  <RefreshCw size={13} />
                </button>
              </div>
              {loadingContas ? (
                <p style={{ fontSize: "12px", color: "#606060" }}>Carregando contas...</p>
              ) : contas.length === 0 ? (
                <p style={{ fontSize: "12px", color: "#606060" }}>Nenhuma conta encontrada.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "250px", overflowY: "auto" }}>
                  {contas.map((c: any) => (
                    <div key={c.id} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "10px 14px", background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: "8px",
                    }}>
                      <div>
                        <p style={{ fontSize: "13px", fontWeight: "500", color: "#f0f0f0" }}>{c.name}</p>
                        <p style={{ fontSize: "11px", color: "#606060" }}>{c.id}</p>
                      </div>
                      <span style={{
                        fontSize: "11px", padding: "3px 8px", borderRadius: "12px",
                        background: c.account_status === 1 ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                        color: c.account_status === 1 ? "#22c55e" : "#ef4444",
                      }}>
                        {c.account_status === 1 ? "Ativa" : "Inativa"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ─── WhatsApp ──────────────────────────── */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: waConectado ? "#22c55e" : "#ef4444" }} />
            <MessageCircle size={18} color="#25d366" />
            <h2 style={{ fontSize: "16px", fontWeight: "600" }}>WhatsApp (Envio de Relatórios)</h2>
          </div>
          {instancia && waConectado && (
            <span style={{ fontSize: "12px", color: "#22c55e" }}>Instância: {instancia}</span>
          )}
        </div>

        <p style={{ fontSize: "13px", color: "#606060", marginBottom: "16px" }}>
          Conecte um WhatsApp separado para envio dos relatórios aos grupos dos clientes.
        </p>

        {/* Config da Evolution API */}
        <div style={{ background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: "10px", padding: "16px", marginBottom: "16px" }}>
          <p style={{ fontSize: "13px", fontWeight: "600", marginBottom: "12px", color: "#f0f0f0" }}>Configuração da Evolution API</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
            <div className="form-group">
              <label className="form-label">URL da API</label>
              <input className="form-input" value={evoUrl} onChange={e => setEvoUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div className="form-group">
              <label className="form-label">API Key</label>
              <input className="form-input" value={evoKey} onChange={e => setEvoKey(e.target.value)} type="password" />
            </div>
          </div>
          <button className="btn-primary" onClick={salvarWhatsApp} disabled={salvando} style={{ cursor: "pointer" }}>
            <Check size={14} /> {salvando ? "Salvando..." : "Salvar e Conectar"}
          </button>
        </div>

        {/* Instâncias */}
        {evoUrl && evoKey && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <p style={{ fontSize: "13px", fontWeight: "600", color: "#f0f0f0" }}>Instâncias WhatsApp</p>
              <button className="btn-ghost" onClick={() => carregarInstancias()} style={{ cursor: "pointer", padding: "6px" }}>
                <RefreshCw size={14} />
              </button>
            </div>

            {loadingInst ? (
              <p style={{ fontSize: "13px", color: "#606060" }}>Carregando...</p>
            ) : instancias.length === 0 ? (
              <p style={{ fontSize: "13px", color: "#606060" }}>Nenhuma instância encontrada.</p>
            ) : instancias.map(inst => {
              const nome = getNome(inst);
              const conectado = isConectado(inst);
              const selecionada = instancia === nome;
              return (
                <div key={inst.id || nome} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 16px", background: selecionada ? "rgba(41,171,226,0.05)" : "#1a1a1a",
                  border: `1px solid ${selecionada ? "#29ABE2" : "#2e2e2e"}`,
                  borderRadius: "8px", marginBottom: "8px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    {conectado ? <Wifi size={16} style={{ color: "#25d366" }} /> : <WifiOff size={16} style={{ color: "#ef4444" }} />}
                    <div>
                      <p style={{ fontSize: "13px", fontWeight: "600", color: "#f0f0f0" }}>
                        {inst.profileName || nome}
                        {selecionada && <span style={{ fontSize: "10px", color: "#29ABE2", marginLeft: "8px", background: "rgba(41,171,226,0.15)", padding: "2px 6px", borderRadius: "10px" }}>selecionada</span>}
                      </p>
                      <p style={{ fontSize: "11px", color: conectado ? "#25d366" : "#ef4444" }}>
                        {conectado ? "Conectado" : "Desconectado"}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {conectado && !selecionada && (
                      <button className="btn-primary" style={{ padding: "6px 12px", fontSize: "12px", cursor: "pointer" }}
                        onClick={() => selecionarInstancia(nome)}>
                        Usar esta
                      </button>
                    )}
                    {!conectado && (
                      <button className="btn-primary" style={{ padding: "6px 12px", fontSize: "12px", cursor: "pointer" }}
                        onClick={() => gerarQR(nome)}>
                        QR Code
                      </button>
                    )}
                    <button className="btn-danger" style={{ padding: "6px 10px", fontSize: "12px", cursor: "pointer" }}
                      onClick={() => deletarInstancia(nome)}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* QR Code */}
            {qrCode && qrInstancia && (
              <div style={{
                background: "#1a1a1a", border: "1px solid rgba(37,211,102,0.3)",
                borderRadius: "10px", padding: "20px", textAlign: "center", marginTop: "12px",
              }}>
                <p style={{ fontSize: "13px", fontWeight: "600", color: "#f0f0f0", marginBottom: "4px" }}>
                  Conectar: <span style={{ color: "#25d366" }}>{qrInstancia}</span>
                </p>
                <p style={{ fontSize: "12px", color: "#606060", marginBottom: "16px" }}>
                  WhatsApp → Aparelhos conectados → Conectar aparelho → Escaneie
                </p>
                {qrCode.startsWith("data:image") ? (
                  <img src={qrCode} alt="QR" style={{ width: "200px", height: "200px", borderRadius: "8px" }} />
                ) : (
                  <div style={{ background: "#fff", padding: "16px", borderRadius: "8px", display: "inline-block" }}>
                    <p style={{ fontSize: "11px", color: "#000", fontFamily: "monospace", wordBreak: "break-all", maxWidth: "200px" }}>
                      {qrCode.replace("qr:", "")}
                    </p>
                  </div>
                )}
                <div style={{ marginTop: "12px" }}>
                  <button className="btn-secondary" style={{ cursor: "pointer" }}
                    onClick={() => { setQrCode(null); carregarInstancias(); selecionarInstancia(qrInstancia); }}>
                    <RefreshCw size={13} /> Já conectei
                  </button>
                </div>
              </div>
            )}

            {/* Nova instância */}
            <div style={{ marginTop: "16px", padding: "16px", background: "#1a1a1a", border: "1px dashed #3a3a3a", borderRadius: "8px" }}>
              <p style={{ fontSize: "13px", fontWeight: "600", color: "#f0f0f0", marginBottom: "12px" }}>
                <Plus size={13} style={{ marginRight: "6px", verticalAlign: "middle" }} />
                Nova instância
              </p>
              <div style={{ display: "flex", gap: "8px" }}>
                <input className="form-input" placeholder="Nome (ex: relatorios)" value={novaInstancia} onChange={e => setNovaInstancia(e.target.value)} style={{ flex: 1 }} />
                <button className="btn-primary" onClick={criarInstancia} disabled={criandoInst} style={{ cursor: "pointer" }}>
                  <Plus size={13} /> {criandoInst ? "Criando..." : "Criar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
