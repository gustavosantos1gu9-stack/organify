"use client";

import { useState, useEffect } from "react";
import {
  Check, Eye, EyeOff, RefreshCw, Wifi, WifiOff, Plus, Trash2,
  Target, MessageCircle,
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

  // WhatsApp / Evolution (puxado da agência)
  const [evoUrl, setEvoUrl] = useState("");
  const [evoKey, setEvoKey] = useState("");
  const [instancia, setInstancia] = useState("");
  const [instanciaProfile, setInstanciaProfile] = useState("");
  const [instanciaFoto, setInstanciaFoto] = useState("");
  const [waConectado, setWaConectado] = useState(false);
  const [loadingWa, setLoadingWa] = useState(true);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [novaInstancia, setNovaInstancia] = useState("relatorios");
  const [criandoInst, setCriandoInst] = useState(false);
  const [qrTimer, setQrTimer] = useState(30);
  const [qrRefreshing, setQrRefreshing] = useState(false);

  const [conexaoId, setConexaoId] = useState<string | null>(null);

  useEffect(() => {
    carregarTudo();
  }, []);

  // Auto-refresh QR Code a cada 30s + verificar se conectou a cada 5s
  useEffect(() => {
    if (!qrCode || waConectado) return;

    // Countdown do QR
    setQrTimer(30);
    const countdown = setInterval(() => {
      setQrTimer(prev => {
        if (prev <= 1) return 30;
        return prev - 1;
      });
    }, 1000);

    // Refresh QR a cada 30s
    const refreshInterval = setInterval(async () => {
      if (!instancia || !evoUrl || !evoKey) return;
      setQrRefreshing(true);
      try {
        const res = await fetch(`${evoUrl}/instance/connect/${instancia}`, {
          headers: { apikey: evoKey },
        });
        const data = await res.json();
        const newQr = data.base64 || data.qrcode?.base64;
        if (newQr) setQrCode(newQr);
      } catch {}
      setQrRefreshing(false);
      setQrTimer(30);
    }, 30000);

    // Verificar se conectou a cada 5s
    const checkInterval = setInterval(async () => {
      if (!instancia || !evoUrl || !evoKey) return;
      try {
        const res = await fetch(`${evoUrl}/instance/connectionState/${instancia}`, {
          headers: { apikey: evoKey },
        });
        const data = await res.json();
        const state = (data.instance?.state || data.state || "").toLowerCase();
        if (state === "open" || state === "connected") {
          setWaConectado(true);
          setQrCode(null);
          await salvarConexao({ whatsapp_conectado: true });
          verificarStatusWA(evoUrl, evoKey, instancia);
        }
      } catch {}
    }, 5000);

    return () => {
      clearInterval(countdown);
      clearInterval(refreshInterval);
      clearInterval(checkInterval);
    };
  }, [qrCode, waConectado, instancia, evoUrl, evoKey]);

  async function carregarTudo() {
    const agId = await getAgenciaId();

    // Puxar Evolution API da agência (a equipe não precisa saber)
    const { data: ag } = await supabase
      .from("agencias")
      .select("evolution_url, evolution_key")
      .eq("id", agId!)
      .single();

    if (ag?.evolution_url && ag?.evolution_key) {
      setEvoUrl(ag.evolution_url);
      setEvoKey(ag.evolution_key);
    }

    // Carregar conexão salva
    const { data: con } = await supabase
      .from("relatorios_conexoes")
      .select("*")
      .eq("agencia_id", agId!)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (con) {
      setConexaoId(con.id);
      setMetaToken(con.meta_token || "");
      setMetaNome(con.meta_nome || "");
      setMetaUserId(con.meta_user_id || "");
      setMetaConectado(!!con.meta_token);
      setInstancia(con.whatsapp_instancia || "");

      // Usar Evolution da conexão se tiver, senão usa da agência
      const url = con.evolution_url || ag?.evolution_url;
      const key = con.evolution_key || ag?.evolution_key;
      if (url && key) {
        setEvoUrl(url);
        setEvoKey(key);
      }

      if (con.meta_token) carregarContasAnuncio(con.meta_token);
      if (con.whatsapp_instancia && url && key) {
        verificarStatusWA(url, key, con.whatsapp_instancia);
      } else {
        setLoadingWa(false);
      }
    } else {
      setLoadingWa(false);
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
        alert(data.error || "Token inválido ou expirado");
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
    setMetaToken(""); setMetaNome(""); setMetaUserId("");
    setMetaConectado(false); setContas([]);
    await salvarConexao({ meta_token: null, meta_nome: null, meta_user_id: null });
  }

  // ─── WhatsApp ───────────────────────────────────────────────

  async function verificarStatusWA(url: string, key: string, inst: string) {
    setLoadingWa(true);
    try {
      const res = await fetch(`${url}/instance/connectionState/${inst}`, {
        headers: { apikey: key },
      });
      const data = await res.json();
      const state = (data.instance?.state || data.state || "").toLowerCase();
      setWaConectado(state === "open" || state === "connected");

      // Buscar foto/nome do perfil
      const infoRes = await fetch(`${url}/instance/fetchInstances`, {
        headers: { apikey: key },
      });
      const instances = await infoRes.json();
      const found = (Array.isArray(instances) ? instances : []).find(
        (i: any) => (i.name || i.instance?.instanceName) === inst
      );
      if (found) {
        setInstanciaProfile(found.profileName || inst);
        setInstanciaFoto(found.profilePicUrl || "");
      }
    } catch {
      setWaConectado(false);
    }
    setLoadingWa(false);
  }

  async function conectarWhatsApp() {
    if (!evoUrl || !evoKey) {
      alert("Evolution API não configurada. Configure em Configurações > Integrações.");
      return;
    }

    const nomeInst = novaInstancia.trim() || "relatorios";
    setCriandoInst(true);
    setQrCode(null);

    try {
      // Tentar conectar instância existente
      const connectRes = await fetch(`${evoUrl}/instance/connect/${nomeInst}`, {
        headers: { apikey: evoKey },
      });
      const connectData = await connectRes.json();

      if (connectData.base64) {
        setQrCode(connectData.base64);
        setInstancia(nomeInst);
        await salvarConexao({ whatsapp_instancia: nomeInst, evolution_url: evoUrl, evolution_key: evoKey });
        setCriandoInst(false);
        return;
      }
      if (connectData.qrcode?.base64) {
        setQrCode(connectData.qrcode.base64);
        setInstancia(nomeInst);
        await salvarConexao({ whatsapp_instancia: nomeInst, evolution_url: evoUrl, evolution_key: evoKey });
        setCriandoInst(false);
        return;
      }

      // Se não conseguiu, criar nova instância
      const createRes = await fetch(`${evoUrl}/instance/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evoKey },
        body: JSON.stringify({
          instanceName: nomeInst,
          token: nomeInst,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
        }),
      });
      const createData = await createRes.json();

      if (createData.qrcode?.base64) {
        setQrCode(createData.qrcode.base64);
      } else if (createData.base64) {
        setQrCode(createData.base64);
      }

      setInstancia(nomeInst);
      await salvarConexao({ whatsapp_instancia: nomeInst, evolution_url: evoUrl, evolution_key: evoKey });
    } catch {
      alert("Erro ao conectar. Verifique se a Evolution API está rodando.");
    }
    setCriandoInst(false);
  }

  async function confirmarConexao() {
    setQrCode(null);
    if (instancia) {
      await verificarStatusWA(evoUrl, evoKey, instancia);
      await salvarConexao({ whatsapp_conectado: true });
    }
  }

  async function desconectarWA() {
    if (!confirm("Desconectar WhatsApp?")) return;
    try {
      await fetch(`${evoUrl}/instance/logout/${instancia}`, {
        method: "DELETE",
        headers: { apikey: evoKey },
      });
    } catch {}
    setInstancia(""); setWaConectado(false); setInstanciaProfile(""); setInstanciaFoto("");
    await salvarConexao({ whatsapp_instancia: null, whatsapp_conectado: false });
  }

  // ─── Salvar ─────────────────────────────────────────────────

  async function salvarConexao(fields: Record<string, any>) {
    const agId = await getAgenciaId();
    if (conexaoId) {
      await supabase.from("relatorios_conexoes").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", conexaoId);
    } else {
      const { data } = await supabase.from("relatorios_conexoes").insert({ agencia_id: agId, ...fields }).select("id").single();
      if (data) setConexaoId(data.id);
    }
  }

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
              Cole o token do Facebook para conectar todas as contas de anúncio.
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
          <div style={{ borderTop: "1px solid #2e2e2e", paddingTop: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <p style={{ fontSize: "13px", fontWeight: "600", color: "#f0f0f0" }}>
                Contas de anúncio ({contas.length})
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
        )}
      </div>

      {/* ─── WhatsApp ──────────────────────────── */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: waConectado ? "#22c55e" : "#ef4444" }} />
            <MessageCircle size={18} color="#25d366" />
            <h2 style={{ fontSize: "16px", fontWeight: "600" }}>WhatsApp</h2>
          </div>
        </div>

        {loadingWa ? (
          <p style={{ fontSize: "13px", color: "#606060" }}>Verificando conexão...</p>
        ) : waConectado ? (
          /* WhatsApp conectado */
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "16px", background: "rgba(37,211,102,0.05)", border: "1px solid rgba(37,211,102,0.2)",
            borderRadius: "10px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {instanciaFoto ? (
                <img src={instanciaFoto} alt="" style={{ width: "44px", height: "44px", borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: "rgba(37,211,102,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Wifi size={20} style={{ color: "#25d366" }} />
                </div>
              )}
              <div>
                <p style={{ fontSize: "14px", fontWeight: "600", color: "#f0f0f0" }}>{instanciaProfile || instancia}</p>
                <p style={{ fontSize: "12px", color: "#25d366" }}>Conectado</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button className="btn-ghost" onClick={() => verificarStatusWA(evoUrl, evoKey, instancia)} style={{ cursor: "pointer", padding: "6px" }}>
                <RefreshCw size={14} />
              </button>
              <button onClick={desconectarWA} style={{
                background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: "6px", padding: "6px 12px", cursor: "pointer", color: "#ef4444", fontSize: "12px",
              }}>Desconectar</button>
            </div>
          </div>
        ) : qrCode ? (
          /* QR Code pra escanear */
          <div style={{
            background: "#1a1a1a", border: "1px solid rgba(37,211,102,0.3)",
            borderRadius: "10px", padding: "24px", textAlign: "center",
          }}>
            <p style={{ fontSize: "14px", fontWeight: "600", color: "#f0f0f0", marginBottom: "4px" }}>
              Escaneie o QR Code
            </p>
            <p style={{ fontSize: "12px", color: "#606060", marginBottom: "20px" }}>
              Abra o WhatsApp no celular → Aparelhos conectados → Conectar aparelho
            </p>
            <div style={{ position: "relative", display: "inline-block" }}>
              {qrCode.startsWith("data:image") ? (
                <img src={qrCode} alt="QR" style={{
                  width: "220px", height: "220px", borderRadius: "8px",
                  opacity: qrRefreshing ? 0.3 : 1, transition: "opacity 0.3s",
                }} />
              ) : (
                <div style={{ background: "#fff", padding: "20px", borderRadius: "8px", display: "inline-block" }}>
                  <p style={{ fontSize: "11px", color: "#000", fontFamily: "monospace", wordBreak: "break-all", maxWidth: "220px" }}>
                    {qrCode.replace("qr:", "")}
                  </p>
                </div>
              )}
              {qrRefreshing && (
                <div style={{
                  position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <RefreshCw size={24} style={{ color: "#25d366" }} className="spin" />
                </div>
              )}
            </div>
            <div style={{ marginTop: "12px" }}>
              <p style={{ fontSize: "11px", color: "#606060" }}>
                {qrRefreshing ? "Atualizando QR Code..." : `Atualiza automaticamente em ${qrTimer}s`}
              </p>
              <p style={{ fontSize: "11px", color: "#25d366", marginTop: "4px" }}>
                Verificando conexão automaticamente...
              </p>
            </div>
            <div style={{ marginTop: "12px" }}>
              <button className="btn-ghost" style={{ cursor: "pointer" }} onClick={() => setQrCode(null)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          /* Botão pra conectar */
          <div style={{ textAlign: "center", padding: "20px" }}>
            <p style={{ fontSize: "13px", color: "#606060", marginBottom: "16px" }}>
              Conecte um WhatsApp para enviar os relatórios nos grupos dos clientes.
            </p>
            <div style={{ display: "flex", gap: "8px", justifyContent: "center", alignItems: "center", marginBottom: "12px" }}>
              <input className="form-input" placeholder="Nome da instância" value={novaInstancia}
                onChange={e => setNovaInstancia(e.target.value)}
                style={{ width: "200px", textAlign: "center" }} />
            </div>
            <button className="btn-primary" onClick={conectarWhatsApp} disabled={criandoInst}
              style={{ cursor: "pointer", padding: "10px 24px", fontSize: "14px" }}>
              <MessageCircle size={16} style={{ marginRight: "6px" }} />
              {criandoInst ? "Gerando QR Code..." : "Conectar WhatsApp"}
            </button>
            {!evoUrl && (
              <p style={{ fontSize: "11px", color: "#ef4444", marginTop: "8px" }}>
                Evolution API não configurada. Configure em Configurações → Integrações.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
