"use client";

import { useState, useEffect, useRef } from "react";
import { Search, RefreshCw, Eye, Send, X, Filter, MessageCircle, ChevronDown, UserPlus, Upload } from "lucide-react";
import { supabase, getAgenciaId } from "@/lib/hooks";

interface Conversa {
  id: string; contato_numero: string; contato_nome: string; contato_foto?: string;
  contato_jid?: string; ultima_mensagem: string; ultima_mensagem_at: string;
  primeira_mensagem_at?: string; etapa_alterada_at?: string; nao_lidas: number;
  origem?: string; etapa_jornada?: string; utm_source?: string; utm_medium?: string;
  utm_campaign?: string; utm_content?: string; link_nome?: string; fbclid?: string;
  nome_anuncio?: string; created_at: string;
}
interface Mensagem {
  id: string; de_mim: boolean; tipo: string; conteudo: string;
  mensagem_id: string; created_at: string;
}
interface EtapaJornada {
  id: string; nome: string; evento_conversao?: string; ordem: number;
}

const CORES_ETAPA: Record<string,string> = {
  "Fez Contato": "#606060",
  "Entrou em contato": "#606060",
  "Qualificado": "#29ABE2",
  "Agendou": "#f59e0b",
  "Compareceu": "#8b5cf6",
  "Fechou": "#22c55e",
  "Comprou": "#22c55e",
  "Perdido": "#ef4444",
};

function getCorEtapa(etapa?: string) {
  if (!etapa) return "#606060";
  return CORES_ETAPA[etapa] || "#29ABE2";
}

function formatarNumero(n: string) {
  const d = (n||"").replace(/\D/g,"");
  if (d.startsWith("55") && d.length===13) return `(${d.slice(2,4)}) ${d.slice(4,9)}-${d.slice(9)}`;
  if (d.startsWith("55") && d.length===12) return `(${d.slice(2,4)}) ${d.slice(4,8)}-${d.slice(8)}`;
  return n;
}

function formatarData(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"});
}

function Avatar({ nome, foto, size=32 }: { nome: string; foto?: string; size?: number }) {
  const cores = ["#29ABE2","#3b82f6","#8b5cf6","#f59e0b","#ec4899","#06b6d4","#ef4444"];
  const cor = cores[(nome||"").charCodeAt(0) % cores.length];
  if (foto) return <img src={foto} alt={nome} style={{ width:size, height:size, borderRadius:"50%", objectFit:"cover", flexShrink:0 }}/>;
  return <div style={{ width:size, height:size, borderRadius:"50%", background:cor, display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.38, fontWeight:"700", color:"#fff", flexShrink:0 }}>{(nome||"?").charAt(0).toUpperCase()}</div>;
}

function OrigemBadge({ origem }: { origem?: string }) {
  if (!origem || origem==="Não Rastreada") return <span style={{ fontSize:"11px", color:"#505050" }}>Não rastreada</span>;
  if (origem==="Meta Ads") return <span style={{ fontSize:"11px", color:"#1877f2" }}>🔷 Meta Ads</span>;
  if (origem==="Google Ads") return <span style={{ fontSize:"11px", color:"#ea4335" }}>🔺 Google Ads</span>;
  return <span style={{ fontSize:"11px", color:"#a0a0a0" }}>🌐 {origem}</span>;
}

function EtapaBadge({ etapa }: { etapa?: string }) {
  const label = etapa || "Fez Contato";
  const cor = getCorEtapa(label);
  return (
    <span style={{ fontSize:"11px", padding:"2px 8px", borderRadius:"20px", background:`${cor}18`, color:cor, border:`1px solid ${cor}30`, whiteSpace:"nowrap" }}>
      {label}
    </span>
  );
}

