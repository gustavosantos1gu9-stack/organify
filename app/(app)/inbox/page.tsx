"use client";

import { useState, useEffect, useRef } from "react";
import { Search, RefreshCw, Eye, Send, X, Filter, MessageCircle, ChevronDown } from "lucide-react";
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
function DetalhesModal({ conversa, onClose, onEtapaChange, etapas }: { conversa: Conversa; onClose:()=>void; onEtapaChange:(e:string)=>void; etapas: EtapaJornada[] }) {
  const [etapa, setEtapa] = useState(conversa.etapa_jornada || "");
  const [salvando, setSalvando] = useState(false);
  const [chatAberto, setChatAberto] = useState(false);

  const salvarEtapa = async (novaEtapa: string) => {
    setSalvando(true);
    setEtapa(novaEtapa);
    await supabase.from("conversas").update({ etapa_jornada: novaEtapa, etapa_alterada_at: new Date().toISOString() }).eq("id", conversa.id);
    onEtapaChange(novaEtapa);
    const agId = await getAgenciaId();
    fetch("/api/pixel", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ agencia_id:agId, conversa_id:conversa.id, etapa_nome:novaEtapa, phone:conversa.contato_numero, fbclid:conversa.fbclid, utm_campaign:conversa.utm_campaign, utm_content:conversa.utm_content }),
    }).catch(()=>{});
    setSalvando(false);
  };

  const campos = [
    { label:"Origem", value:<OrigemBadge origem={conversa.origem}/> },
    { label:"Etapa da Jornada", value:<EtapaBadge etapa={etapa}/> },
    { label:"Nome do Link", value: conversa.link_nome || "—" },
    { label:"Campanha (utm_source)", value: conversa.utm_source || "—" },
    { label:"Meio (utm_medium)", value: conversa.utm_medium || "—" },
    { label:"Campanha", value: conversa.utm_campaign || "—" },
    { label:"Conjunto de Anúncio", value: conversa.utm_content ? conversa.utm_content.split("_")[0].trim() : "—" },
    { label:"Nome do Anúncio", value: (conversa as any).nome_anuncio || (conversa.utm_content && conversa.utm_content.includes("_") ? conversa.utm_content.split("_").slice(1).join("_").trim() : "—") },
    { label:"Primeira Mensagem", value: formatarData(conversa.primeira_mensagem_at || conversa.created_at) },
    { label:"Última Alteração Etapa", value: formatarData(conversa.etapa_alterada_at || "") },
    ...(conversa.fbclid ? [{ label:"fbclid", value: conversa.fbclid.substring(0,40)+"..." }] : []),
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
          <p style={{ fontSize:"12px", fontWeight:"600", color:"#606060", marginBottom:"10px" }}>INFORMAÇÕES DE RASTREAMENTO</p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px" }}>
            {campos.map(c => (
              <div key={c.label}>
                <p style={{ fontSize:"10px", color:"#505050", margin:"0 0 2px" }}>{c.label}</p>
                <div style={{ fontSize:"12px", color:"#f0f0f0" }}>{c.value}</div>
              </div>
            ))}
          </div>
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

  // Valores únicos do banco
  const uniq = (arr: (string|undefined)[]) => Array.from(new Set(arr.filter(Boolean) as string[])).sort();
  const campanhas = uniq(conversas.map(c=>c.utm_campaign));
  const conjuntos = uniq(conversas.map(c=>c.utm_content));
  const links = uniq(conversas.map(c=>c.link_nome));
  const anuncios = uniq(conversas.map(c=>(c as any).nome_anuncio));
  const sources = uniq(conversas.map(c=>c.utm_source));
  const mediums = uniq(conversas.map(c=>c.utm_medium));

  return (
    <>
      <div onClick={onClose} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:200 }}/>
      <div style={{ position:"fixed",right:0,top:0,bottom:0,width:"360px",background:"#141414",borderLeft:"1px solid #2e2e2e",zIndex:201,display:"flex",flexDirection:"column",overflowY:"auto" }}>
        <div style={{ padding:"14px 16px",borderBottom:"1px solid #2e2e2e",display:"flex",justifyContent:"space-between",alignItems:"center",background:"#1a1a1a" }}>
          <p style={{ fontSize:"14px",fontWeight:"600",color:"#f0f0f0",margin:0 }}>Filtros Avançados</p>
          <button onClick={onClose} style={{ background:"none",border:"none",cursor:"pointer",color:"#606060" }}><X size={16}/></button>
        </div>

        <div style={{ padding:"16px",display:"flex",flexDirection:"column",gap:"16px",flex:1 }}>

          {/* Origem */}
          <div>
            <p style={{ fontSize:"11px",color:"#606060",fontWeight:"600",marginBottom:"8px" }}>ORIGEM</p>
            <div style={{ display:"flex",flexWrap:"wrap",gap:"6px" }}>
              {["","Meta Ads","Google Ads","Outras Origens","Não Rastreada"].map(o=>(
                <button key={o} onClick={()=>set("origem",o)} style={{ padding:"4px 10px",borderRadius:"20px",border:"1px solid",fontSize:"12px",cursor:"pointer",
                  borderColor:local.origem===o?"#29ABE2":"#2e2e2e",background:local.origem===o?"rgba(41,171,226,0.1)":"transparent",color:local.origem===o?"#29ABE2":"#606060" }}>
                  {o||"Todas"}
                </button>
              ))}
            </div>
          </div>

          {/* Etapa */}
          <div>
            <p style={{ fontSize:"11px",color:"#606060",fontWeight:"600",marginBottom:"8px" }}>ETAPA DA JORNADA</p>
            <div style={{ display:"flex",flexWrap:"wrap",gap:"6px" }}>
              {["Entrou em contato","Qualificado","Agendou","Compareceu","Comprou","Perdido"].map(e=>{
                const cor = getCorEtapa(e);
                const etapas: string[] = local.etapas || [];
                const ativo = etapas.includes(e);
                return (
                  <button key={e} onClick={()=>{
                    const novas = ativo ? etapas.filter((x:string)=>x!==e) : [...etapas, e];
                    setLocal((f:any)=>({...f, etapas: novas, etapa: undefined}));
                  }} style={{ padding:"4px 10px",borderRadius:"20px",border:"1px solid",fontSize:"12px",cursor:"pointer",
                    borderColor:ativo?cor:"#2e2e2e",background:ativo?`${cor}18`:"transparent",color:ativo?cor:"#606060" }}>
                    {e}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Datas */}
          {[
            {key:"dataPrimeira",label:"DATA DA PRIMEIRA MENSAGEM"},
            {key:"dataEtapa",label:"DATA DA ÚLTIMA ALTERAÇÃO DE ETAPA"},
            {key:"dataUltima",label:"DATA DA ÚLTIMA MENSAGEM"},
          ].map(d=>(
            <div key={d.key}>
              <p style={{ fontSize:"11px",color:"#606060",fontWeight:"600",marginBottom:"8px" }}>{d.label}</p>
              <div style={{ display:"flex",gap:"8px" }}>
                <input type="date" value={local[d.key+"De"]||""} onChange={e=>set(d.key+"De",e.target.value)}
                  style={{ background:"#1a1a1a",border:"1px solid #2e2e2e",borderRadius:"6px",padding:"6px 8px",color:"#f0f0f0",fontSize:"12px",flex:1 }}/>
                <input type="date" value={local[d.key+"Ate"]||""} onChange={e=>set(d.key+"Ate",e.target.value)}
                  style={{ background:"#1a1a1a",border:"1px solid #2e2e2e",borderRadius:"6px",padding:"6px 8px",color:"#f0f0f0",fontSize:"12px",flex:1 }}/>
              </div>
            </div>
          ))}

          {/* Selects dinâmicos */}
          {[
            {key:"utmSource",label:"UTM SOURCE",opts:sources},
            {key:"utmMedium",label:"UTM MEDIUM",opts:mediums},
            {key:"campanha",label:"CAMPANHA",opts:campanhas},
            {key:"conjunto",label:"CONJUNTO DE ANÚNCIO",opts:conjuntos},
            {key:"link",label:"LINK RASTREÁVEL",opts:links},
            {key:"anuncio",label:"CRIATIVO / ANÚNCIO",opts:anuncios},
          ].map(f=>(
            f.opts.length > 0 ? (
              <div key={f.key}>
                <p style={{ fontSize:"11px",color:"#606060",fontWeight:"600",marginBottom:"8px" }}>{f.label}</p>
                <select value={local[f.key]||""} onChange={e=>set(f.key,e.target.value)}
                  style={{ width:"100%",background:"#1a1a1a",border:"1px solid #2e2e2e",borderRadius:"6px",padding:"7px 10px",color:"#f0f0f0",fontSize:"12px",cursor:"pointer" }}>
                  <option value="">Todas</option>
                  {f.opts.map((o:string)=><option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ) : null
          ))}
        </div>

        <div style={{ padding:"12px 16px",borderTop:"1px solid #2e2e2e",display:"flex",gap:"8px",background:"#1a1a1a" }}>
          <button onClick={()=>{setLocal({});onChange({});}} className="btn-ghost" style={{ flex:1,cursor:"pointer",fontSize:"12px" }}>Limpar</button>
          <button onClick={()=>{onChange(local);onClose();}} className="btn-primary" style={{ flex:2,cursor:"pointer",fontSize:"12px" }}>Aplicar Filtros</button>
        </div>
      </div>
    </>
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

  const carregar = async () => {
    const agId = await getAgenciaId();
    const [{ data: convs }, { data: etps }] = await Promise.all([
      supabase.from("conversas").select("*").eq("agencia_id",agId!).order("ultima_mensagem_at",{ascending:false}),
      supabase.from("jornada_etapas").select("*").eq("agencia_id",agId!).order("ordem"),
    ]);
    setConversas(convs||[]);
    setEtapas(etps||[]);
    setLoading(false);
  };

  const sincronizarTudo = async () => {
    if (!confirm("Vai importar todas as conversas via Railway. Continuar?")) return;
    setSincronizandoTudo(true);
    try {
      const agId = await getAgenciaId();
      await fetch("https://organify-sync-production.up.railway.app/sync/conversas",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({agencia_id:agId}),
      });
      alert("Sincronização iniciada! Aguarde alguns minutos e recarregue.");
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

  return (
    <div className="animate-in">
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"20px" }}>
        <div>
          <div className="breadcrumb"><a href="/">Início</a><span>›</span><span className="current">Conversas</span></div>
          <h1 style={{ fontSize:"22px",fontWeight:"600" }}>Conversas</h1>
        </div>
        <span style={{ display:"flex",alignItems:"center",gap:"6px",fontSize:"12px",color:"#29ABE2",background:"rgba(41,171,226,0.1)",border:"1px solid rgba(41,171,226,0.2)",padding:"4px 10px",borderRadius:"20px" }}>
          <span style={{ width:"6px",height:"6px",borderRadius:"50%",background:"#29ABE2",display:"inline-block" }}/>WhatsApp Conectado
        </span>
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
          <button onClick={sincronizarTudo} disabled={sincronizandoTudo} className="btn-secondary" style={{ cursor:"pointer",fontSize:"12px",padding:"7px 12px" }}>
            <RefreshCw size={12} style={{ animation:sincronizandoTudo?"spin 1s linear infinite":"none" }}/>
            {sincronizandoTudo?"Importando...":"Importar tudo"}
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
      {detalhes && <DetalhesModal conversa={detalhes} etapas={etapas} onClose={()=>setDetalhes(null)} onEtapaChange={etapa=>setConversas(prev=>prev.map(c=>c.id===detalhes.id?{...c,etapa_jornada:etapa}:c))}/>}
      {chatDireto && <ChatLateral conversa={chatDireto} onClose={()=>setChatDireto(null)}/>}
    </div>
  );
}
