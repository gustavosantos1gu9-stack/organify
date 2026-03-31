"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageCircle, Bot, CreditCard, Target, Check, Eye, EyeOff, Plus, Trash2, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { supabase, getAgenciaId } from "@/lib/hooks";

interface Instancia {
  id: string;
  name: string;
  connectionStatus: string;
  profileName?: string;
  profilePicUrl?: string;
  // compatibilidade com formato antigo
  instance?: { instanceName: string; status?: string; state?: string; };
  state?: string;
}

// ─── Versão CLIENTE: só QR Code WhatsApp + Meta Pixel ────────
function IntegracoesCliente() {
  const [evoUrl, setEvoUrl] = useState("");
  const [evoKey, setEvoKey] = useState("");
  const [instancia, setInstancia] = useState("");
  const [agenciaId, setAgenciaId] = useState<string | null>(null);
  const [waConectado, setWaConectado] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profilePic, setProfilePic] = useState("");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [novaInstancia, setNovaInstancia] = useState("whatsapp");
  const [criando, setCriando] = useState(false);
  const [loading, setLoading] = useState(true);

  // Meta
  const [pixelId, setPixelId] = useState("");
  const [metaToken, setMetaToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [metaAtivo, setMetaAtivo] = useState(false);
  const [metaAdAccountId, setMetaAdAccountId] = useState("");
  const [metaBusinessToken, setMetaBusinessToken] = useState("");
  const [showBusinessToken, setShowBusinessToken] = useState(false);
  const [metaAdsAtivo, setMetaAdsAtivo] = useState(false);

  // Helper para chamar Evolution API sempre com agencia_id
  const evoCall = useCallback(async (action: string, instanceName?: string, payload?: Record<string, unknown>) => {
    const res = await fetch("/api/evolution", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, instanceName, payload, agencia_id: agenciaId }),
    });
    return res.json();
  }, [agenciaId]);

  // Polling: checa status da conexão a cada 5s quando QR está visível
  useEffect(() => {
    if (!qrCode || !instancia || waConectado) return;
    const interval = setInterval(async () => {
      try {
        const data = await evoCall("status", instancia);
        const status = (data?.state || data?.instance?.state || "").toLowerCase();
        if (status === "open" || status === "connected") {
          setWaConectado(true);
          setQrCode(null);
          // Buscar profile
          const instances = await evoCall("fetchInstances");
          if (Array.isArray(instances)) {
            const inst = instances.find((i: any) => (i.name || i.instance?.instanceName) === instancia);
            if (inst) {
              setProfileName(inst.profileName || instancia);
              setProfilePic(inst.profilePicUrl || "");
            }
          }
          await supabase.from("agencias").update({ whatsapp_conectado: true }).eq("id", agenciaId!);
          // Sync automático das conversas após conectar
          try {
            await fetch("/api/evolution/sync-all", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ agencia_id: agenciaId, com_mensagens: true, lote: 100 }),
            });
          } catch {}
        }
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [qrCode, instancia, waConectado, agenciaId, evoCall]);

  // Auto-refresh QR Code a cada 30s (QR expira rápido)
  useEffect(() => {
    if (!qrCode || !instancia || waConectado) return;
    const interval = setInterval(async () => {
      try {
        const data = await evoCall("connect", instancia);
        const newQr = data.base64 || data.qrcode?.base64;
        if (newQr) setQrCode(newQr);
      } catch {}
    }, 30000);
    return () => clearInterval(interval);
  }, [qrCode, instancia, waConectado, evoCall]);

  useEffect(() => {
    async function load() {
      const agId = await getAgenciaId();
      setAgenciaId(agId);
      const { data } = await supabase.from("agencias").select("*").eq("id", agId!).single();
      if (data) {
        // Se a agência filha não tem Evolution, puxar da mãe
        let evoUrlFinal = data.evolution_url || "";
        let evoKeyFinal = data.evolution_key || "";
        if (!evoUrlFinal && data.parent_id) {
          const { data: parent } = await supabase.from("agencias").select("evolution_url, evolution_key").eq("id", data.parent_id).single();
          if (parent) {
            evoUrlFinal = parent.evolution_url || "";
            evoKeyFinal = parent.evolution_key || "";
          }
        }
        setEvoUrl(evoUrlFinal);
        setEvoKey(evoKeyFinal);
        setPixelId(data.meta_pixel_id || "");
        setMetaToken(data.meta_token || "");
        setMetaAtivo(data.meta_ativo || false);
        setMetaAdAccountId(data.meta_ad_account_id || "");
        setMetaBusinessToken(data.meta_business_token || "");
        setMetaAdsAtivo(data.meta_ads_ativo || false);
        // Verificar instância salva desta agência
        const instSalva = data.whatsapp_instancia || "";
        if (evoUrlFinal && evoKeyFinal && instSalva) {
          try {
            const res = await fetch("/api/evolution", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "fetchInstances", agencia_id: agId }),
            });
            const instances = await res.json();
            if (Array.isArray(instances)) {
              const inst = instances.find((i: any) => (i.name || i.instance?.instanceName) === instSalva);
              if (inst) {
                const status = (inst.connectionStatus || inst.instance?.state || "").toLowerCase();
                setInstancia(instSalva);
                setWaConectado(status === "open" || status === "connected");
                setProfileName(inst.profileName || instSalva);
                setProfilePic(inst.profilePicUrl || "");
              }
            }
          } catch {}
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  const conectarWA = async () => {
    if (!evoUrl || !evoKey) { alert("Evolution API não configurada. Peça para seu gestor configurar."); return; }
    setCriando(true);
    try {
      const agId = agenciaId || await getAgenciaId();
      const nome = novaInstancia.trim() || "whatsapp";

      // Primeiro tenta deletar instância antiga com problema (se existir com status "close")
      try {
        const statusRes = await evoCall("status", nome);
        const state = (statusRes?.state || statusRes?.instance?.state || "").toLowerCase();
        if (state === "close" || state === "connecting") {
          // Instância existe mas desconectada — tentar reconectar
          const data = await evoCall("connect", nome);
          const qr = data.base64 || data.qrcode?.base64;
          if (qr) {
            setQrCode(qr); setInstancia(nome);
            await supabase.from("agencias").update({ whatsapp_instancia: nome }).eq("id", agId!);
            setCriando(false);
            return;
          }
        }
      } catch {}

      // Tentar connect direto
      const data = await evoCall("connect", nome);
      const qr = data.base64 || data.qrcode?.base64;
      if (qr) {
        setQrCode(qr); setInstancia(nome);
        await supabase.from("agencias").update({ whatsapp_instancia: nome }).eq("id", agId!);
      } else {
        // Instância não existe — deletar caso corrompida e criar nova
        try { await evoCall("delete", nome); } catch {}
        const data2 = await evoCall("create", nome, { instanceName: nome, token: nome, qrcode: true, integration: "WHATSAPP-BAILEYS" });
        const qr2 = data2.qrcode?.base64 || data2.base64;
        if (qr2) {
          setQrCode(qr2); setInstancia(nome);
          await supabase.from("agencias").update({ whatsapp_instancia: nome }).eq("id", agId!);
        } else {
          alert("Não foi possível gerar o QR Code. Tente novamente.");
        }
      }
    } catch { alert("Erro ao conectar. Verifique sua conexão e tente novamente."); }
    setCriando(false);
  };

  const salvarMeta = async () => {
    const agId = await getAgenciaId();
    const ativo = pixelId.trim().length > 0 && metaToken.trim().length > 0;
    const adsAtivo = metaAdAccountId.trim().length > 0 && metaBusinessToken.trim().length > 0;
    await supabase.from("agencias").update({
      meta_pixel_id: pixelId, meta_token: metaToken, meta_ativo: ativo,
      meta_ad_account_id: metaAdAccountId || null, meta_business_token: metaBusinessToken || null, meta_ads_ativo: adsAtivo,
    }).eq("id", agId!);
    setMetaAtivo(ativo);
    setMetaAdsAtivo(adsAtivo);
    alert("Meta Ads salvo!");
  };

  if (loading) return <div style={{ textAlign: "center", padding: "60px", color: "#606060" }}>Carregando...</div>;

  return (
    <div className="animate-in">
      <div className="breadcrumb">
        <a href="/">Dashboard</a><span>›</span>
        <span className="current">Integrações</span>
      </div>
      <h1 style={{ fontSize: "22px", fontWeight: "600", marginBottom: "28px" }}>Integrações</h1>

      {/* WhatsApp */}
      <div className="card" style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
          <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: waConectado ? "#22c55e" : "#ef4444" }} />
          <MessageCircle size={20} color="#25d366" />
          <h2 style={{ fontSize: "16px", fontWeight: "600" }}>WhatsApp</h2>
        </div>

        {waConectado ? (
          <div style={{
            display: "flex", alignItems: "center", gap: "14px",
            padding: "16px", background: "rgba(37,211,102,0.05)", border: "1px solid rgba(37,211,102,0.2)", borderRadius: "10px",
          }}>
            {profilePic ? (
              <img src={profilePic} alt="" style={{ width: "44px", height: "44px", borderRadius: "50%" }} />
            ) : (
              <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: "rgba(37,211,102,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Wifi size={20} color="#25d366" />
              </div>
            )}
            <div>
              <p style={{ fontSize: "14px", fontWeight: "600", color: "#f0f0f0" }}>{profileName}</p>
              <p style={{ fontSize: "12px", color: "#25d366" }}>Conectado</p>
            </div>
          </div>
        ) : qrCode ? (
          <div style={{ textAlign: "center", padding: "20px", background: "#1a1a1a", border: "1px solid rgba(37,211,102,0.3)", borderRadius: "10px" }}>
            <p style={{ fontSize: "14px", fontWeight: "600", color: "#f0f0f0", marginBottom: "4px" }}>Escaneie o QR Code</p>
            <p style={{ fontSize: "12px", color: "#606060", marginBottom: "20px" }}>Abra o WhatsApp → Aparelhos conectados → Conectar aparelho</p>
            {qrCode.startsWith("data:image") ? (
              <img src={qrCode} alt="QR" style={{ width: "220px", height: "220px", borderRadius: "8px" }} />
            ) : (
              <div style={{ background: "#fff", padding: "20px", borderRadius: "8px", display: "inline-block" }}>
                <p style={{ fontSize: "11px", color: "#000", fontFamily: "monospace", wordBreak: "break-all", maxWidth: "220px" }}>{qrCode.replace("qr:", "")}</p>
              </div>
            )}
            <div style={{ marginTop: "16px" }}>
              <button className="btn-secondary" style={{ cursor: "pointer" }} onClick={() => { setQrCode(null); window.location.reload(); }}>
                <RefreshCw size={13} /> Já conectei
              </button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "24px" }}>
            <p style={{ fontSize: "13px", color: "#606060", marginBottom: "16px" }}>Conecte um WhatsApp para rastrear conversas e disparar eventos.</p>
            <button className="btn-primary" onClick={conectarWA} disabled={criando} style={{ cursor: "pointer", padding: "10px 24px" }}>
              <MessageCircle size={16} style={{ marginRight: "6px" }} />
              {criando ? "Gerando QR Code..." : "Conectar WhatsApp"}
            </button>
            {!evoUrl && (
              <p style={{ fontSize: "11px", color: "#f59e0b", marginTop: "8px" }}>Evolution API não configurada para esta conta.</p>
            )}
          </div>
        )}
      </div>

      {/* Meta Ads - Pixel */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
          <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: metaAtivo ? "#29ABE2" : "#ef4444" }} />
          <Target size={18} color="#1877f2" />
          <h2 style={{ fontSize: "16px", fontWeight: "600" }}>Meta Ads</h2>
        </div>
        <p style={{ fontSize: "13px", color: "#606060", marginBottom: "20px" }}>Pixel e Conversions API para rastrear e otimizar campanhas</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
          <div className="form-group">
            <label className="form-label">Pixel ID</label>
            <input className="form-input" placeholder="1234567890123456" value={pixelId} onChange={e => setPixelId(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Access Token (Conversions API)</label>
            <div style={{ position: "relative" }}>
              <input className="form-input" placeholder="EAAxxxxxxx..." type={showToken ? "text" : "password"}
                value={metaToken} onChange={e => setMetaToken(e.target.value)} style={{ paddingRight: "40px" }} />
              <button onClick={() => setShowToken(!showToken)} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#606060" }}>
                {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
        </div>
        {/* Gerenciador de Anúncios */}
        <div style={{ borderTop: "1px solid #2e2e2e", paddingTop: "16px", marginTop: "4px", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <div>
              <p style={{ fontSize: "14px", fontWeight: "600", color: "#f0f0f0", margin: 0 }}>Gerenciador de Anúncios</p>
              <p style={{ fontSize: "12px", color: "#606060", margin: 0 }}>Para filtrar conversas por campanha e conjunto de anúncios</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: metaAdsAtivo ? "#29ABE2" : "#ef4444" }} />
              <span style={{ fontSize: "12px", color: metaAdsAtivo ? "#29ABE2" : "#ef4444" }}>{metaAdsAtivo ? "Ativo" : "Inativo"}</span>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div className="form-group">
              <label className="form-label">Ad Account ID</label>
              <input className="form-input" placeholder="act_1234567890" value={metaAdAccountId} onChange={e => setMetaAdAccountId(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Token do Gerenciador de Negócios</label>
              <div style={{ position: "relative" }}>
                <input className="form-input" placeholder="EAAxxxxxxx..." type={showBusinessToken ? "text" : "password"}
                  value={metaBusinessToken} onChange={e => setMetaBusinessToken(e.target.value)} style={{ paddingRight: "40px" }} />
                <button onClick={() => setShowBusinessToken(!showBusinessToken)} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#606060" }}>
                  {showBusinessToken ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button className="btn-primary" onClick={salvarMeta} style={{ cursor: "pointer" }}><Check size={14} /> Salvar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Versão MASTER: completa (original) ──────────────────────
function IntegracoesMaster() {
  // Evolution API
  const [evoUrl, setEvoUrl] = useState("https://evolution-api-production-e0b8.up.railway.app");
  const [evoKey, setEvoKey] = useState("6656711fd37b4eadc6a9d6a31b84c8648e19708f55e7f09b85b7b61d9660d6ad");
  const [instancias, setInstancias] = useState<Instancia[]>([]);
  const [loadingInst, setLoadingInst] = useState(false);
  const [qrCode, setQrCode] = useState<string|null>(null);
  const [qrInstancia, setQrInstancia] = useState<string|null>(null);
  const [novaInstancia, setNovaInstancia] = useState("");
  const [novoToken, setNovoToken] = useState("");
  const [criandoInst, setCriandoInst] = useState(false);
  const [salvandoEvo, setSalvandoEvo] = useState(false);

  // Meta Ads
  const [pixelId, setPixelId] = useState("");
  const [metaToken, setMetaToken] = useState("");
  const [showMetaToken, setShowMetaToken] = useState(false);
  const [metaAtivo, setMetaAtivo] = useState(false);
  const [metaAdAccountId, setMetaAdAccountId] = useState("");
  const [metaBusinessToken, setMetaBusinessToken] = useState("");
  const [showBusinessToken, setShowBusinessToken] = useState(false);
  const [metaAdsAtivo, setMetaAdsAtivo] = useState(false);

  // OpenAI
  const [openaiKey, setOpenaiKey] = useState("");
  const [openaiAtivo, setOpenaiAtivo] = useState(false);

  // Asaas
  const [asaasToken, setAsaasToken] = useState("");

  // Tabs WhatsApp
  const [waTab, setWaTab] = useState<"conexao"|"cobrancas"|"api">("conexao");
  const [cobrancaMsg, setCobrancaMsg] = useState(`Olá, NOME_CLIENTE!\nSegue lembrete da sua cobrança.\nValor: VALOR\nVencimento: DATA_VENCIMENTO`);

  useEffect(() => {
    async function load() {
      const agId = await getAgenciaId();
      const { data } = await supabase.from("agencias").select("*").eq("id", agId!).single();
      if (data) {
        setEvoUrl(data.evolution_url || "https://evolution-api-production-e0b8.up.railway.app");
        setEvoKey(data.evolution_key || "6656711fd37b4eadc6a9d6a31b84c8648e19708f55e7f09b85b7b61d9660d6ad");
        setPixelId(data.meta_pixel_id || "");
        setMetaToken(data.meta_token || "");
        setMetaAtivo(data.meta_ativo || false);
        setMetaAdAccountId(data.meta_ad_account_id || "");
        setMetaBusinessToken(data.meta_business_token || "");
        setMetaAdsAtivo(data.meta_ads_ativo || false);
        setOpenaiKey(data.openai_key || "");
        setOpenaiAtivo(data.openai_ativo || false);
        setAsaasToken(data.asaas_token || "");
      }
    }
    load();
    carregarInstancias();
  }, []);

  const evoCall = async (action: string, instanceName?: string, payload?: Record<string,unknown>) => {
    const res = await fetch("/api/evolution", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, instanceName, payload }),
    });
    return res.json();
  };

  const carregarInstancias = async () => {
    setLoadingInst(true);
    try {
      const data = await evoCall("fetchInstances");
      setInstancias(Array.isArray(data) ? data : []);
    } catch(e) {
      console.error("Erro ao carregar instâncias:", e);
    } finally { setLoadingInst(false); }
  };

  const salvarEvo = async () => {
    setSalvandoEvo(true);
    try {
      const agId = await getAgenciaId();
      await supabase.from("agencias").update({ evolution_url: evoUrl, evolution_key: evoKey }).eq("id", agId!);
      await carregarInstancias();
      alert("Configurações salvas!");
    } catch(e) { alert("Erro ao salvar"); }
    finally { setSalvandoEvo(false); }
  };

  const criarInstancia = async () => {
    if (!novaInstancia.trim()) { alert("Digite o nome da instância"); return; }
    setCriandoInst(true);
    try {
      const data = await evoCall("create", novaInstancia, {
        instanceName: novaInstancia,
        token: novoToken || novaInstancia,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
      });
      if (data.qrcode?.base64) {
        setQrCode(data.qrcode.base64);
        setQrInstancia(novaInstancia);
      }
      setNovaInstancia("");
      setNovoToken("");
      await carregarInstancias();
    } catch(e) { alert("Erro ao criar instância"); }
    finally { setCriandoInst(false); }
  };

  const gerarQR = async (nome: string) => {
    try {
      setQrInstancia(nome);
      setQrCode(null);
      const data = await evoCall("connect", nome);
      if (data.base64) setQrCode(data.base64);
      else if (data.code) setQrCode(`qr:${data.code}`);
      else if (data.qrcode?.base64) setQrCode(data.qrcode.base64);
    } catch(e) { alert("Erro ao gerar QR Code"); }
  };

  const deletarInstancia = async (nome: string) => {
    if (!confirm(`Deletar instância ${nome}?`)) return;
    try {
      await evoCall("delete", nome);
      await carregarInstancias();
    } catch(e) { alert("Erro ao deletar"); }
  };

  const salvarMeta = async () => {
    try {
      const agId = await getAgenciaId();
      const ativar = pixelId.trim().length > 0 && metaToken.trim().length > 0 ? true : metaAtivo;
      const adsAtivar = metaAdAccountId.trim().length > 0 && metaBusinessToken.trim().length > 0 ? true : metaAdsAtivo;
      setMetaAtivo(ativar);
      setMetaAdsAtivo(adsAtivar);
      await supabase.from("agencias").update({
        meta_pixel_id: pixelId,
        meta_token: metaToken,
        meta_ativo: ativar,
        meta_ad_account_id: metaAdAccountId || null,
        meta_business_token: metaBusinessToken || null,
        meta_ads_ativo: adsAtivar,
      }).eq("id", agId!);
      alert("Meta Ads salvo! ✅");
    } catch(e) { alert("Erro ao salvar"); }
  };

  const salvarOpenAI = async () => {
    try {
      const agId = await getAgenciaId();
      await supabase.from("agencias").update({ openai_key: openaiKey, openai_ativo: openaiAtivo }).eq("id", agId!);
      alert("OpenAI salvo!");
    } catch(e) { alert("Erro ao salvar"); }
  };

  const salvarAsaas = async () => {
    try {
      const agId = await getAgenciaId();
      await supabase.from("agencias").update({ asaas_token: asaasToken }).eq("id", agId!);
      alert("Asaas salvo!");
    } catch(e) { alert("Erro ao salvar"); }
  };

  const getStatus = (inst: Instancia) => {
    return (inst.connectionStatus || inst.instance?.state || inst.instance?.status || inst.state || "disconnected").toLowerCase();
  };

  const isConectado = (inst: Instancia) => {
    const s = getStatus(inst);
    return s === "open" || s === "connected";
  };

  const getNome = (inst: Instancia) => inst.name || inst.instance?.instanceName || "";

  return (
    <div className="animate-in">
      <div className="breadcrumb">
        <a href="/">Início</a><span>›</span>
        <span style={{color:"#a0a0a0"}}>Configurações</span><span>›</span>
        <span className="current">Integrações</span>
      </div>
      <h1 style={{fontSize:"22px",fontWeight:"600",marginBottom:"28px"}}>Integrações</h1>

      {/* WhatsApp */}
      <div className="card" style={{marginBottom:"20px"}}>
        <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"20px"}}>
          <MessageCircle size={20} color="#29ABE2"/>
          <h2 style={{fontSize:"16px",fontWeight:"600"}}>WhatsApp</h2>
        </div>

        <div style={{borderBottom:"1px solid #2e2e2e",marginBottom:"24px"}}>
          {(["conexao","cobrancas","api"] as const).map(tab=>(
            <button key={tab} onClick={()=>setWaTab(tab)} style={{
              padding:"8px 20px",background:"none",border:"none",cursor:"pointer",
              fontSize:"13px",fontWeight:"500",
              color:waTab===tab?"#f0f0f0":"#606060",
              borderBottom:waTab===tab?"2px solid #29ABE2":"2px solid transparent",
              marginBottom:"-1px",transition:"all 0.15s",
            }}>
              {tab==="conexao"?"Conexão":tab==="cobrancas"?"Cobranças":"API"}
            </button>
          ))}
        </div>

        {waTab==="conexao" && (
          <div style={{display:"flex",flexDirection:"column",gap:"20px"}}>
            {/* Config da API */}
            <div style={{background:"#1a1a1a",border:"1px solid #2e2e2e",borderRadius:"10px",padding:"16px"}}>
              <p style={{fontSize:"13px",fontWeight:"600",marginBottom:"12px",color:"#f0f0f0"}}>Configuração da Evolution API</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"12px"}}>
                <div className="form-group">
                  <label className="form-label">URL da API</label>
                  <input className="form-input" value={evoUrl} onChange={e=>setEvoUrl(e.target.value)} placeholder="https://..."/>
                </div>
                <div className="form-group">
                  <label className="form-label">API Key</label>
                  <input className="form-input" value={evoKey} onChange={e=>setEvoKey(e.target.value)} type="password"/>
                </div>
              </div>
              <button className="btn-primary" onClick={salvarEvo} disabled={salvandoEvo} style={{cursor:"pointer"}}>
                <Check size={14}/> {salvandoEvo?"Salvando...":"Salvar e Conectar"}
              </button>
            </div>

            {/* Instâncias */}
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px"}}>
                <p style={{fontSize:"13px",fontWeight:"600",color:"#f0f0f0"}}>Instâncias WhatsApp</p>
                <button className="btn-ghost" onClick={carregarInstancias} style={{cursor:"pointer",padding:"6px"}}>
                  <RefreshCw size={14}/>
                </button>
              </div>

              {/* Lista de instâncias */}
              {loadingInst ? (
                <p style={{fontSize:"13px",color:"#606060"}}>Carregando instâncias...</p>
              ) : instancias.length === 0 ? (
                <p style={{fontSize:"13px",color:"#606060"}}>Nenhuma instância encontrada.</p>
              ) : instancias.map(inst => {
                const nome = getNome(inst);
                const status = getStatus(inst);
                const conectado = isConectado(inst);
                return (
                  <div key={inst.id || nome} style={{
                    display:"flex",alignItems:"center",justifyContent:"space-between",
                    padding:"12px 16px",background:"#1a1a1a",border:`1px solid ${conectado?"rgba(41,171,226,0.3)":"#2e2e2e"}`,
                    borderRadius:"8px",marginBottom:"8px",
                  }}>
                    <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                      {inst.profilePicUrl ? (
                        <img src={inst.profilePicUrl} alt="" style={{width:"36px",height:"36px",borderRadius:"50%",objectFit:"cover"}}/>
                      ) : (
                        conectado
                          ? <Wifi size={16} style={{color:"#29ABE2"}}/>
                          : <WifiOff size={16} style={{color:"#ef4444"}}/>
                      )}
                      <div>
                        <p style={{fontSize:"13px",fontWeight:"600",color:"#f0f0f0"}}>{inst.profileName || nome}</p>
                        <p style={{fontSize:"11px",color:"#606060"}}>{nome}</p>
                        <p style={{fontSize:"11px",color:conectado?"#29ABE2":"#ef4444",textTransform:"capitalize"}}>{conectado?"● Conectado":"● Desconectado"}</p>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:"8px"}}>
                      {!conectado && (
                        <button className="btn-primary" style={{padding:"6px 12px",fontSize:"12px",cursor:"pointer"}}
                          onClick={()=>gerarQR(nome)}>
                          QR Code
                        </button>
                      )}
                      <button className="btn-danger" style={{padding:"6px 10px",fontSize:"12px",cursor:"pointer"}}
                        onClick={()=>deletarInstancia(nome)}>
                        <Trash2 size={12}/>
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* QR Code */}
              {qrCode && qrInstancia && (
                <div style={{
                  background:"#1a1a1a",border:"1px solid rgba(41,171,226,0.3)",
                  borderRadius:"10px",padding:"20px",textAlign:"center",marginTop:"12px",
                }}>
                  <p style={{fontSize:"13px",fontWeight:"600",color:"#f0f0f0",marginBottom:"4px"}}>
                    Conectar: <span style={{color:"#29ABE2"}}>{qrInstancia}</span>
                  </p>
                  <p style={{fontSize:"12px",color:"#606060",marginBottom:"16px"}}>
                    Abra o WhatsApp → Aparelhos conectados → Conectar aparelho → Escaneie o QR Code
                  </p>
                  {qrCode.startsWith("data:image") ? (
                    <img src={qrCode} alt="QR Code" style={{width:"200px",height:"200px",borderRadius:"8px"}}/>
                  ) : (
                    <div style={{background:"#fff",padding:"16px",borderRadius:"8px",display:"inline-block"}}>
                      <p style={{fontSize:"11px",color:"#000",fontFamily:"monospace",wordBreak:"break-all",maxWidth:"200px"}}>
                        {qrCode.replace("qr:","")}
                      </p>
                    </div>
                  )}
                  <div style={{marginTop:"12px"}}>
                    <button className="btn-secondary" style={{cursor:"pointer"}} onClick={()=>{setQrCode(null);carregarInstancias();}}>
                      <RefreshCw size={13}/> Já conectei
                    </button>
                  </div>
                </div>
              )}

              {/* Nova instância */}
              <div style={{
                marginTop:"16px",padding:"16px",background:"#1a1a1a",
                border:"1px dashed #3a3a3a",borderRadius:"8px",
              }}>
                <p style={{fontSize:"13px",fontWeight:"600",color:"#f0f0f0",marginBottom:"12px"}}>
                  <Plus size={13} style={{marginRight:"6px",verticalAlign:"middle"}}/>
                  Nova instância
                </p>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"8px"}}>
                  <input className="form-input" placeholder="Nome (ex: salxdigital)"
                    value={novaInstancia} onChange={e=>setNovaInstancia(e.target.value)}/>
                  <input className="form-input" placeholder="Token (opcional)"
                    value={novoToken} onChange={e=>setNovoToken(e.target.value)}/>
                </div>
                <button className="btn-primary" onClick={criarInstancia} disabled={criandoInst} style={{cursor:"pointer"}}>
                  <Plus size={13}/> {criandoInst?"Criando...":"Criar e gerar QR Code"}
                </button>
              </div>
            </div>
          </div>
        )}

        {waTab==="cobrancas" && (
          <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>
            <div className="form-group">
              <label className="form-label">Mensagem de cobrança</label>
              <textarea className="form-input" rows={8} value={cobrancaMsg}
                onChange={e=>setCobrancaMsg(e.target.value)}
                style={{resize:"vertical",fontFamily:"monospace",fontSize:"13px"}}/>
              <p style={{fontSize:"11px",color:"#606060",marginTop:"4px"}}>
                Placeholders: NOME_CLIENTE, VALOR, DATA_VENCIMENTO, CATEGORIA
              </p>
            </div>
            <div style={{display:"flex",justifyContent:"flex-end"}}>
              <button className="btn-primary" style={{cursor:"pointer"}}><Check size={14}/> Salvar</button>
            </div>
          </div>
        )}

        {waTab==="api" && (
          <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>
            <div style={{background:"rgba(41,171,226,0.06)",border:"1px solid rgba(41,171,226,0.2)",borderRadius:"8px",padding:"12px 16px",fontSize:"13px",color:"#a0a0a0"}}>
              Use o endpoint abaixo para receber leads de formulários externos.
            </div>
            <div className="form-group">
              <label className="form-label">Endpoint Leads</label>
              <input className="form-input" value={typeof window!=="undefined"?`${window.location.origin}/api/leads/SuaChaveAPI`:""} readOnly
                style={{fontFamily:"monospace",fontSize:"12px",color:"#29ABE2"}}
                onClick={e=>(e.target as HTMLInputElement).select()}/>
            </div>
          </div>
        )}
      </div>

      {/* Meta Ads */}
      <div className="card" style={{marginBottom:"20px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"4px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
            <div style={{width:"10px",height:"10px",borderRadius:"50%",background:metaAtivo?"#29ABE2":"#ef4444"}}/>
            <Target size={18} color="#1877f2"/>
            <h2 style={{fontSize:"16px",fontWeight:"600"}}>Meta Ads</h2>
          </div>
          <label style={{display:"flex",alignItems:"center",gap:"8px",cursor:"pointer",fontSize:"13px",color:"#a0a0a0"}}>
            <input type="checkbox" checked={metaAtivo} onChange={e=>setMetaAtivo(e.target.checked)} style={{width:"14px",height:"14px"}}/>
            {metaAtivo?"Ativo":"Inativo"}
          </label>
        </div>
        <p style={{fontSize:"13px",color:"#606060",marginBottom:"20px"}}>Pixel e Conversions API para rastrear e otimizar campanhas</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"16px",marginBottom:"16px"}}>
          <div className="form-group">
            <label className="form-label">Pixel ID</label>
            <input className="form-input" placeholder="1234567890123456" value={pixelId} onChange={e=>setPixelId(e.target.value)}/>
          </div>
          <div className="form-group">
            <label className="form-label">Access Token (Conversions API)</label>
            <div style={{position:"relative"}}>
              <input className="form-input" placeholder="EAAxxxxxxx..." type={showMetaToken?"text":"password"}
                value={metaToken} onChange={e=>setMetaToken(e.target.value)} style={{paddingRight:"40px"}}/>
              <button onClick={()=>setShowMetaToken(!showMetaToken)} style={{position:"absolute",right:"10px",top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#606060"}}>
                {showMetaToken?<EyeOff size={14}/>:<Eye size={14}/>}
              </button>
            </div>
          </div>
        </div>
        {/* Seção Gerenciador de Anúncios */}
        <div style={{borderTop:"1px solid #2e2e2e",paddingTop:"16px",marginTop:"4px",marginBottom:"16px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"12px"}}>
            <div>
              <p style={{fontSize:"14px",fontWeight:"600",color:"#f0f0f0",margin:0}}>Gerenciador de Anúncios</p>
              <p style={{fontSize:"12px",color:"#606060",margin:0}}>Para filtrar conversas por campanha e conjunto de anúncios</p>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
              <div style={{width:"8px",height:"8px",borderRadius:"50%",background:metaAdsAtivo?"#29ABE2":"#ef4444"}}/>
              <span style={{fontSize:"12px",color:metaAdsAtivo?"#29ABE2":"#ef4444"}}>{metaAdsAtivo?"Ativo":"Inativo"}</span>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"16px"}}>
            <div className="form-group">
              <label className="form-label">Ad Account ID</label>
              <input className="form-input" placeholder="act_1234567890" value={metaAdAccountId} onChange={e=>setMetaAdAccountId(e.target.value)}/>
              <p style={{fontSize:"11px",color:"#606060",marginTop:"4px"}}>Encontre em Gerenciador de Anúncios → URL da conta</p>
            </div>
            <div className="form-group">
              <label className="form-label">Token do Gerenciador de Negócios</label>
              <div style={{position:"relative"}}>
                <input className="form-input" placeholder="EAAxxxxxxx..." type={showBusinessToken?"text":"password"}
                  value={metaBusinessToken} onChange={e=>setMetaBusinessToken(e.target.value)} style={{paddingRight:"40px"}}/>
                <button onClick={()=>setShowBusinessToken(!showBusinessToken)} style={{position:"absolute",right:"10px",top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#606060"}}>
                  {showBusinessToken?<EyeOff size={14}/>:<Eye size={14}/>}
                </button>
              </div>
              <p style={{fontSize:"11px",color:"#606060",marginTop:"4px"}}>Token com permissão ads_read no Meta Business</p>
            </div>
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end"}}>
          <button className="btn-primary" onClick={salvarMeta} style={{cursor:"pointer"}}><Check size={14}/> Salvar Meta</button>
        </div>
      </div>

      {/* OpenAI */}
      <div className="card" style={{marginBottom:"20px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
            <div style={{width:"10px",height:"10px",borderRadius:"50%",background:openaiAtivo?"#29ABE2":"#ef4444"}}/>
            <Bot size={18} color="#a0a0a0"/>
            <h2 style={{fontSize:"16px",fontWeight:"600"}}>OpenAI</h2>
          </div>
          <label style={{display:"flex",alignItems:"center",gap:"8px",cursor:"pointer",fontSize:"13px",color:"#a0a0a0"}}>
            <input type="checkbox" checked={openaiAtivo} onChange={e=>setOpenaiAtivo(e.target.checked)} style={{width:"14px",height:"14px"}}/>
            {openaiAtivo?"Ativo":"Inativo"}
          </label>
        </div>
        <div className="form-group" style={{marginBottom:"16px"}}>
          <label className="form-label">API Key</label>
          <input className="form-input" placeholder="sk-..." type="password" value={openaiKey} onChange={e=>setOpenaiKey(e.target.value)}/>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end"}}>
          <button className="btn-primary" onClick={salvarOpenAI} style={{cursor:"pointer"}}><Check size={14}/> Salvar</button>
        </div>
      </div>

      {/* Asaas */}
      <div className="card">
        <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"16px"}}>
          <div style={{width:"10px",height:"10px",borderRadius:"50%",background:"#ef4444"}}/>
          <CreditCard size={18} color="#a0a0a0"/>
          <h2 style={{fontSize:"16px",fontWeight:"600"}}>Asaas</h2>
        </div>
        <div className="form-group" style={{marginBottom:"16px"}}>
          <label className="form-label">Token API</label>
          <input className="form-input" placeholder="Token do Asaas" type="password" value={asaasToken} onChange={e=>setAsaasToken(e.target.value)}/>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end"}}>
          <button className="btn-primary" onClick={salvarAsaas} style={{cursor:"pointer"}}><Check size={14}/> Salvar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Wrapper: escolhe versão master ou cliente ───────────────
export default function IntegracoesPage() {
  const [isFilha, setIsFilha] = useState<boolean | null>(null);

  useEffect(() => {
    async function check() {
      const agId = await getAgenciaId();
      if (!agId) { setIsFilha(false); return; }
      const { data } = await supabase.from("agencias").select("parent_id").eq("id", agId).single();
      setIsFilha(!!data?.parent_id);
    }
    check();
  }, []);

  if (isFilha === null) return (
    <div style={{ display: "flex", justifyContent: "center", padding: "60px" }}>
      <div style={{ width: "32px", height: "32px", borderRadius: "50%", border: "3px solid #2e2e2e", borderTop: "3px solid #29ABE2", animation: "spin 1s linear infinite" }} />
    </div>
  );

  return isFilha ? <IntegracoesCliente /> : <IntegracoesMaster />;
}
