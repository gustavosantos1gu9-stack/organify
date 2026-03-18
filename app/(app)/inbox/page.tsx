"use client";

import { useState, useEffect, useRef } from "react";
import { Search, RefreshCw, Eye, Send, X, ChevronDown, MessageCircle, ExternalLink, Play, Pause, UserPlus } from "lucide-react";
import { supabase, getAgenciaId } from "@/lib/hooks";

interface Conversa {
  id: string; contato_numero: string; contato_nome: string; contato_foto?: string;
  contato_jid?: string; ultima_mensagem: string; ultima_mensagem_at: string;
  primeira_mensagem_at?: string; nao_lidas: number; lead_id?: string;
  origem?: string; origem_detalhe?: string; etapa_jornada?: string;
  utm_source?: string; utm_medium?: string; utm_campaign?: string;
  utm_content?: string; link_nome?: string; fbclid?: string;
  dispositivo?: string; navegador?: string; ip?: string;
  created_at: string;
}
interface Mensagem {
  id: string; de_mim: boolean; tipo: string; conteudo: string;
  mensagem_id: string; created_at: string;
}

const ETAPAS = ["Fez Contato", "Qualificado", "Agendou", "Fechou", "Perdido"];
const INSTANCIA = "salxdigital";

function formatarNumero(n: string) {
  const d = (n||"").replace(/\D/g, "");
  if (d.startsWith("55") && d.length === 13) return `(${d.slice(2,4)}) ${d.slice(4,9)}-${d.slice(9)}`;
  if (d.startsWith("55") && d.length === 12) return `(${d.slice(2,4)}) ${d.slice(4,8)}-${d.slice(8)}`;
  return n;
}

function formatarData(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", year:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit" });
}

function OrigemBadge({ origem }: { origem?: string }) {
  if (!origem || origem === "Não Rastreada") return <span style={{ fontSize:"12px", color:"#606060" }}>❌ Não rastreada</span>;
  if (origem === "Meta Ads") return <span style={{ fontSize:"12px", color:"#1877f2", display:"flex", alignItems:"center", gap:"4px" }}>🔷 Meta Ads</span>;
  if (origem === "Google Ads") return <span style={{ fontSize:"12px", color:"#ea4335", display:"flex", alignItems:"center", gap:"4px" }}>🔺 Google Ads</span>;
  return <span style={{ fontSize:"12px", color:"#a0a0a0" }}>🌐 {origem}</span>;
}

function Avatar({ nome, foto, size=36 }: { nome: string; foto?: string; size?: number }) {
  const cores = ["#29ABE2","#3b82f6","#8b5cf6","#f59e0b","#ec4899","#06b6d4","#ef4444"];
  const cor = cores[(nome||"").charCodeAt(0) % cores.length];
  if (foto) return <img src={foto} alt={nome} style={{ width:size, height:size, borderRadius:"50%", objectFit:"cover", flexShrink:0 }}/>;
  return <div style={{ width:size, height:size, borderRadius:"50%", background:cor, display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.38, fontWeight:"700", color:"#fff", flexShrink:0 }}>{(nome||"?").charAt(0).toUpperCase()}</div>;
}

