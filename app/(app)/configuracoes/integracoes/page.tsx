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

export default function IntegracoesPage() {
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
      await supabase.from("agencias").update({ meta_pixel_id: pixelId, meta_token: metaToken, meta_ativo: metaAtivo }).eq("id", agId!);
      alert("Meta Ads salvo!");
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
          <MessageCircle size={20} color="#22c55e"/>
          <h2 style={{fontSize:"16px",fontWeight:"600"}}>WhatsApp</h2>
        </div>

        <div style={{borderBottom:"1px solid #2e2e2e",marginBottom:"24px"}}>
          {(["conexao","cobrancas","api"] as const).map(tab=>(
            <button key={tab} onClick={()=>setWaTab(tab)} style={{
              padding:"8px 20px",background:"none",border:"none",cursor:"pointer",
              fontSize:"13px",fontWeight:"500",
              color:waTab===tab?"#f0f0f0":"#606060",
              borderBottom:waTab===tab?"2px solid #22c55e":"2px solid transparent",
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
                    padding:"12px 16px",background:"#1a1a1a",border:`1px solid ${conectado?"rgba(34,197,94,0.3)":"#2e2e2e"}`,
                    borderRadius:"8px",marginBottom:"8px",
                  }}>
                    <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                      {inst.profilePicUrl ? (
                        <img src={inst.profilePicUrl} alt="" style={{width:"36px",height:"36px",borderRadius:"50%",objectFit:"cover"}}/>
                      ) : (
                        conectado
                          ? <Wifi size={16} style={{color:"#22c55e"}}/>
                          : <WifiOff size={16} style={{color:"#ef4444"}}/>
                      )}
                      <div>
                        <p style={{fontSize:"13px",fontWeight:"600",color:"#f0f0f0"}}>{inst.profileName || nome}</p>
                        <p style={{fontSize:"11px",color:"#606060"}}>{nome}</p>
                        <p style={{fontSize:"11px",color:conectado?"#22c55e":"#ef4444",textTransform:"capitalize"}}>{conectado?"● Conectado":"● Desconectado"}</p>
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
                  background:"#1a1a1a",border:"1px solid rgba(34,197,94,0.3)",
                  borderRadius:"10px",padding:"20px",textAlign:"center",marginTop:"12px",
                }}>
                  <p style={{fontSize:"13px",fontWeight:"600",color:"#f0f0f0",marginBottom:"4px"}}>
                    Conectar: <span style={{color:"#22c55e"}}>{qrInstancia}</span>
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
            <div style={{background:"rgba(34,197,94,0.06)",border:"1px solid rgba(34,197,94,0.2)",borderRadius:"8px",padding:"12px 16px",fontSize:"13px",color:"#a0a0a0"}}>
              Use o endpoint abaixo para receber leads de formulários externos.
            </div>
            <div className="form-group">
              <label className="form-label">Endpoint Leads</label>
              <input className="form-input" value={typeof window!=="undefined"?`${window.location.origin}/api/leads/SuaChaveAPI`:""} readOnly
                style={{fontFamily:"monospace",fontSize:"12px",color:"#22c55e"}}
                onClick={e=>(e.target as HTMLInputElement).select()}/>
            </div>
          </div>
        )}
      </div>

      {/* Meta Ads */}
      <div className="card" style={{marginBottom:"20px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"4px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
            <div style={{width:"10px",height:"10px",borderRadius:"50%",background:metaAtivo?"#22c55e":"#ef4444"}}/>
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
        <div style={{display:"flex",justifyContent:"flex-end"}}>
          <button className="btn-primary" onClick={salvarMeta} style={{cursor:"pointer"}}><Check size={14}/> Salvar Meta</button>
        </div>
      </div>

      {/* OpenAI */}
      <div className="card" style={{marginBottom:"20px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
            <div style={{width:"10px",height:"10px",borderRadius:"50%",background:openaiAtivo?"#22c55e":"#ef4444"}}/>
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
