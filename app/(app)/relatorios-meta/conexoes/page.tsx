"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();
  const metaSuccess = searchParams.get("meta_success");
  const metaError = searchParams.get("meta_error");
  const metaNomeParam = searchParams.get("meta_nome");

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

  // Múltiplas instâncias WhatsApp
  const [waInstancias, setWaInstancias] = useState<any[]>([]);
  const [novaInstNome, setNovaInstNome] = useState("");
  const [adicionandoInst, setAdicionandoInst] = useState(false);
  const [qrNovaInst, setQrNovaInst] = useState<string | null>(null);
  const [qrNovaInstNome, setQrNovaInstNome] = useState("");

  // Cloud API (Meta oficial)
  const [cloudNome, setCloudNome] = useState("");
  const [cloudPhoneId, setCloudPhoneId] = useState("");
  const [cloudToken, setCloudToken] = useState("");
  const [cloudWabaId, setCloudWabaId] = useState("");
  const [adicionandoCloud, setAdicionandoCloud] = useState(false);

  const [conexaoId, setConexaoId] = useState<string | null>(null);

  // Extensão de token
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [showAppSecret, setShowAppSecret] = useState(false);
  const [estendendo, setEstendendo] = useState(false);

  useEffect(() => {
    carregarTudo();
    // Tratar retorno do OAuth
    if (metaSuccess && metaNomeParam) {
      setMetaConectado(true);
      setMetaNome(metaNomeParam);
    }
    if (metaError) {
      alert("Erro ao conectar Facebook: " + metaError);
    }
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

  const [erroContas, setErroContas] = useState("");

  async function carregarContasAnuncio(token: string) {
    setLoadingContas(true);
    setErroContas("");
    try {
      const res = await fetch("/api/meta-ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "listar_contas", token }),
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setContas(data);
      } else {
        setErroContas(data.error || "Token expirado ou inválido. Reconecte abaixo.");
      }
    } catch (err: any) {
      setErroContas("Erro ao carregar contas: " + (err.message || "falha na requisição"));
    }
    setLoadingContas(false);
  }

  async function desconectarMeta() {
    if (!confirm("Desconectar Facebook?")) return;
    setMetaToken(""); setMetaNome(""); setMetaUserId("");
    setMetaConectado(false); setContas([]);
    await salvarConexao({ meta_token: null, meta_nome: null, meta_user_id: null });
  }

  async function estenderToken() {
    if (!metaToken.trim() || !appId.trim() || !appSecret.trim()) {
      alert("Preencha o App ID e App Secret");
      return;
    }
    setEstendendo(true);
    try {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId.trim()}&client_secret=${appSecret.trim()}&fb_exchange_token=${metaToken.trim()}`
      );
      const data = await res.json();
      if (data.access_token) {
        setMetaToken(data.access_token);
        await salvarConexao({ meta_token: data.access_token });
        alert("Token estendido para 60 dias!");
      } else {
        alert(data.error?.message || "Erro ao estender token");
      }
    } catch { alert("Erro ao estender token"); }
    setEstendendo(false);
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
          syncFullHistory: true,
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

  // ─── Múltiplas instâncias WhatsApp ──────────────────────────

  async function carregarInstancias() {
    const agId = await getAgenciaId();
    const { data } = await supabase.from("whatsapp_instancias").select("*").eq("agencia_id", agId!).order("created_at");
    if (data) {
      // Verificar status de cada instância
      for (const inst of data) {
        const url = inst.evolution_url || evoUrl;
        const key = inst.evolution_key || evoKey;
        if (url && key) {
          try {
            const res = await fetch(`${url}/instance/connectionState/${inst.instancia}`, { headers: { apikey: key } });
            const d = await res.json();
            const state = (d.instance?.state || d.state || "").toLowerCase();
            inst.conectado = state === "open" || state === "connected";
          } catch { inst.conectado = false; }
        }
      }
      setWaInstancias(data);
    }
  }

  async function adicionarInstancia() {
    if (!novaInstNome.trim()) { alert("Digite um nome para a instância"); return; }
    if (!evoUrl || !evoKey) { alert("Evolution API não configurada"); return; }
    setAdicionandoInst(true);
    const nomeInst = novaInstNome.trim().toLowerCase().replace(/\s+/g, "-");

    try {
      // Tentar conectar instância existente ou criar nova
      let qr: string | null = null;
      try {
        const connectRes = await fetch(`${evoUrl}/instance/connect/${nomeInst}`, { headers: { apikey: evoKey } });
        const connectData = await connectRes.json();
        qr = connectData.base64 || connectData.qrcode?.base64 || null;
      } catch {}

      if (!qr) {
        // Criar nova instância
        const createRes = await fetch(`${evoUrl}/instance/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: evoKey },
          body: JSON.stringify({ instanceName: nomeInst, token: nomeInst, qrcode: true, integration: "WHATSAPP-BAILEYS" }),
        });
        const createData = await createRes.json();
        qr = createData.qrcode?.base64 || createData.base64 || null;
      }

      // Configurar webhook
      try {
        const webhookSecret = "60efd4060d088e27af797cb1b2e8cdc198d34ee3a7260ebbe1d2160e9ab2453c";
        await fetch(`${evoUrl}/webhook/set/${nomeInst}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: evoKey },
          body: JSON.stringify({ webhook: { url: `https://salxconvert-blond.vercel.app/api/webhook/whatsapp?secret=${webhookSecret}`, enabled: true, events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"] } }),
        });
      } catch {}

      // Salvar no banco
      const agId = await getAgenciaId();
      await supabase.from("whatsapp_instancias").insert({
        agencia_id: agId, nome: novaInstNome.trim(), instancia: nomeInst,
        evolution_url: evoUrl, evolution_key: evoKey, conectado: false,
      });

      if (qr) { setQrNovaInst(qr); setQrNovaInstNome(nomeInst); }
      setNovaInstNome("");
      carregarInstancias();
    } catch { alert("Erro ao criar instância"); }
    setAdicionandoInst(false);
  }

  async function verificarInstancia(inst: any) {
    const url = inst.evolution_url || evoUrl;
    const key = inst.evolution_key || evoKey;
    try {
      const res = await fetch(`${url}/instance/connectionState/${inst.instancia}`, { headers: { apikey: key } });
      const d = await res.json();
      const state = (d.instance?.state || d.state || "").toLowerCase();
      const conectado = state === "open" || state === "connected";
      await supabase.from("whatsapp_instancias").update({ conectado, updated_at: new Date().toISOString() }).eq("id", inst.id);
      carregarInstancias();
    } catch {}
  }

  async function conectarInstancia(inst: any) {
    const url = inst.evolution_url || evoUrl;
    const key = inst.evolution_key || evoKey;
    try {
      const res = await fetch(`${url}/instance/connect/${inst.instancia}`, { headers: { apikey: key } });
      const d = await res.json();
      const qr = d.base64 || d.qrcode?.base64;
      if (qr) { setQrNovaInst(qr); setQrNovaInstNome(inst.instancia); }
    } catch { alert("Erro ao conectar"); }
  }

  async function desconectarInstancia(inst: any) {
    if (!confirm(`Desconectar ${inst.nome}?`)) return;
    const url = inst.evolution_url || evoUrl;
    const key = inst.evolution_key || evoKey;
    try { await fetch(`${url}/instance/logout/${inst.instancia}`, { method: "DELETE", headers: { apikey: key } }); } catch {}
    await supabase.from("whatsapp_instancias").update({ conectado: false }).eq("id", inst.id);
    carregarInstancias();
  }

  async function removerInstancia(inst: any) {
    if (!confirm(`Remover instância ${inst.nome}? Isso não apaga a instância da Evolution, apenas do sistema.`)) return;
    await supabase.from("whatsapp_instancias").delete().eq("id", inst.id);
    carregarInstancias();
  }

  async function adicionarCloud() {
    if (!cloudNome.trim() || !cloudPhoneId.trim() || !cloudToken.trim()) {
      alert("Preencha nome, Phone Number ID e Token");
      return;
    }
    setAdicionandoCloud(true);
    try {
      // Validar token e buscar info do número
      const res = await fetch(`https://graph.facebook.com/v21.0/${cloudPhoneId.trim()}?fields=display_phone_number,verified_name`, {
        headers: { Authorization: `Bearer ${cloudToken.trim()}` },
      });
      const data = await res.json();
      if (data.error) {
        alert("Erro: " + data.error.message);
        setAdicionandoCloud(false);
        return;
      }

      const agId = await getAgenciaId();
      await supabase.from("whatsapp_instancias").insert({
        agencia_id: agId,
        nome: cloudNome.trim(),
        instancia: `cloud-${cloudPhoneId.trim()}`,
        tipo: "cloud",
        cloud_phone_id: cloudPhoneId.trim(),
        cloud_token: cloudToken.trim(),
        cloud_waba_id: cloudWabaId.trim() || null,
        cloud_display_phone: data.display_phone_number || null,
        conectado: true,
      });

      setCloudNome(""); setCloudPhoneId(""); setCloudToken(""); setCloudWabaId("");
      carregarInstancias();
      alert("Número Cloud API adicionado!");
    } catch (e: any) {
      alert("Erro ao adicionar: " + e.message);
    }
    setAdicionandoCloud(false);
  }

  useEffect(() => { carregarInstancias(); }, [evoUrl]);

  // Auto-check QR nova instância
  useEffect(() => {
    if (!qrNovaInst || !qrNovaInstNome) return;
    const check = setInterval(async () => {
      try {
        const res = await fetch(`${evoUrl}/instance/connectionState/${qrNovaInstNome}`, { headers: { apikey: evoKey } });
        const d = await res.json();
        const state = (d.instance?.state || d.state || "").toLowerCase();
        if (state === "open" || state === "connected") {
          setQrNovaInst(null); setQrNovaInstNome("");
          await supabase.from("whatsapp_instancias").update({ conectado: true, updated_at: new Date().toISOString() }).eq("instancia", qrNovaInstNome);
          carregarInstancias();
        }
      } catch {}
    }, 5000);
    return () => clearInterval(check);
  }, [qrNovaInst, qrNovaInstNome]);

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
            {/* Botão OAuth — conectar com 1 clique */}
            <button onClick={async () => {
              const agId = await getAgenciaId();
              window.location.href = `/api/auth/meta?agencia_id=${agId}`;
            }} style={{
              width: "100%", padding: "14px", borderRadius: "10px", cursor: "pointer",
              background: "#1877f2", color: "#fff", border: "none",
              fontSize: "15px", fontWeight: "600", marginBottom: "16px",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
            }}>
              <Target size={18} /> Conectar com Facebook
            </button>

            <div style={{ textAlign: "center", fontSize: "12px", color: "#606060", marginBottom: "16px" }}>ou cole o token manualmente</div>

            <p style={{ fontSize: "13px", color: "#606060", marginBottom: "16px" }}>
              Cole o token da sua <strong>conta pessoal</strong> do Facebook para listar todas as contas de anúncio que você gerencia.
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
            {/* Estender token pra 60 dias */}
            {metaToken.trim() && (
              <details style={{ marginBottom: "12px" }}>
                <summary style={{ fontSize: "12px", color: "#22c55e", cursor: "pointer", userSelect: "none" }}>Estender token para 60 dias</summary>
                <div style={{ marginTop: "10px", padding: "14px", background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: "8px", fontSize: "12px", color: "#a0a0a0", lineHeight: "1.8" }}>
                  <p style={{ fontSize: "11px", color: "#606060", marginBottom: "10px" }}>
                    Encontre o App ID e App Secret em <strong style={{ color: "#29ABE2" }}>developers.facebook.com</strong> → seu app → Configurações → Básico
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "10px" }}>
                    <input className="form-input" placeholder="App ID" value={appId} onChange={e => setAppId(e.target.value)} style={{ fontSize: "12px" }} />
                    <div style={{ position: "relative" }}>
                      <input className="form-input" placeholder="App Secret" type={showAppSecret ? "text" : "password"} value={appSecret} onChange={e => setAppSecret(e.target.value)} style={{ fontSize: "12px", paddingRight: "32px" }} />
                      <button onClick={() => setShowAppSecret(!showAppSecret)} style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#606060" }}>
                        {showAppSecret ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                    </div>
                  </div>
                  <button onClick={estenderToken} disabled={estendendo} style={{
                    background: "#22c55e", color: "#fff", border: "none", borderRadius: "6px",
                    padding: "6px 16px", fontSize: "12px", fontWeight: "600", cursor: "pointer", width: "100%",
                  }}>{estendendo ? "Estendendo..." : "Estender para 60 dias"}</button>
                </div>
              </details>
            )}

            <details style={{ marginBottom: "12px" }}>
              <summary style={{ fontSize: "12px", color: "#29ABE2", cursor: "pointer", userSelect: "none" }}>Como gerar o Token da conta pessoal?</summary>
              <div style={{ marginTop: "10px", padding: "14px", background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: "8px", fontSize: "12px", color: "#a0a0a0", lineHeight: "1.8" }}>
                <p style={{ color: "#f0f0f0", fontWeight: "600", marginBottom: "8px" }}>Passo a passo:</p>
                <ol style={{ margin: 0, paddingLeft: "18px" }}>
                  <li>Acesse <strong style={{ color: "#29ABE2" }}>developers.facebook.com</strong></li>
                  <li>No menu superior, clique em <strong>Ferramentas</strong> → <strong>Explorador da Graph API</strong></li>
                  <li>No campo <strong>Aplicativo do Facebook</strong>, selecione seu app (ex: "Salx Digital" ou "API de Marketing")</li>
                  <li>Clique em <strong>Gerar Token de Acesso</strong> (botão azul)</li>
                  <li>Faça login com sua <strong>conta pessoal</strong> do Facebook (a que gerencia as contas de anúncio)</li>
                  <li>Marque as permissoes: <strong>ads_read</strong>, <strong>ads_management</strong> e <strong>business_management</strong></li>
                  <li>Copie o token gerado e cole acima</li>
                </ol>
                <p style={{ marginTop: "10px", color: "#f59e0b", fontSize: "11px" }}>Use o token da conta pessoal para ter acesso a todas as contas de anúncio dos seus clientes. Este token expira — gere um novo quando necessário.</p>
              </div>
            </details>
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
            ) : erroContas ? (
              <div style={{ padding: "12px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "8px" }}>
                <p style={{ fontSize: "12px", color: "#ef4444", marginBottom: "6px" }}>{erroContas}</p>
                <p style={{ fontSize: "11px", color: "#f59e0b" }}>Desconecte e reconecte com um novo token.</p>
              </div>
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

      {/* ─── Instâncias WhatsApp Adicionais ──────────────────────────── */}
      <div className="card" style={{ marginTop: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Plus size={18} color="#25d366" />
            <h2 style={{ fontSize: "16px", fontWeight: "600" }}>Instâncias WhatsApp</h2>
          </div>
          <span style={{ fontSize: "12px", color: "#606060" }}>{waInstancias.filter(i => i.tipo !== "cloud").length} instância(s)</span>
        </div>

        {/* Lista de instâncias */}
        {waInstancias.filter(i => i.tipo !== "cloud").length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
            {waInstancias.filter(i => i.tipo !== "cloud").map((inst) => (
              <div key={inst.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 16px",
                background: inst.conectado ? "rgba(37,211,102,0.05)" : "#1a1a1a",
                border: `1px solid ${inst.conectado ? "rgba(37,211,102,0.2)" : "#2e2e2e"}`,
                borderRadius: "10px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: inst.conectado ? "#22c55e" : "#ef4444" }} />
                  <div>
                    <p style={{ fontSize: "13px", fontWeight: "600", color: "#f0f0f0", margin: 0 }}>{inst.nome}</p>
                    <p style={{ fontSize: "11px", color: "#606060", margin: 0 }}>{inst.instancia}</p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button onClick={() => verificarInstancia(inst)} className="btn-ghost" style={{ cursor: "pointer", padding: "4px" }}>
                    <RefreshCw size={13} />
                  </button>
                  {!inst.conectado && (
                    <button onClick={() => conectarInstancia(inst)} style={{
                      background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.2)",
                      borderRadius: "6px", padding: "4px 10px", cursor: "pointer", color: "#25d366", fontSize: "11px",
                    }}>Conectar</button>
                  )}
                  {inst.conectado && (
                    <button onClick={() => desconectarInstancia(inst)} style={{
                      background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
                      borderRadius: "6px", padding: "4px 10px", cursor: "pointer", color: "#ef4444", fontSize: "11px",
                    }}>Desconectar</button>
                  )}
                  <button onClick={() => removerInstancia(inst)} style={{
                    background: "none", border: "1px solid #2e2e2e",
                    borderRadius: "6px", padding: "4px 8px", cursor: "pointer", color: "#606060",
                  }}><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* QR Code de nova instância */}
        {qrNovaInst && (
          <div style={{ background: "#1a1a1a", border: "1px solid rgba(37,211,102,0.3)", borderRadius: "10px", padding: "24px", textAlign: "center", marginBottom: "16px" }}>
            <p style={{ fontSize: "14px", fontWeight: "600", color: "#f0f0f0", marginBottom: "4px" }}>
              Escaneie o QR Code — {qrNovaInstNome}
            </p>
            <p style={{ fontSize: "12px", color: "#606060", marginBottom: "16px" }}>
              Abra o WhatsApp → Aparelhos conectados → Conectar
            </p>
            {qrNovaInst.startsWith("data:image") ? (
              <img src={qrNovaInst} alt="QR" style={{ width: "220px", height: "220px", borderRadius: "8px" }} />
            ) : (
              <div style={{ background: "#fff", padding: "20px", borderRadius: "8px", display: "inline-block" }}>
                <p style={{ fontSize: "11px", color: "#000", fontFamily: "monospace", wordBreak: "break-all", maxWidth: "220px" }}>
                  {qrNovaInst.replace("qr:", "")}
                </p>
              </div>
            )}
            <p style={{ fontSize: "11px", color: "#25d366", marginTop: "12px" }}>Verificando conexão automaticamente...</p>
            <button className="btn-ghost" style={{ cursor: "pointer", marginTop: "8px" }} onClick={() => { setQrNovaInst(null); setQrNovaInstNome(""); }}>
              Cancelar
            </button>
          </div>
        )}

        {/* Adicionar nova instância */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input className="form-input" placeholder="Nome da instância (ex: whatsapp-lays)" value={novaInstNome}
            onChange={e => setNovaInstNome(e.target.value)} style={{ flex: 1 }} />
          <button className="btn-primary" onClick={adicionarInstancia} disabled={adicionandoInst} style={{ cursor: "pointer", whiteSpace: "nowrap" }}>
            <Plus size={14} /> {adicionandoInst ? "Criando..." : "Adicionar"}
          </button>
        </div>
        {!evoUrl && (
          <p style={{ fontSize: "11px", color: "#ef4444", marginTop: "8px" }}>
            Evolution API não configurada. Configure em Configurações → Integrações.
          </p>
        )}
      </div>

      {/* ─── WhatsApp Cloud API (Meta Oficial) ──────────────────────────── */}
      <div className="card" style={{ marginTop: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
          <Target size={18} color="#25d366" />
          <h2 style={{ fontSize: "16px", fontWeight: "600" }}>WhatsApp Cloud API (Oficial)</h2>
          <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "10px", background: "rgba(37,211,102,0.15)", color: "#25d366", fontWeight: "600" }}>OFICIAL</span>
        </div>

        <p style={{ fontSize: "12px", color: "#606060", marginBottom: "16px" }}>
          Adicione números da WhatsApp Business API oficial da Meta. Sem risco de ban, histórico de 30 dias, grátis até 1.000 conversas/mês por número.
        </p>

        {/* Lista de números Cloud API */}
        {waInstancias.filter(i => i.tipo === "cloud").length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
            {waInstancias.filter(i => i.tipo === "cloud").map((inst) => (
              <div key={inst.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 16px",
                background: "rgba(37,211,102,0.05)",
                border: "1px solid rgba(37,211,102,0.2)",
                borderRadius: "10px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#22c55e" }} />
                  <div>
                    <p style={{ fontSize: "13px", fontWeight: "600", color: "#f0f0f0", margin: 0 }}>{inst.nome}</p>
                    <p style={{ fontSize: "11px", color: "#606060", margin: 0 }}>
                      {inst.cloud_display_phone || inst.cloud_phone_id} • Cloud API
                    </p>
                  </div>
                </div>
                <button onClick={() => removerInstancia(inst)} style={{
                  background: "none", border: "1px solid #2e2e2e",
                  borderRadius: "6px", padding: "4px 8px", cursor: "pointer", color: "#606060",
                }}><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        )}

        {/* Adicionar novo */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
          <input className="form-input" placeholder="Nome da conta (ex: Cliente X)" value={cloudNome} onChange={e => setCloudNome(e.target.value)} />
          <input className="form-input" placeholder="Phone Number ID" value={cloudPhoneId} onChange={e => setCloudPhoneId(e.target.value)} />
        </div>
        <input className="form-input" placeholder="Access Token (System User)" value={cloudToken} onChange={e => setCloudToken(e.target.value)} style={{ marginBottom: "8px" }} />
        <input className="form-input" placeholder="WABA ID (opcional)" value={cloudWabaId} onChange={e => setCloudWabaId(e.target.value)} style={{ marginBottom: "8px" }} />
        <button className="btn-primary" onClick={adicionarCloud} disabled={adicionandoCloud} style={{ cursor: "pointer", width: "100%" }}>
          <Plus size={14} /> {adicionandoCloud ? "Adicionando..." : "Adicionar Cloud API"}
        </button>

        <details style={{ marginTop: "12px" }}>
          <summary style={{ fontSize: "12px", color: "#29ABE2", cursor: "pointer", userSelect: "none" }}>Como obter Phone Number ID e Token?</summary>
          <div style={{ marginTop: "10px", padding: "14px", background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: "8px", fontSize: "12px", color: "#a0a0a0", lineHeight: "1.8" }}>
            <p><strong style={{ color: "#f0f0f0" }}>Phone Number ID:</strong></p>
            <ol style={{ margin: "4px 0 12px", paddingLeft: "18px" }}>
              <li>developers.facebook.com → seu app → WhatsApp → <strong>API Setup</strong></li>
              <li>Copie o <strong>Phone number ID</strong> (número grande, não confundir com o telefone)</li>
            </ol>
            <p><strong style={{ color: "#f0f0f0" }}>Access Token:</strong></p>
            <ol style={{ margin: "4px 0", paddingLeft: "18px" }}>
              <li>Mesma tela → gere um token permanente via <strong>System User</strong> no Business Manager</li>
              <li>Permissões: <strong>whatsapp_business_messaging, whatsapp_business_management</strong></li>
            </ol>
          </div>
        </details>
      </div>
    </div>
  );
}