function ChatLateral({ conversa, onClose }: { conversa: Conversa; onClose: ()=>void }) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const carregar = async () => {
    const { data } = await supabase.from("mensagens").select("*")
      .eq("conversa_id", conversa.id).order("created_at", { ascending: true });
    setMensagens(data || []);
    await supabase.from("conversas").update({ nao_lidas: 0 }).eq("id", conversa.id);
  };

  const sincronizar = async () => {
    setSincronizando(true);
    try {
      const agId = await getAgenciaId();
      await fetch("https://organify-sync-production.up.railway.app/sync/mensagens", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversa_id: conversa.id, jid: conversa.contato_jid || `${conversa.contato_numero}@s.whatsapp.net`, agencia_id: agId }),
      });
      await new Promise(r => setTimeout(r, 3000));
      await carregar();
    } catch(e) {} finally { setSincronizando(false); }
  };

  const enviar = async () => {
    if (!texto.trim() || enviando) return;
    setEnviando(true);
    const t = texto; setTexto("");
    try {
      const agId = await getAgenciaId();
      await fetch("/api/evolution", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action:"sendText", instanceName:INSTANCIA, payload:{ number:conversa.contato_numero, text:t }, agencia_id:agId }),
      });
      await supabase.from("mensagens").insert({ conversa_id:conversa.id, agencia_id:agId, mensagem_id:`local-${Date.now()}`, de_mim:true, tipo:"text", conteudo:t, created_at:new Date().toISOString() });
      await carregar();
    } catch(e) {} finally { setEnviando(false); }
  };

  useEffect(() => { carregar(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior:"smooth" }); }, [mensagens]);

  const grupos = mensagens.reduce((acc: {data:string;msgs:Mensagem[]}[], m) => {
    const dia = new Date(m.created_at).toLocaleDateString("pt-BR");
    const ult = acc[acc.length-1];
    if (ult?.data === dia) ult.msgs.push(m);
    else acc.push({ data:dia, msgs:[m] });
    return acc;
  }, []);

  return (
    <div style={{ position:"fixed", right:0, top:0, bottom:0, width:"420px", background:"#141414", borderLeft:"1px solid #2e2e2e", zIndex:200, display:"flex", flexDirection:"column" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {/* Header */}
      <div style={{ padding:"12px 16px", borderBottom:"1px solid #2e2e2e", display:"flex", alignItems:"center", gap:"10px", background:"#1a1a1a" }}>
        <Avatar nome={conversa.contato_nome||conversa.contato_numero} foto={conversa.contato_foto} size={36}/>
        <div style={{ flex:1 }}>
          <p style={{ fontSize:"14px", fontWeight:"600", color:"#f0f0f0", margin:0 }}>{conversa.contato_nome || formatarNumero(conversa.contato_numero)}</p>
          <p style={{ fontSize:"11px", color:"#606060", margin:0 }}>{formatarNumero(conversa.contato_numero)}</p>
        </div>
        <button onClick={sincronizar} disabled={sincronizando} style={{ background:"none", border:"none", cursor:"pointer", color:"#606060", padding:"4px" }}>
          <RefreshCw size={14} style={{ animation:sincronizando?"spin 1s linear infinite":"none" }}/>
        </button>
        <a href={`https://wa.me/${conversa.contato_numero}`} target="_blank" rel="noreferrer" style={{ color:"#606060", display:"flex" }}>
          <ExternalLink size={14}/>
        </a>
        <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"#606060", padding:"4px" }}>
          <X size={16}/>
        </button>
      </div>

      {/* Mensagens */}
      <div style={{ flex:1, overflowY:"auto", padding:"12px 16px", display:"flex", flexDirection:"column", gap:"4px", background:"#0d0d0d" }}>
        {!mensagens.length ? (
          <div style={{ textAlign:"center", color:"#606060", fontSize:"13px", marginTop:"40px" }}>
            <p>Nenhuma mensagem carregada.</p>
            <button onClick={sincronizar} style={{ marginTop:"8px", background:"#29ABE2", color:"#000", border:"none", borderRadius:"6px", padding:"8px 16px", cursor:"pointer", fontSize:"12px" }}>
              Carregar histórico
            </button>
          </div>
        ) : grupos.map(grupo => (
          <div key={grupo.data}>
            <div style={{ display:"flex", justifyContent:"center", margin:"8px 0" }}>
              <span style={{ background:"#1e1e1e", color:"#606060", fontSize:"11px", padding:"2px 10px", borderRadius:"10px" }}>{grupo.data}</span>
            </div>
            {grupo.msgs.map(m => (
              <div key={m.id} style={{ display:"flex", justifyContent:m.de_mim?"flex-end":"flex-start", marginBottom:"3px" }}>
                {!m.de_mim && <Avatar nome={conversa.contato_nome||"?"} foto={conversa.contato_foto} size={22}/>}
                <div style={{ maxWidth:"80%", padding:"8px 12px", marginLeft:m.de_mim?"0":"6px", borderRadius:m.de_mim?"12px 12px 2px 12px":"12px 12px 12px 2px", background:m.de_mim?"#29ABE2":"#1e1e1e", color:m.de_mim?"#000":"#f0f0f0", fontSize:"13px", lineHeight:"1.5" }}>
                  {m.tipo === "audio" ? <span>🎵 Áudio</span> : m.tipo === "image" ? <span>📷 {m.conteudo}</span> : <span style={{ whiteSpace:"pre-wrap", wordBreak:"break-word" }}>{m.conteudo}</span>}
                  <div style={{ fontSize:"10px", opacity:0.6, textAlign:"right", marginTop:"2px" }}>
                    {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
        <div ref={endRef}/>
      </div>

      {/* Input */}
      <div style={{ padding:"12px 16px", borderTop:"1px solid #2e2e2e", display:"flex", gap:"8px", alignItems:"flex-end", background:"#1a1a1a" }}>
        <textarea className="form-input" placeholder="Digite uma mensagem..." value={texto}
          onChange={e=>setTexto(e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();enviar();}}}
          style={{ flex:1, resize:"none", minHeight:"40px", maxHeight:"100px", lineHeight:"1.5" }} rows={1}/>
        <button onClick={enviar} disabled={enviando||!texto.trim()} style={{ width:"40px", height:"40px", borderRadius:"50%", background:"#29ABE2", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", opacity:enviando||!texto.trim()?0.4:1, flexShrink:0 }}>
          <Send size={15} color="#000"/>
        </button>
      </div>
    </div>
  );
}

function DetalhesModal({ conversa, onClose, onEtapaChange }: { conversa: Conversa; onClose: ()=>void; onEtapaChange: (etapa: string)=>void }) {
  const [etapa, setEtapa] = useState(conversa.etapa_jornada || "Fez Contato");
  const [salvando, setSalvando] = useState(false);
  const [chatAberto, setChatAberto] = useState(false);

  const salvarEtapa = async (novaEtapa: string) => {
    setSalvando(true);
    setEtapa(novaEtapa);
    await supabase.from("conversas").update({ etapa_jornada: novaEtapa, etapa_alterada_at: new Date().toISOString() }).eq("id", conversa.id);
    onEtapaChange(novaEtapa);

    // Disparar pixel para a nova etapa
    const agId = await getAgenciaId();
    fetch("/api/pixel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agencia_id: agId,
        conversa_id: conversa.id,
        etapa_nome: novaEtapa,
        phone: conversa.contato_numero,
        fbclid: conversa.fbclid,
        utm_campaign: conversa.utm_campaign,
        utm_content: conversa.utm_content,
      }),
    }).catch(() => {});

    setSalvando(false);
  };

  const criarLead = async () => {
    const agId = await getAgenciaId();
    const { data } = await supabase.from("leads").insert({
      agencia_id: agId, nome: conversa.contato_nome || conversa.contato_numero,
      telefone: conversa.contato_numero, etapa: "novo",
    }).select().single();
    if (data) {
      await supabase.from("conversas").update({ lead_id: data.id }).eq("id", conversa.id);
      alert("Lead criado no CRM!");
    }
  };

  return (
    <>
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center" }} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{ width:"680px", maxHeight:"90vh", background:"#141414", borderRadius:"16px", border:"1px solid #2e2e2e", overflow:"auto" }}>
        {/* Header */}
        <div style={{ padding:"16px 20px", borderBottom:"1px solid #2e2e2e", display:"flex", alignItems:"center", gap:"12px", background:"#1a1a1a", position:"sticky", top:0 }}>
          <Avatar nome={conversa.contato_nome||conversa.contato_numero} foto={conversa.contato_foto} size={40}/>
          <div style={{ flex:1 }}>
            <p style={{ fontSize:"15px", fontWeight:"600", color:"#f0f0f0", margin:0 }}>{conversa.contato_nome || formatarNumero(conversa.contato_numero)}</p>
            <p style={{ fontSize:"12px", color:"#606060", margin:0 }}>{formatarNumero(conversa.contato_numero)}</p>
          </div>
          <button onClick={()=>setChatAberto(true)} style={{ display:"flex", alignItems:"center", gap:"6px", padding:"6px 12px", borderRadius:"6px", border:"1px solid #2e2e2e", background:"#222", color:"#a0a0a0", cursor:"pointer", fontSize:"12px" }}>
            <MessageCircle size={13}/> Abrir Conversa
          </button>
          {!conversa.lead_id && (
            <button onClick={criarLead} style={{ display:"flex", alignItems:"center", gap:"6px", padding:"6px 12px", borderRadius:"6px", border:"1px solid #2e2e2e", background:"#222", color:"#a0a0a0", cursor:"pointer", fontSize:"12px" }}>
              <UserPlus size={13}/> Criar Lead
            </button>
          )}
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"#606060" }}><X size={18}/></button>
        </div>

        <div style={{ padding:"20px", display:"flex", flexDirection:"column", gap:"16px" }}>
          {/* Info da Conversa */}
          <div className="card">
            <h3 style={{ fontSize:"13px", fontWeight:"600", color:"#f0f0f0", marginBottom:"14px", paddingBottom:"10px", borderBottom:"1px solid #2e2e2e" }}>Informações da Conversa</h3>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
              {[
                { label:"Nome", value: conversa.contato_nome || "—" },
                { label:"WhatsApp", value: formatarNumero(conversa.contato_numero) },
                { label:"Origem", value: <OrigemBadge origem={conversa.origem}/> },
                { label:"Etapa da Jornada", value: etapa },
                { label:"Primeira Interação", value: formatarData(conversa.primeira_mensagem_at || conversa.created_at) },
                { label:"Última Interação", value: formatarData(conversa.ultima_mensagem_at) },
              ].map(item => (
                <div key={item.label}>
                  <p style={{ fontSize:"11px", color:"#606060", marginBottom:"2px" }}>{item.label}</p>
                  <p style={{ fontSize:"13px", color:"#f0f0f0" }}>{item.value as any}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Etapa da Jornada */}
          <div className="card">
            <h3 style={{ fontSize:"13px", fontWeight:"600", color:"#f0f0f0", marginBottom:"14px", paddingBottom:"10px", borderBottom:"1px solid #2e2e2e" }}>Etapa da Jornada</h3>
            <p style={{ fontSize:"12px", color:"#606060", marginBottom:"10px" }}>Etapa atual: <strong style={{ color:"#f0f0f0" }}>{etapa}</strong></p>
            <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
              {ETAPAS.map(e => (
                <button key={e} onClick={()=>salvarEtapa(e)} disabled={salvando} style={{
                  padding:"6px 14px", borderRadius:"20px", fontSize:"12px", cursor:"pointer",
                  border:`1px solid ${etapa===e?"#29ABE2":"#2e2e2e"}`,
                  background:etapa===e?"rgba(41,171,226,0.15)":"#222",
                  color:etapa===e?"#29ABE2":"#a0a0a0",
                  fontWeight:etapa===e?"600":"400",
                }}>{e}</button>
              ))}
            </div>
          </div>

          {/* Rastreamento */}
          {(conversa.utm_source || conversa.utm_campaign || conversa.link_nome) && (
            <div className="card">
              <h3 style={{ fontSize:"13px", fontWeight:"600", color:"#f0f0f0", marginBottom:"14px", paddingBottom:"10px", borderBottom:"1px solid #2e2e2e" }}>Informações de Rastreamento</h3>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px" }}>
                {conversa.link_nome && <div><p style={{ fontSize:"11px", color:"#606060" }}>Nome do Link</p><p style={{ fontSize:"13px", color:"#f0f0f0" }}>{conversa.link_nome}</p></div>}
                {conversa.utm_source && <div><p style={{ fontSize:"11px", color:"#606060" }}>Origem (utm_source)</p><p style={{ fontSize:"13px", color:"#f0f0f0" }}>{conversa.utm_source}</p></div>}
                {conversa.utm_medium && <div><p style={{ fontSize:"11px", color:"#606060" }}>Meio (utm_medium)</p><p style={{ fontSize:"13px", color:"#f0f0f0" }}>{conversa.utm_medium}</p></div>}
                {conversa.utm_campaign && <div><p style={{ fontSize:"11px", color:"#606060" }}>Campanha</p><p style={{ fontSize:"13px", color:"#f0f0f0" }}>{conversa.utm_campaign}</p></div>}
                {conversa.utm_content && <div><p style={{ fontSize:"11px", color:"#606060" }}>Conteúdo</p><p style={{ fontSize:"13px", color:"#f0f0f0" }}>{conversa.utm_content}</p></div>}
                {conversa.fbclid && <div><p style={{ fontSize:"11px", color:"#606060" }}>fbclid</p><p style={{ fontSize:"12px", color:"#606060", fontFamily:"monospace", wordBreak:"break-all" }}>{conversa.fbclid.slice(0,40)}...</p></div>}
              </div>
            </div>
          )}

          {/* Dispositivo */}
          {(conversa.ip || conversa.navegador || conversa.dispositivo) && (
            <div className="card">
              <h3 style={{ fontSize:"13px", fontWeight:"600", color:"#f0f0f0", marginBottom:"14px", paddingBottom:"10px", borderBottom:"1px solid #2e2e2e" }}>Informações do Dispositivo</h3>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px" }}>
                {conversa.ip && <div><p style={{ fontSize:"11px", color:"#606060" }}>IP</p><p style={{ fontSize:"12px", color:"#f0f0f0", fontFamily:"monospace" }}>{conversa.ip}</p></div>}
                {conversa.navegador && <div><p style={{ fontSize:"11px", color:"#606060" }}>Navegador</p><p style={{ fontSize:"13px", color:"#f0f0f0" }}>{conversa.navegador}</p></div>}
                {conversa.dispositivo && <div><p style={{ fontSize:"11px", color:"#606060" }}>Dispositivo</p><p style={{ fontSize:"13px", color:"#f0f0f0" }}>{conversa.dispositivo}</p></div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    {chatAberto && <ChatLateral conversa={conversa} onClose={()=>setChatAberto(false)}/>}
    </>
  );
}

export default function InboxPage() {
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroOrigem, setFiltroOrigem] = useState("todas");
  const [detalhes, setDetalhes] = useState<Conversa|null>(null);
  const [chatDireto, setChatDireto] = useState<Conversa|null>(null);
  const [sincronizandoTudo, setSincronizandoTudo] = useState(false);

  const carregar = async () => {
    const agId = await getAgenciaId();
    const { data } = await supabase.from("conversas").select("*")
      .eq("agencia_id", agId!).order("ultima_mensagem_at", { ascending: false });
    setConversas(data || []);
    setLoading(false);
  };

  const sincronizarTudo = async () => {
    if (!confirm("Vai importar todas as conversas via Railway. Continuar?")) return;
    setSincronizandoTudo(true);
    try {
      const agId = await getAgenciaId();
      await fetch("https://organify-sync-production.up.railway.app/sync/conversas", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agencia_id: agId }),
      });
      alert("Sincronização iniciada! Aguarde alguns minutos e recarregue.");
    } catch(e) { alert("Erro ao sincronizar"); }
    finally { setSincronizandoTudo(false); }
  };

  useEffect(() => { carregar(); }, []);
  useEffect(() => { const i = setInterval(carregar, 10000); return () => clearInterval(i); }, []);

  const filtradas = conversas.filter(c => {
    const matchBusca = c.contato_nome?.toLowerCase().includes(busca.toLowerCase()) || c.contato_numero.includes(busca);
    const matchOrigem = filtroOrigem === "todas" || c.origem === filtroOrigem ||
      (filtroOrigem === "Não Rastreada" && (!c.origem || c.origem === "Não Rastreada"));
    return matchBusca && matchOrigem;
  });

  const kpis = {
    total: conversas.length,
    meta: conversas.filter(c => c.origem === "Meta Ads").length,
    google: conversas.filter(c => c.origem === "Google Ads").length,
    outras: conversas.filter(c => c.origem && c.origem !== "Meta Ads" && c.origem !== "Google Ads" && c.origem !== "Não Rastreada").length,
    naoRastreada: conversas.filter(c => !c.origem || c.origem === "Não Rastreada").length,
  };

  const ORIGENS = [
    { key:"todas", label:"Todas as Origens" },
    { key:"Meta Ads", label:"🔷 Meta Ads" },
    { key:"Google Ads", label:"🔺 Google Ads" },
    { key:"Outras Origens", label:"🌐 Outras Origens" },
    { key:"Não Rastreada", label:"❌ Não Rastreada" },
  ];

  return (
    <div className="animate-in">
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"24px" }}>
        <div>
          <div className="breadcrumb"><a href="/">Início</a><span>›</span><span className="current">Conversas</span></div>
          <h1 style={{ fontSize:"22px", fontWeight:"600" }}>Conversas</h1>
        </div>
        <span style={{ display:"flex", alignItems:"center", gap:"6px", fontSize:"12px", color:"#29ABE2", background:"rgba(41,171,226,0.1)", border:"1px solid rgba(41,171,226,0.2)", padding:"4px 10px", borderRadius:"20px" }}>
          <span style={{ width:"6px", height:"6px", borderRadius:"50%", background:"#29ABE2", display:"inline-block" }}/>WhatsApp Conectado
        </span>
      </div>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:"10px", marginBottom:"20px" }}>
        {[
          { icon:"💬", label:"Total", value:kpis.total },
          { icon:"🔷", label:"Meta Ads", value:kpis.meta },
          { icon:"🔺", label:"Google Ads", value:kpis.google },
          { icon:"🌐", label:"Outras Origens", value:kpis.outras },
          { icon:"❌", label:"Não Rastreada", value:kpis.naoRastreada },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding:"12px 14px", cursor:"pointer" }}
            onClick={() => setFiltroOrigem(k.label === "Total" ? "todas" : k.label)}>
            <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
              <span style={{ fontSize:"18px" }}>{k.icon}</span>
              <div>
                <p style={{ fontSize:"11px", color:"#606060", margin:0 }}>{k.label}</p>
                <p style={{ fontSize:"22px", fontWeight:"700", color:"#f0f0f0", margin:0, lineHeight:1 }}>{k.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabela */}
      <div className="table-wrapper">
        <div style={{ padding:"12px 16px", borderBottom:"1px solid #2e2e2e", display:"flex", gap:"10px", alignItems:"center" }}>
          <div style={{ position:"relative", flex:1 }}>
            <Search size={13} style={{ position:"absolute", left:"10px", top:"50%", transform:"translateY(-50%)", color:"#606060" }}/>
            <input className="search-input" placeholder="Telefone ou nome..." value={busca}
              onChange={e=>setBusca(e.target.value)} style={{ paddingLeft:"32px" }}/>
          </div>
          <select value={filtroOrigem} onChange={e=>setFiltroOrigem(e.target.value)}
            style={{ background:"#1a1a1a", border:"1px solid #2e2e2e", borderRadius:"8px", padding:"8px 12px", color:"#f0f0f0", fontSize:"13px", cursor:"pointer" }}>
            {ORIGENS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          <button onClick={carregar} className="btn-ghost" style={{ padding:"8px", cursor:"pointer" }}><RefreshCw size={14}/></button>
          <button onClick={sincronizarTudo} disabled={sincronizandoTudo} className="btn-secondary" style={{ cursor:"pointer", fontSize:"12px", padding:"7px 12px" }}>
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
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign:"center", color:"#606060", padding:"48px" }}>Carregando...</td></tr>
            ) : !filtradas.length ? (
              <tr><td colSpan={6} style={{ textAlign:"center", color:"#606060", padding:"48px" }}>Nenhuma conversa encontrada.</td></tr>
            ) : filtradas.map(c => (
              <tr key={c.id}>
                <td>
                  <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                    <div style={{ position:"relative" }}>
                      <Avatar nome={c.contato_nome||c.contato_numero} foto={c.contato_foto} size={32}/>
                      {c.nao_lidas > 0 && (
                        <span style={{ position:"absolute", top:"-3px", right:"-3px", background:"#29ABE2", color:"#000", fontSize:"9px", fontWeight:"800", borderRadius:"50%", width:"14px", height:"14px", display:"flex", alignItems:"center", justifyContent:"center" }}>
                          {c.nao_lidas > 9 ? "9+" : c.nao_lidas}
                        </span>
                      )}
                    </div>
                    <div>
                      <p style={{ fontSize:"13px", fontWeight:"600", color:"#f0f0f0", margin:0 }}>{c.contato_nome || "—"}</p>
                      <p style={{ fontSize:"12px", color:"#606060", margin:0 }}>{formatarNumero(c.contato_numero)}</p>
                    </div>
                  </div>
                </td>
                <td><OrigemBadge origem={c.origem}/></td>
                <td>
                  <span style={{ fontSize:"12px", padding:"3px 10px", borderRadius:"20px", background:"rgba(41,171,226,0.1)", color:"#29ABE2" }}>
                    {c.etapa_jornada || "Fez Contato"}
                  </span>
                </td>
                <td style={{ color:"#a0a0a0", fontSize:"12px" }}>{formatarData(c.primeira_mensagem_at || c.created_at)}</td>
                <td style={{ color:"#a0a0a0", fontSize:"12px" }}>{formatarData(c.ultima_mensagem_at)}</td>
                <td>
                  <div style={{ display:"flex", gap:"6px" }}>
                    <button onClick={()=>setDetalhes(c)} style={{ display:"flex", alignItems:"center", gap:"4px", padding:"5px 8px", borderRadius:"6px", border:"1px solid #2e2e2e", background:"#222", color:"#a0a0a0", cursor:"pointer", fontSize:"12px" }}>
                      <Eye size={12}/> Ver
                    </button>
                    <button onClick={()=>setChatDireto(c)} style={{ display:"flex", alignItems:"center", gap:"4px", padding:"5px 8px", borderRadius:"6px", border:"1px solid #2e2e2e", background:"#222", color:"#a0a0a0", cursor:"pointer", fontSize:"12px" }}>
                      <MessageCircle size={12}/>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtradas.length > 0 && (
          <div style={{ padding:"10px 16px", borderTop:"1px solid #2e2e2e", fontSize:"12px", color:"#606060" }}>
            {filtradas.length} conversa{filtradas.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {detalhes && <DetalhesModal conversa={detalhes} onClose={()=>setDetalhes(null)} onEtapaChange={(etapa)=>setConversas(prev=>prev.map(c=>c.id===detalhes.id?{...c,etapa_jornada:etapa}:c))}/>}
      {chatDireto && <ChatLateral conversa={chatDireto} onClose={()=>setChatDireto(null)}/>}
    </div>
  );
}