// Modal de detalhes
function DetalhesModal({ conversa, onClose, onEtapaChange, onConversaUpdate, etapas }: { conversa: Conversa; onClose:()=>void; onEtapaChange:(e:string)=>void; onConversaUpdate:(c:Partial<Conversa>)=>void; etapas: EtapaJornada[] }) {
  const [etapa, setEtapa] = useState(conversa.etapa_jornada || "");
  const [salvando, setSalvando] = useState(false);
  const [chatAberto, setChatAberto] = useState(false);
  const [editando, setEditando] = useState(false);
  const [historico, setHistorico] = useState<{etapa_anterior:string|null;etapa_nova:string;alterado_por:string;created_at:string}[]>([]);
  const [editDados, setEditDados] = useState({
    origem: conversa.origem || "Não Rastreada",
    utm_source: conversa.utm_source || "",
    utm_medium: conversa.utm_medium || "",
    utm_campaign: conversa.utm_campaign || "",
    utm_content: conversa.utm_content || "",
    link_nome: conversa.link_nome || "",
    fbclid: conversa.fbclid || "",
  });
  const [salvandoRastreio, setSalvandoRastreio] = useState(false);

  // Carregar histórico de transições
  useEffect(() => {
    supabase.from("etapas_historico")
      .select("etapa_anterior, etapa_nova, alterado_por, created_at")
      .eq("conversa_id", conversa.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => setHistorico(data || []));
  }, [conversa.id, etapa]);

  const salvarEtapa = async (novaEtapa: string) => {
    setSalvando(true);
    const etapaAnterior = etapa;
    setEtapa(novaEtapa);
    await supabase.from("conversas").update({ etapa_jornada: novaEtapa, etapa_alterada_at: new Date().toISOString() }).eq("id", conversa.id);
    onEtapaChange(novaEtapa);
    const agId = await getAgenciaId();
    // Registrar histórico de transição
    await supabase.from("etapas_historico").insert({
      conversa_id: conversa.id, agencia_id: agId,
      etapa_anterior: etapaAnterior || null, etapa_nova: novaEtapa, alterado_por: "manual",
    });
    // Disparar conversão no Meta CAPI
    try {
      const pixelRes = await fetch("/api/pixel", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ agencia_id:agId, conversa_id:conversa.id, etapa_nome:novaEtapa, phone:conversa.contato_numero, fbclid:editDados.fbclid||conversa.fbclid, utm_campaign:editDados.utm_campaign||conversa.utm_campaign, utm_content:editDados.utm_content||conversa.utm_content }),
      });
      const pixelData = await pixelRes.json();
      if (!pixelData.ok) console.warn("Pixel:", pixelData.motivo || pixelData.error);
    } catch(e) { console.error("Pixel erro:", e); }
    setSalvando(false);
  };

  const salvarRastreio = async () => {
    setSalvandoRastreio(true);
    const updates: any = {
      origem: editDados.origem,
      utm_source: editDados.utm_source || null,
      utm_medium: editDados.utm_medium || null,
      utm_campaign: editDados.utm_campaign || null,
      utm_content: editDados.utm_content || null,
      link_nome: editDados.link_nome || null,
      fbclid: editDados.fbclid || null,
    };
    await supabase.from("conversas").update(updates).eq("id", conversa.id);
    onConversaUpdate(updates);
    setEditando(false);
    setSalvandoRastreio(false);
  };

  const inputStyle = { background:"#222", border:"1px solid #333", borderRadius:"6px", padding:"5px 8px", color:"#f0f0f0", fontSize:"12px", width:"100%" };

  const camposVisuais = [
    { label:"Origem", value:<OrigemBadge origem={editDados.origem}/> },
    { label:"Etapa da Jornada", value:<EtapaBadge etapa={etapa}/> },
    { label:"Nome do Link", value: editDados.link_nome || "—" },
    { label:"Campanha (utm_source)", value: editDados.utm_source || "—" },
    { label:"Meio (utm_medium)", value: editDados.utm_medium || "—" },
    { label:"Campanha", value: editDados.utm_campaign || "—" },
    { label:"Conjunto de Anúncio", value: editDados.utm_content ? editDados.utm_content.split("_")[0].trim() : "—" },
    { label:"Nome do Anúncio", value: (conversa as any).nome_anuncio || (editDados.utm_content && editDados.utm_content.includes("_") ? editDados.utm_content.split("_").slice(1).join("_").trim() : "—") },
    { label:"Primeira Mensagem", value: formatarData(conversa.primeira_mensagem_at || conversa.created_at) },
    { label:"Última Alteração Etapa", value: formatarData(conversa.etapa_alterada_at || "") },
    ...(editDados.fbclid ? [{ label:"fbclid", value: editDados.fbclid.substring(0,40)+"..." }] : []),
  ];

  return (
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:100 }}/>
      <div style={{ position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)", width:"560px", maxHeight:"85vh", overflowY:"auto", background:"#141414", border:"1px solid #2e2e2e", borderRadius:"12px", zIndex:101, padding:"20px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
            <Avatar nome={conversa.contato_nome||conversa.contato_numero} foto={conversa.contato_foto} size={40}/>
            <div>
              <p style={{ fontSize:"15px", fontWeight:"600", color:"#f0f0f0", margin:0 }}>{conversa.contato_nome||"—"}</p>
              <p style={{ fontSize:"12px", color:"#606060", margin:0 }}>{formatarNumero(conversa.contato_numero)}</p>
            </div>
          </div>
          <div style={{ display:"flex", gap:"8px" }}>
            <button onClick={()=>setChatAberto(true)} className="btn-secondary" style={{ fontSize:"12px", cursor:"pointer" }}><MessageCircle size={13}/> Chat</button>
            <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"#606060" }}><X size={16}/></button>
          </div>
        </div>

        {/* Rastreamento */}
        <div style={{ background:"#1a1a1a", borderRadius:"8px", padding:"14px", marginBottom:"16px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"10px" }}>
            <p style={{ fontSize:"12px", fontWeight:"600", color:"#606060", margin:0 }}>INFORMAÇÕES DE RASTREAMENTO</p>
            {!editando ? (
              <button onClick={()=>setEditando(true)} style={{ fontSize:"11px", color:"#29ABE2", background:"none", border:"1px solid rgba(41,171,226,0.3)", borderRadius:"6px", padding:"3px 10px", cursor:"pointer" }}>Editar</button>
            ) : (
              <div style={{ display:"flex", gap:"6px" }}>
                <button onClick={()=>setEditando(false)} style={{ fontSize:"11px", color:"#606060", background:"none", border:"1px solid #2e2e2e", borderRadius:"6px", padding:"3px 10px", cursor:"pointer" }}>Cancelar</button>
                <button onClick={salvarRastreio} disabled={salvandoRastreio} style={{ fontSize:"11px", color:"#000", background:"#29ABE2", border:"none", borderRadius:"6px", padding:"3px 10px", cursor:"pointer", fontWeight:"600" }}>{salvandoRastreio?"Salvando...":"Salvar"}</button>
              </div>
            )}
          </div>

          {editando ? (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px" }}>
              <div>
                <p style={{ fontSize:"10px", color:"#505050", margin:"0 0 4px" }}>Origem</p>
                <select value={editDados.origem} onChange={e=>setEditDados(d=>({...d,origem:e.target.value}))}
                  style={{ ...inputStyle, cursor:"pointer" }}>
                  <option value="Meta Ads">Meta Ads</option>
                  <option value="Google Ads">Google Ads</option>
                  <option value="Outras Origens">Outras Origens</option>
                  <option value="Não Rastreada">Não Rastreada</option>
                </select>
              </div>
              <div>
                <p style={{ fontSize:"10px", color:"#505050", margin:"0 0 4px" }}>Nome do Link</p>
                <input value={editDados.link_nome} onChange={e=>setEditDados(d=>({...d,link_nome:e.target.value}))} style={inputStyle} placeholder="Ex: Link Instagram"/>
              </div>
              <div>
                <p style={{ fontSize:"10px", color:"#505050", margin:"0 0 4px" }}>utm_source</p>
                <input value={editDados.utm_source} onChange={e=>setEditDados(d=>({...d,utm_source:e.target.value}))} style={inputStyle} placeholder="Ex: facebook"/>
              </div>
              <div>
                <p style={{ fontSize:"10px", color:"#505050", margin:"0 0 4px" }}>utm_medium</p>
                <input value={editDados.utm_medium} onChange={e=>setEditDados(d=>({...d,utm_medium:e.target.value}))} style={inputStyle} placeholder="Ex: cpc"/>
              </div>
              <div>
                <p style={{ fontSize:"10px", color:"#505050", margin:"0 0 4px" }}>Campanha (utm_campaign)</p>
                <input value={editDados.utm_campaign} onChange={e=>setEditDados(d=>({...d,utm_campaign:e.target.value}))} style={inputStyle} placeholder="Ex: campanha-vendas"/>
              </div>
              <div>
                <p style={{ fontSize:"10px", color:"#505050", margin:"0 0 4px" }}>Conjunto/Anúncio (utm_content)</p>
                <input value={editDados.utm_content} onChange={e=>setEditDados(d=>({...d,utm_content:e.target.value}))} style={inputStyle} placeholder="Ex: conjunto_anuncio"/>
              </div>
              <div style={{ gridColumn:"1 / -1" }}>
                <p style={{ fontSize:"10px", color:"#505050", margin:"0 0 4px" }}>fbclid</p>
                <input value={editDados.fbclid} onChange={e=>setEditDados(d=>({...d,fbclid:e.target.value}))} style={inputStyle} placeholder="Ex: abc123..."/>
              </div>
            </div>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px" }}>
              {camposVisuais.map(c => (
                <div key={c.label}>
                  <p style={{ fontSize:"10px", color:"#505050", margin:"0 0 2px" }}>{c.label}</p>
                  <div style={{ fontSize:"12px", color:"#f0f0f0" }}>{c.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Etapas da jornada */}
        <div>
          <p style={{ fontSize:"12px", fontWeight:"600", color:"#606060", marginBottom:"10px" }}>ETAPA DA JORNADA</p>
          <div style={{ display:"flex", flexWrap:"wrap", gap:"8px" }}>
            {etapas.map(e => {
              const cor = getCorEtapa(e.nome);
              const ativa = etapa === e.nome;
              return (
                <button key={e.id} onClick={()=>salvarEtapa(e.nome)} style={{
                  padding:"6px 14px", borderRadius:"20px", border:`1px solid ${ativa?cor:"#2e2e2e"}`,
                  background:ativa?`${cor}20`:"transparent", color:ativa?cor:"#606060",
                  cursor:"pointer", fontSize:"12px", fontWeight:ativa?"600":"400",
                }}>
                  {e.nome}
                  {e.evento_conversao && <span style={{ fontSize:"10px", marginLeft:"4px", opacity:0.7 }}>({e.evento_conversao})</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Histórico de transições */}
        {historico.length > 0 && (
          <div style={{ marginTop:"16px" }}>
            <p style={{ fontSize:"12px", fontWeight:"600", color:"#606060", marginBottom:"10px" }}>HISTÓRICO DE TRANSIÇÕES</p>
            <div style={{ background:"#1a1a1a", borderRadius:"8px", padding:"12px" }}>
              {historico.map((h, i) => {
                const data = new Date(h.created_at);
                const dataStr = data.toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", year:"2-digit", hour:"2-digit", minute:"2-digit" });
                const corNova = getCorEtapa(h.etapa_nova);
                return (
                  <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:"10px", paddingBottom: i < historico.length - 1 ? "10px" : "0", marginBottom: i < historico.length - 1 ? "10px" : "0", borderBottom: i < historico.length - 1 ? "1px solid #2e2e2e" : "none" }}>
                    <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:corNova, marginTop:"4px", flexShrink:0 }}/>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:"6px", flexWrap:"wrap" }}>
                        {h.etapa_anterior && (
                          <>
                            <span style={{ fontSize:"12px", color:"#606060" }}>{h.etapa_anterior}</span>
                            <span style={{ fontSize:"10px", color:"#404040" }}>→</span>
                          </>
                        )}
                        <span style={{ fontSize:"12px", fontWeight:"600", color:corNova }}>{h.etapa_nova}</span>
                      </div>
                      <div style={{ display:"flex", gap:"8px", marginTop:"2px" }}>
                        <span style={{ fontSize:"10px", color:"#505050" }}>{dataStr}</span>
                        <span style={{ fontSize:"10px", color:"#404040" }}>{h.alterado_por === "automatico" ? "via termo-chave" : "manual"}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {chatAberto && <ChatLateral conversa={conversa} onClose={()=>setChatAberto(false)}/>}
    </>
  );
}

// Chat lateral
function ChatLateral({ conversa, onClose }: { conversa: Conversa; onClose:()=>void }) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const carregar = async () => {
    const { data } = await supabase.from("mensagens").select("*")
      .eq("conversa_id", conversa.id).order("created_at",{ascending:true});
    setMensagens(data||[]);
    setTimeout(()=>endRef.current?.scrollIntoView({behavior:"smooth"}),50);
  };

  const enviar = async () => {
    if (!texto.trim()||enviando) return;
    setEnviando(true);
    try {
      const agId = await getAgenciaId();
      const { data: ag } = await supabase.from("agencias").select("evolution_url,evolution_key,whatsapp_instancia").eq("id",agId!).single();
      if (!ag) return;
      const jid = conversa.contato_jid || `${conversa.contato_numero}@s.whatsapp.net`;
      await fetch(`${ag.evolution_url}/message/sendText/${ag.whatsapp_instancia}`,{
        method:"POST", headers:{"apikey":ag.evolution_key,"Content-Type":"application/json"},
        body:JSON.stringify({number:jid,text:texto}),
      });
      setTexto("");
      setTimeout(carregar,500);
    } finally { setEnviando(false); }
  };

  useEffect(()=>{carregar();},[conversa.id]);

  return (
    <>
      <div onClick={onClose} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.3)",zIndex:150 }}/>
      <div style={{ position:"fixed",right:0,top:0,bottom:0,width:"400px",background:"#141414",borderLeft:"1px solid #2e2e2e",zIndex:151,display:"flex",flexDirection:"column" }}>
        <div style={{ padding:"12px 16px",borderBottom:"1px solid #2e2e2e",display:"flex",alignItems:"center",gap:"10px",background:"#1a1a1a" }}>
          <Avatar nome={conversa.contato_nome||conversa.contato_numero} foto={conversa.contato_foto} size={32}/>
          <div style={{ flex:1 }}>
            <p style={{ fontSize:"13px",fontWeight:"600",color:"#f0f0f0",margin:0 }}>{conversa.contato_nome||"—"}</p>
            <p style={{ fontSize:"11px",color:"#606060",margin:0 }}>{formatarNumero(conversa.contato_numero)}</p>
          </div>
          <button onClick={onClose} style={{ background:"none",border:"none",cursor:"pointer",color:"#606060" }}><X size={16}/></button>
        </div>
        <div style={{ flex:1,overflowY:"auto",padding:"12px",display:"flex",flexDirection:"column",gap:"8px" }}>
          {mensagens.map(m=>(
            <div key={m.id} style={{ display:"flex",justifyContent:m.de_mim?"flex-end":"flex-start" }}>
              <div style={{ maxWidth:"80%",background:m.de_mim?"#29ABE2":"#1e1e1e",borderRadius:m.de_mim?"12px 12px 2px 12px":"12px 12px 12px 2px",padding:"8px 12px" }}>
                <p style={{ fontSize:"13px",color:m.de_mim?"#000":"#f0f0f0",margin:0,whiteSpace:"pre-wrap" }}>{m.conteudo}</p>
                <p style={{ fontSize:"10px",color:m.de_mim?"rgba(0,0,0,0.5)":"#606060",margin:"3px 0 0",textAlign:"right" }}>
                  {new Date(m.created_at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}
                </p>
              </div>
            </div>
          ))}
          <div ref={endRef}/>
        </div>
        <div style={{ padding:"10px 12px",borderTop:"1px solid #2e2e2e",background:"#1a1a1a",display:"flex",gap:"8px" }}>
          <input className="form-input" placeholder="Mensagem..." value={texto}
            onChange={e=>setTexto(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();enviar();}}}
            style={{ flex:1,margin:0 }}/>
          <button onClick={enviar} disabled={enviando||!texto.trim()} style={{ background:"#29ABE2",border:"none",borderRadius:"8px",padding:"8px 12px",cursor:"pointer",color:"#000",flexShrink:0 }}>
            <Send size={14}/>
          </button>
        </div>
      </div>
    </>
  );
}

// Painel de filtros avançados
function FiltrosAvancados({ conversas, filtros, onChange, onClose }: { conversas: Conversa[]; filtros: any; onChange:(f:any)=>void; onClose:()=>void }) {
  const [local, setLocal] = useState(filtros);
  const set = (k: string, v: string) => setLocal((f: any) => ({ ...f, [k]: v }));

  // Valores únicos do banco local
  const uniq = (arr: (string|undefined)[]) => Array.from(new Set(arr.filter(Boolean) as string[])).sort();
  const links = uniq(conversas.map(c=>c.link_nome));
  const sources = uniq(conversas.map(c=>c.utm_source));
  const mediums = uniq(conversas.map(c=>c.utm_medium));

  // Campanhas/Conjuntos/Criativos — puxar do Meta Ads + fallback local
  const [campanhas, setCampanhas] = useState<string[]>([]);
  const [conjuntos, setConjuntos] = useState<string[]>([]);
  const [anuncios, setAnuncios] = useState<string[]>([]);

  useEffect(() => {
    async function loadAds() {
      const agId = await getAgenciaId();
      if (!agId) return;
      const { data: ag } = await supabase.from("agencias").select("meta_business_token, meta_ad_account_id").eq("id", agId).single();

      if (ag?.meta_business_token && ag?.meta_ad_account_id) {
        try {
          // Campanhas da conta
          const resCamp = await fetch("/api/meta-ads", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "campanhas", token: ag.meta_business_token, adAccountId: ag.meta_ad_account_id }),
          });
          const campData = await resCamp.json();
          if (Array.isArray(campData)) setCampanhas(campData.map((c: any) => c.name).filter(Boolean).sort());

          // Criativos
          const resCri = await fetch("/api/meta-ads", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "criativos", token: ag.meta_business_token, adAccountId: ag.meta_ad_account_id }),
          });
          const criData = await resCri.json();
          if (Array.isArray(criData)) setAnuncios(criData.map((c: any) => c.name).filter(Boolean).sort());
        } catch {}
      }

      // Conjuntos: sempre do banco (leads utm_content)
      const { data: leads } = await supabase
        .from("leads").select("utm_campaign, utm_content, utm_term")
        .eq("agencia_id", agId).not("utm_campaign", "is", null);
      if (leads) {
        if (!campanhas.length) setCampanhas(uniq(leads.map(l => l.utm_campaign)));
        setConjuntos(uniq(leads.map(l => l.utm_content)));
        if (!anuncios.length) setAnuncios(uniq(leads.map(l => l.utm_term)));
      }
    }
    loadAds();
  }, []);

  const etapasInbox = [
    { key:"em_contato", label:"Em contato" },
    { key:"reuniao_agendada", label:"Agendou" },
    { key:"nao_compareceu", label:"Não compareceu" },
    { key:"ganho", label:"Comprou" },
    { key:"perdido", label:"Não comprou" },
  ];

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal animate-in" style={{ maxWidth:"560px",maxHeight:"90vh",overflowY:"auto" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"24px" }}>
          <h2 style={{ fontSize:"17px",fontWeight:"600" }}>Filtros Avançados</h2>
          <button onClick={onClose} className="btn-ghost" style={{ padding:"6px",cursor:"pointer" }}><X size={16}/></button>
        </div>

        <div style={{ display:"flex",flexDirection:"column",gap:"18px" }}>
          {/* Origem e Etapa */}
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px" }}>
            <div className="form-group">
              <label className="form-label">Origem</label>
              <select className="form-input" value={local.origem||""} onChange={e=>set("origem",e.target.value)}>
                <option value="">Todas</option>
                <option value="Meta Ads">Meta Ads</option>
                <option value="Google Ads">Google Ads</option>
                <option value="Outras Origens">Outras Origens</option>
                <option value="Não Rastreada">Não Rastreada</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Etapa da Jornada</label>
              <select className="form-input" value={local.etapa||""} onChange={e=>set("etapa",e.target.value)}>
                <option value="">Todas</option>
                {etapasInbox.map(e=><option key={e.key} value={e.key}>{e.label}</option>)}
              </select>
            </div>
          </div>

          {/* Datas */}
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px" }}>
            <div className="form-group">
              <label className="form-label">Data da Primeira Mensagem</label>
              <input className="form-input" type="date" value={local.dataPrimeiraDe||""} onChange={e=>set("dataPrimeiraDe",e.target.value)}/>
            </div>
            <div className="form-group">
              <label className="form-label">Data da Última Alteração de Etapa</label>
              <input className="form-input" type="date" value={local.dataEtapaDe||""} onChange={e=>set("dataEtapaDe",e.target.value)}/>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Data da Última Mensagem</label>
            <input className="form-input" type="date" value={local.dataUltimaDe||""} onChange={e=>set("dataUltimaDe",e.target.value)}/>
          </div>

          {/* UTMs */}
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"12px" }}>
            <div className="form-group">
              <label className="form-label">UTM Source</label>
              <select className="form-input" value={local.utmSource||""} onChange={e=>set("utmSource",e.target.value)}>
                <option value="">Todos</option>
                {sources.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">UTM Medium</label>
              <select className="form-input" value={local.utmMedium||""} onChange={e=>set("utmMedium",e.target.value)}>
                <option value="">Todos</option>
                {mediums.map(m=><option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">UTM Campaign</label>
              <input className="form-input" placeholder="UTM Campaign" value={local.utmCampaign||""} onChange={e=>set("utmCampaign",e.target.value)}/>
            </div>
          </div>

          {/* Link Rastreável */}
          {links.length > 0 && (
            <div className="form-group">
              <label className="form-label">Link Rastreável</label>
              <select className="form-input" value={local.link||""} onChange={e=>set("link",e.target.value)}>
                <option value="">Todos</option>
                {links.map(l=><option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          )}

          {/* Campanha / Conjunto / Criativo */}
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px" }}>
            <div className="form-group">
              <label className="form-label">Campanha de Anúncio</label>
              <select className="form-input" value={local.campanha||""} onChange={e=>set("campanha",e.target.value)}>
                <option value="">Todas</option>
                {campanhas.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Conjunto de Anúncio</label>
              <select className="form-input" value={local.conjunto||""} onChange={e=>set("conjunto",e.target.value)}>
                <option value="">Todos</option>
                {conjuntos.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Criativo</label>
            <select className="form-input" value={local.anuncio||""} onChange={e=>set("anuncio",e.target.value)}>
              <option value="">Todos</option>
              {anuncios.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display:"flex",justifyContent:"space-between",marginTop:"24px" }}>
          <button className="btn-secondary" onClick={onClose} style={{ cursor:"pointer" }}>Fechar</button>
          <button className="btn-primary" onClick={()=>{onChange(local);onClose();}} style={{ cursor:"pointer" }}>Aplicar</button>
        </div>
      </div>
    </div>
  );
}

export default function InboxPage() {
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [etapas, setEtapas] = useState<EtapaJornada[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtros, setFiltros] = useState<any>({});
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [detalhes, setDetalhes] = useState<Conversa|null>(null);
  const [chatDireto, setChatDireto] = useState<Conversa|null>(null);
  const [sincronizandoTudo, setSincronizandoTudo] = useState(false);
  const [autoRastreando, setAutoRastreando] = useState(false);
  const [importandoTintim, setImportandoTintim] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [enviandoCrm, setEnviandoCrm] = useState<Set<string>>(new Set());
  const [enviadosCrm, setEnviadosCrm] = useState<Set<string>>(new Set());

  const mapEtapaCrm = (etapaInbox?: string): string => {
    const mapa: Record<string, string> = {
      "Entrou em contato": "em_contato",
      "Fez Contato": "em_contato",
      "Qualificado": "qualificado",
      "Agendou": "reuniao_agendada",
      "Compareceu": "proposta_enviada",
      "Comprou": "ganho",
      "Fechou": "ganho",
      "Perdido": "novo",
    };
    return mapa[etapaInbox || ""] || "novo";
  };

  const enviarParaCrm = async (c: Conversa) => {
    setEnviandoCrm(prev => new Set(prev).add(c.id));
    try {
      const agId = await getAgenciaId();
      const { error } = await supabase.from("leads").insert({
        agencia_id: agId,
        nome: c.contato_nome || c.contato_numero,
        telefone: c.contato_numero,
        etapa: mapEtapaCrm(c.etapa_jornada),
        utm_source: c.utm_source || undefined,
        utm_medium: c.utm_medium || undefined,
        utm_campaign: c.utm_campaign || undefined,
        utm_content: c.utm_content || undefined,
      });
      if (error) { alert("Erro: " + error.message); return; }
      setEnviadosCrm(prev => new Set(prev).add(c.id));
    } catch (e: any) { alert("Erro ao enviar: " + e.message); }
    finally { setEnviandoCrm(prev => { const s = new Set(prev); s.delete(c.id); return s; }); }
  };

  const carregar = async () => {
    const agId = await getAgenciaId();
    const [{ data: convs }, { data: etps }, { data: leadsExistentes }] = await Promise.all([
      supabase.from("conversas").select("*").eq("agencia_id",agId!).order("ultima_mensagem_at",{ascending:false}),
      supabase.from("jornada_etapas").select("*").eq("agencia_id",agId!).order("ordem"),
      supabase.from("leads").select("telefone").eq("agencia_id",agId!),
    ]);
    setConversas(convs||[]);
    setEtapas(etps||[]);
    // Marcar conversas que já têm lead no CRM (pelo telefone)
    if (convs && leadsExistentes) {
      const telefonesNoCrm = new Set(leadsExistentes.map((l: any) => l.telefone).filter(Boolean));
      const jaNoCrm = new Set<string>();
      for (const c of convs) {
        if (c.contato_numero && telefonesNoCrm.has(c.contato_numero)) {
          jaNoCrm.add(c.id);
        }
      }
      setEnviadosCrm(jaNoCrm);
    }
    setLoading(false);
  };

  const autoRastrear = async () => {
    setAutoRastreando(true);
    try {
      const agId = await getAgenciaId();
      const res = await fetch("/api/rastreamento/auto-detect", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agencia_id: agId }),
      });
      const data = await res.json();
      if (data.rastreados > 0) {
        alert(`${data.rastreados} conversa(s) rastreada(s) automaticamente!`);
        carregar();
      } else {
        alert("Nenhuma conversa foi rastreada. Verifique se há links criados no Gerador de Links.");
      }
    } catch { alert("Erro ao auto-rastrear"); }
    finally { setAutoRastreando(false); }
  };

  const sincronizarTudo = async () => {
    if (!confirm("Vai importar todas as conversas do WhatsApp. Continuar?")) return;
    setSincronizandoTudo(true);
    try {
      const agId = await getAgenciaId();
      // Sync via API local em lotes
      let offset = 0;
      let total = 0;
      let temMais = true;
      while (temMais) {
        const res = await fetch("/api/evolution/sync-all", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agencia_id: agId, offset, lote: 50, com_mensagens: true }),
        });
        const data = await res.json();
        if (!data.ok) { alert("Erro: " + (data.error || "falha no sync")); break; }
        total += data.conversas || 0;
        temMais = data.tem_mais;
        offset = data.proximo_offset;
      }
      alert(`Sincronização concluída! ${total} conversa(s) importada(s).`);
      carregar();
    } catch { alert("Erro ao sincronizar"); }
    finally { setSincronizandoTudo(false); }
  };

  useEffect(()=>{carregar();},[]);
  useEffect(()=>{const i=setInterval(carregar,10000);return()=>clearInterval(i);},[]);

  const filtradas = conversas.filter(c => {
    const matchBusca = c.contato_nome?.toLowerCase().includes(busca.toLowerCase()) || c.contato_numero.includes(busca);
    const f = filtros;
    if (f.origem && f.origem !== "") {
      if (f.origem === "Não Rastreada" && c.origem && c.origem !== "Não Rastreada") return false;
      if (f.origem !== "Não Rastreada" && c.origem !== f.origem) return false;
    }
    if (f.etapas?.length && !f.etapas.includes(c.etapa_jornada)) return false;
    if (f.etapa && c.etapa_jornada !== f.etapa) return false;
    if (f.campanha && c.utm_campaign !== f.campanha) return false;
    if (f.conjunto && c.utm_content !== f.conjunto) return false;
    if (f.link && c.link_nome !== f.link) return false;
    if (f.anuncio && (c as any).nome_anuncio !== f.anuncio) return false;
    if (f.utmSource && c.utm_source !== f.utmSource) return false;
    if (f.utmMedium && c.utm_medium !== f.utmMedium) return false;
    if (f.dataPrimeiraDe) { if (!c.primeira_mensagem_at) return false; if (c.primeira_mensagem_at.slice(0,10) < f.dataPrimeiraDe) return false; }
    if (f.dataPrimeiraAte) { if (!c.primeira_mensagem_at) return false; if (c.primeira_mensagem_at.slice(0,10) > f.dataPrimeiraAte) return false; }
    if (f.dataEtapaDe) { if (!c.etapa_alterada_at) return false; if (c.etapa_alterada_at.slice(0,10) < f.dataEtapaDe) return false; }
    if (f.dataEtapaAte) { if (!c.etapa_alterada_at) return false; if (c.etapa_alterada_at.slice(0,10) > f.dataEtapaAte) return false; }
    if (f.dataUltimaDe && c.ultima_mensagem_at.slice(0,10) < f.dataUltimaDe) return false;
    if (f.dataUltimaAte && c.ultima_mensagem_at.slice(0,10) > f.dataUltimaAte) return false;
    return matchBusca;
  });

  // KPIs baseados nas conversas filtradas
  const base = Object.keys(filtros).some(k => filtros[k]) ? filtradas : conversas;
  const kpis = {
    total: base.length,
    meta: base.filter(c=>c.origem==="Meta Ads").length,
    google: base.filter(c=>c.origem==="Google Ads").length,
    outras: base.filter(c=>c.origem&&c.origem!=="Meta Ads"&&c.origem!=="Google Ads"&&c.origem!=="Não Rastreada").length,
    naoRastreada: base.filter(c=>!c.origem||c.origem==="Não Rastreada").length,
  };

  const filtrosAtivos = Object.values(filtros).filter(Boolean).length;

  // ─── Importar CSV do Tintim ────────────────────────────────
  const importarTintim = async (file: File) => {
    setImportandoTintim(true);
    try {
      const agId = await getAgenciaId();
      const text = await file.text();
      const lines = text.split("\n");
      const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""));

      const col = (name: string) => headers.indexOf(name);
      const iNome = col("Nome do Contato");
      const iWhats = col("WhatsApp do Contato");
      const iEtapa = col("Etapa da Jornada");
      const iDataPrimeira = col("Data da Primeira Mensagem");
      const iDataUltima = col("Data da Última Mensagem");
      const iValor = col("Valor da Última Venda");
      const iOrigem = col("Origem");
      const iCampanha = col("Nome da Campanha de Anúncio");
      const iConjunto = col("Nome do Conjunto de Anúncio");
      const iAnuncio = col("Nome do Anúncio");
      const iUtmSource = col("utm_source");
      const iUtmMedium = col("utm_medium");
      const iUtmCampaign = col("utm_campaign");
      const iUtmContent = col("utm_content");
      const iUtmTerm = col("utm_term");

      const mapEtapa: Record<string, string> = {
        "Fez Contato": "em_contato",
        "Agendou": "reuniao_agendada",
        "Não Compareceu": "nao_compareceu",
        "Comprou": "ganho",
        "Não Comprou": "perdido",
        "Não respondeu": "novo",
      };

      // Parse CSV respeitando aspas
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') { inQuotes = !inQuotes; }
          else if (ch === "," && !inQuotes) { result.push(current.trim()); current = ""; }
          else { current += ch; }
        }
        result.push(current.trim());
        return result;
      }

      let importados = 0;
      let duplicados = 0;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = parseCSVLine(line);

        const telefone = (cols[iWhats] || "").replace(/\D/g, "");
        if (!telefone) continue;

        const nome = cols[iNome] || "";
        const etapaTintim = cols[iEtapa] || "";
        const etapa = mapEtapa[etapaTintim] || "em_contato";
        const origem = cols[iOrigem] || "";
        const dataPrimeira = cols[iDataPrimeira] || "";
        const dataUltima = cols[iDataUltima] || "";
        const valor = parseFloat(cols[iValor] || "0") || 0;
        const campanha = cols[iCampanha] || "";
        const conjunto = cols[iConjunto] || "";
        const anuncio = cols[iAnuncio] || "";
        const utmSource = cols[iUtmSource] || (origem.includes("Meta") ? "facebook" : "");
        const utmMedium = cols[iUtmMedium] || "";
        const utmCampaign = cols[iUtmCampaign] || campanha;
        const utmContent = cols[iUtmContent] || conjunto;
        const utmTerm = cols[iUtmTerm] || anuncio;

        // Verificar duplicata por telefone
        const { data: existe } = await supabase
          .from("leads")
          .select("id")
          .eq("agencia_id", agId!)
          .eq("telefone", telefone)
          .limit(1)
          .maybeSingle();

        if (existe) { duplicados++; continue; }

        await supabase.from("leads").insert({
          agencia_id: agId,
          nome: nome || telefone,
          telefone,
          etapa,
          valor: valor > 0 ? valor : undefined,
          utm_source: utmSource || undefined,
          utm_medium: utmMedium || undefined,
          utm_campaign: utmCampaign || undefined,
          utm_content: utmContent || undefined,
          utm_term: utmTerm || undefined,
          whatsapp: true,
          created_at: dataPrimeira ? new Date(dataPrimeira).toISOString() : new Date().toISOString(),
        });
        importados++;
      }

      alert(`Importação concluída!\n${importados} contatos importados\n${duplicados} duplicados ignorados`);
      carregar();
    } catch (e: any) {
      console.error(e);
      alert("Erro ao importar: " + (e.message || "verifique o formato do CSV"));
    }
    setImportandoTintim(false);
  };

  return (
    <div className="animate-in">
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"20px" }}>
        <div>
          <div className="breadcrumb"><a href="/">Início</a><span>›</span><span className="current">Conversas</span></div>
          <h1 style={{ fontSize:"22px",fontWeight:"600" }}>Conversas</h1>
        </div>
      </div>

      {/* KPIs clicáveis */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:"10px",marginBottom:"20px" }}>
        {[
          {icon:"💬",label:"Total",value:kpis.total,filtro:""},
          {icon:"🔷",label:"Meta Ads",value:kpis.meta,filtro:"Meta Ads"},
          {icon:"🔺",label:"Google Ads",value:kpis.google,filtro:"Google Ads"},
          {icon:"🌐",label:"Outras",value:kpis.outras,filtro:"Outras Origens"},
          {icon:"❌",label:"Não Rastreada",value:kpis.naoRastreada,filtro:"Não Rastreada"},
        ].map(k=>(
          <div key={k.label} className="card" style={{ padding:"12px 14px",cursor:"pointer",borderColor:filtros.origem===k.filtro&&k.filtro?"#29ABE2":"" }}
            onClick={()=>setFiltros((f:any)=>({...f,origem:f.origem===k.filtro?"":k.filtro}))}>
            <div style={{ display:"flex",alignItems:"center",gap:"8px" }}>
              <span style={{ fontSize:"18px" }}>{k.icon}</span>
              <div>
                <p style={{ fontSize:"11px",color:"#606060",margin:0 }}>{k.label}</p>
                <p style={{ fontSize:"22px",fontWeight:"700",color:"#f0f0f0",margin:0,lineHeight:1 }}>{k.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Barra de busca e filtros */}
      <div className="table-wrapper">
        <div style={{ padding:"12px 16px",borderBottom:"1px solid #2e2e2e",display:"flex",gap:"10px",alignItems:"center" }}>
          <div style={{ position:"relative",flex:1 }}>
            <Search size={13} style={{ position:"absolute",left:"10px",top:"50%",transform:"translateY(-50%)",color:"#606060" }}/>
            <input className="search-input" placeholder="Telefone ou nome..." value={busca}
              onChange={e=>setBusca(e.target.value)} style={{ paddingLeft:"32px" }}/>
          </div>
          <button onClick={()=>setFiltrosAbertos(true)} className="btn-secondary" style={{ cursor:"pointer",fontSize:"12px",padding:"7px 12px",position:"relative" }}>
            <Filter size={13}/> Filtros
            {filtrosAtivos > 0 && <span style={{ position:"absolute",top:"-4px",right:"-4px",background:"#29ABE2",color:"#000",fontSize:"9px",fontWeight:"800",borderRadius:"50%",width:"14px",height:"14px",display:"flex",alignItems:"center",justifyContent:"center" }}>{filtrosAtivos}</span>}
          </button>
          {filtrosAtivos > 0 && (
            <button onClick={()=>setFiltros({})} className="btn-ghost" style={{ cursor:"pointer",fontSize:"12px",color:"#ef4444" }}>
              <X size={12}/> Limpar
            </button>
          )}
          <button onClick={carregar} className="btn-ghost" style={{ padding:"8px",cursor:"pointer" }}><RefreshCw size={14}/></button>
          <button onClick={autoRastrear} disabled={autoRastreando} className="btn-secondary" style={{ cursor:"pointer",fontSize:"12px",padding:"7px 12px",borderColor:autoRastreando?"#29ABE2":"" }}>
            <Search size={12} style={{ animation:autoRastreando?"spin 1s linear infinite":"none" }}/>
            {autoRastreando?"Rastreando...":"Auto-rastrear"}
          </button>
          <button onClick={sincronizarTudo} disabled={sincronizandoTudo} className="btn-secondary" style={{ cursor:"pointer",fontSize:"12px",padding:"7px 12px" }}>
            <RefreshCw size={12} style={{ animation:sincronizandoTudo?"spin 1s linear infinite":"none" }}/>
            {sincronizandoTudo?"Importando...":"Importar tudo"}
          </button>
          <input ref={fileInputRef} type="file" accept=".csv" style={{ display: "none" }}
            onChange={e => { if (e.target.files?.[0]) importarTintim(e.target.files[0]); e.target.value = ""; }} />
          <button onClick={() => fileInputRef.current?.click()} disabled={importandoTintim} className="btn-primary" style={{ cursor:"pointer",fontSize:"12px",padding:"7px 12px" }}>
            <Upload size={12}/>
            {importandoTintim ? "Importando..." : "Importar Tintim"}
          </button>
        </div>

        <table>
          <thead>
            <tr>
              <th>CONTATO</th>
              <th>ORIGEM</th>
              <th>ETAPA DA JORNADA</th>
              <th>PRIMEIRA MENSAGEM</th>
              <th>ÚLTIMA MENSAGEM ↓</th>
              <th>AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            {loading?(
              <tr><td colSpan={6} style={{ textAlign:"center",color:"#606060",padding:"48px" }}>Carregando...</td></tr>
            ):!filtradas.length?(
              <tr><td colSpan={6} style={{ textAlign:"center",color:"#606060",padding:"48px" }}>Nenhuma conversa encontrada.</td></tr>
            ):filtradas.map(c=>(
              <tr key={c.id}>
                <td>
                  <div style={{ display:"flex",alignItems:"center",gap:"8px" }}>
                    <div style={{ position:"relative" }}>
                      <Avatar nome={c.contato_nome||c.contato_numero} foto={c.contato_foto} size={32}/>
                      {c.nao_lidas>0&&<span style={{ position:"absolute",top:"-3px",right:"-3px",background:"#29ABE2",color:"#000",fontSize:"9px",fontWeight:"800",borderRadius:"50%",width:"14px",height:"14px",display:"flex",alignItems:"center",justifyContent:"center" }}>{c.nao_lidas>9?"9+":c.nao_lidas}</span>}
                    </div>
                    <div>
                      <p style={{ fontSize:"13px",fontWeight:"600",color:"#f0f0f0",margin:0 }}>{c.contato_nome||"—"}</p>
                      <p style={{ fontSize:"12px",color:"#606060",margin:0 }}>{formatarNumero(c.contato_numero)}</p>
                    </div>
                  </div>
                </td>
                <td><OrigemBadge origem={c.origem}/></td>
                <td><EtapaBadge etapa={c.etapa_jornada}/></td>
                <td style={{ color:"#a0a0a0",fontSize:"12px" }}>{formatarData(c.primeira_mensagem_at||c.created_at)}</td>
                <td style={{ color:"#a0a0a0",fontSize:"12px" }}>{formatarData(c.ultima_mensagem_at)}</td>
                <td>
                  <div style={{ display:"flex",gap:"6px" }}>
                    <button onClick={()=>setDetalhes(c)} style={{ display:"flex",alignItems:"center",gap:"4px",padding:"5px 8px",borderRadius:"6px",border:"1px solid #2e2e2e",background:"#222",color:"#a0a0a0",cursor:"pointer",fontSize:"12px" }}>
                      <Eye size={12}/> Ver
                    </button>
                    <button onClick={()=>setChatDireto(c)} style={{ display:"flex",alignItems:"center",gap:"4px",padding:"5px 8px",borderRadius:"6px",border:"1px solid #2e2e2e",background:"#222",color:"#a0a0a0",cursor:"pointer",fontSize:"12px" }}>
                      <MessageCircle size={12}/>
                    </button>
                    <button onClick={()=>enviarParaCrm(c)} disabled={enviandoCrm.has(c.id)||enviadosCrm.has(c.id)}
                      style={{ display:"flex",alignItems:"center",gap:"4px",padding:"5px 8px",borderRadius:"6px",border:"1px solid",fontSize:"12px",cursor:enviadosCrm.has(c.id)?"default":"pointer",
                        borderColor:enviadosCrm.has(c.id)?"#22c55e40":"#2e2e2e",background:enviadosCrm.has(c.id)?"#052e1640":"#222",color:enviadosCrm.has(c.id)?"#22c55e":"#a0a0a0" }}>
                      <UserPlus size={12}/> {enviandoCrm.has(c.id)?"...":enviadosCrm.has(c.id)?"CRM ✓":"CRM"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtradas.length>0&&(
          <div style={{ padding:"10px 16px",borderTop:"1px solid #2e2e2e",fontSize:"12px",color:"#606060" }}>
            {filtradas.length} conversa{filtradas.length!==1?"s":""}
            {filtrosAtivos>0&&` (${conversas.length} total)`}
          </div>
        )}
      </div>

      {filtrosAbertos && <FiltrosAvancados conversas={conversas} filtros={filtros} onChange={setFiltros} onClose={()=>setFiltrosAbertos(false)}/>}
      {detalhes && <DetalhesModal conversa={detalhes} etapas={etapas} onClose={()=>setDetalhes(null)}
        onEtapaChange={etapa=>setConversas(prev=>prev.map(c=>c.id===detalhes.id?{...c,etapa_jornada:etapa}:c))}
        onConversaUpdate={updates=>{setConversas(prev=>prev.map(c=>c.id===detalhes.id?{...c,...updates}:c));setDetalhes(d=>d?{...d,...updates}:d);}}
      />}
      {chatDireto && <ChatLateral conversa={chatDireto} onClose={()=>setChatDireto(null)}/>}
    </div>
  );
}
