"use client";

import { useState, useEffect, useRef } from "react";
import { Send, Search, User, MessageCircle, ArrowLeft, UserPlus, RefreshCw, Play, Pause } from "lucide-react";
import { supabase, getAgenciaId } from "@/lib/hooks";

interface Conversa {
  id: string; instancia: string; contato_numero: string; contato_nome: string;
  contato_foto?: string; ultima_mensagem: string; ultima_mensagem_at: string;
  nao_lidas: number; lead_id?: string;
}

interface Mensagem {
  id: string; de_mim: boolean; tipo: string; conteudo: string;
  mensagem_id: string; midia_url?: string; created_at: string;
}

const INSTANCIA = "salxdigital";

function AudioPlayer({ mensagemId, deMim }: { mensagemId: string; deMim: boolean }) {
  const [audioUrl, setAudioUrl] = useState<string|null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement|null>(null);

  const carregarAudio = async () => {
    if (audioUrl) {
      togglePlay();
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/evolution/midia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensagem_id: mensagemId, instancia: INSTANCIA }),
      });
      const data = await res.json();
      if (data.base64) {
        const url = `data:audio/ogg;base64,${data.base64}`;
        setAudioUrl(url);
        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.src = url;
            audioRef.current.play();
            setPlaying(true);
          }
        }, 100);
      }
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  };

  return (
    <div style={{ display:"flex", alignItems:"center", gap:"10px", minWidth:"180px" }}>
      <button onClick={carregarAudio} disabled={loading} style={{
        width:"32px", height:"32px", borderRadius:"50%",
        background:deMim?"rgba(0,0,0,0.2)":"rgba(34,197,94,0.2)",
        border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
        color:deMim?"#000":"#22c55e",
      }}>
        {loading ? <RefreshCw size={14} style={{ animation:"spin 1s linear infinite" }}/> :
         playing ? <Pause size={14}/> : <Play size={14}/>}
      </button>
      <div style={{ flex:1, height:"3px", background:deMim?"rgba(0,0,0,0.2)":"rgba(255,255,255,0.2)", borderRadius:"2px" }}>
        <div style={{ width:playing?"50%":"0%", height:"100%", background:deMim?"#000":"#fff", borderRadius:"2px", transition:"width 0.1s" }}/>
      </div>
      <span style={{ fontSize:"11px", opacity:0.7 }}>🎵</span>
      {audioUrl && <audio ref={audioRef} onEnded={()=>setPlaying(false)} style={{ display:"none" }}/>}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function InboxPage() {
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [selecionada, setSelecionada] = useState<Conversa|null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const carregarConversas = async () => {
    const agId = await getAgenciaId();
    const { data } = await supabase.from("conversas").select("*")
      .eq("agencia_id", agId!).order("ultima_mensagem_at", { ascending: false });
    setConversas(data || []);
    setLoading(false);
  };

  const carregarMensagens = async (conversa: Conversa) => {
    setSelecionada(conversa);
    const { data } = await supabase.from("mensagens").select("*")
      .eq("conversa_id", conversa.id).order("created_at", { ascending: true });
    setMensagens(data || []);
    await supabase.from("conversas").update({ nao_lidas: 0 }).eq("id", conversa.id);
    setConversas(prev => prev.map(c => c.id === conversa.id ? { ...c, nao_lidas: 0 } : c));
  };

  const enviarMensagem = async () => {
    if (!texto.trim() || !selecionada || enviando) return;
    setEnviando(true);
    try {
      const agId = await getAgenciaId();
      await fetch("/api/evolution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sendText",
          instanceName: INSTANCIA,
          payload: { number: selecionada.contato_numero, text: texto },
        }),
      });
      await supabase.from("mensagens").insert({
        conversa_id: selecionada.id, agencia_id: agId,
        mensagem_id: `local-${Date.now()}`,
        de_mim: true, tipo: "text", conteudo: texto,
        created_at: new Date().toISOString(),
      });
      await supabase.from("conversas").update({
        ultima_mensagem: texto, ultima_mensagem_at: new Date().toISOString(),
      }).eq("id", selecionada.id);
      setTexto("");
      await carregarMensagens(selecionada);
      await carregarConversas();
    } catch(e) { console.error(e); }
    finally { setEnviando(false); }
  };

  const [sincronizando, setSincronizando] = useState(false);

  const sincronizarHistorico = async (conversa: Conversa) => {
    setSincronizando(true);
    try {
      const res = await fetch("/api/evolution/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numero: conversa.contato_numero, conversa_id: conversa.id, limite: 100 }),
      });
      const data = await res.json();
      await carregarMensagens(conversa);
      alert(`${data.total} mensagens sincronizadas!`);
    } catch(e) { console.error(e); alert("Erro ao sincronizar"); }
    finally { setSincronizando(false); }
  };
    if (!selecionada) return;
    const agId = await getAgenciaId();
    const { data } = await supabase.from("leads").insert({
      agencia_id: agId,
      nome: selecionada.contato_nome || selecionada.contato_numero,
      telefone: selecionada.contato_numero,
      etapa: "novo",
    }).select().single();
    if (data) {
      await supabase.from("conversas").update({ lead_id: data.id }).eq("id", selecionada.id);
      setSelecionada({ ...selecionada, lead_id: data.id });
      alert("Lead criado no CRM!");
    }
  };

  useEffect(() => { carregarConversas(); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mensagens]);

  useEffect(() => {
    const interval = setInterval(() => {
      carregarConversas();
      if (selecionada) carregarMensagens(selecionada);
    }, 5000);
    return () => clearInterval(interval);
  }, [selecionada]);

  const filtradas = conversas.filter(c =>
    c.contato_nome?.toLowerCase().includes(busca.toLowerCase()) ||
    c.contato_numero.includes(busca)
  );

  const formatarHora = (d: string) => {
    const data = new Date(d);
    const hoje = new Date();
    if (data.toDateString() === hoje.toDateString())
      return data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  };

  const renderMensagem = (m: Mensagem) => {
    if (m.tipo === "audio") return <AudioPlayer mensagemId={m.mensagem_id} deMim={m.de_mim}/>;
    if (m.tipo === "image") return (
      <div>
        {m.conteudo && <p style={{ margin:"0 0 4px", fontSize:"13px" }}>{m.conteudo}</p>}
        <p style={{ margin:0, fontSize:"12px", opacity:0.7 }}>📷 Imagem — clique para ver</p>
      </div>
    );
    if (m.tipo === "video") return <p style={{ margin:0 }}>🎥 {m.conteudo || "Vídeo"}</p>;
    if (m.tipo === "document") return <p style={{ margin:0 }}>📄 {m.conteudo}</p>;
    if (m.tipo === "sticker") return <p style={{ margin:0 }}>😄 Sticker</p>;
    return <p style={{ margin:0, whiteSpace:"pre-wrap", wordBreak:"break-word" }}>{m.conteudo}</p>;
  };

  return (
    <div style={{ height:"calc(100vh - 116px)", display:"flex", borderRadius:"12px", overflow:"hidden", border:"1px solid #2e2e2e" }}>
      {/* Lista */}
      <div style={{ width:"320px", flexShrink:0, borderRight:"1px solid #2e2e2e", display:"flex", flexDirection:"column", background:"#141414" }}>
        <div style={{ padding:"16px", borderBottom:"1px solid #2e2e2e" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"12px" }}>
            <MessageCircle size={18} color="#22c55e"/>
            <h2 style={{ fontSize:"15px", fontWeight:"600" }}>WhatsApp</h2>
            <span style={{ fontSize:"11px", background:"rgba(34,197,94,0.15)", color:"#22c55e", padding:"2px 8px", borderRadius:"10px", marginLeft:"auto" }}>● Conectado</span>
          </div>
          <div style={{ position:"relative" }}>
            <Search size={13} style={{ position:"absolute", left:"10px", top:"50%", transform:"translateY(-50%)", color:"#606060" }}/>
            <input className="search-input" placeholder="Buscar..." value={busca}
              onChange={e=>setBusca(e.target.value)} style={{ paddingLeft:"32px", width:"100%" }}/>
          </div>
        </div>
        <div style={{ flex:1, overflowY:"auto" }}>
          {loading ? (
            <div style={{ padding:"40px", textAlign:"center", color:"#606060", fontSize:"13px" }}>Carregando...</div>
          ) : !filtradas.length ? (
            <div style={{ padding:"40px", textAlign:"center", color:"#606060", fontSize:"13px" }}>Nenhuma conversa ainda.</div>
          ) : filtradas.map(c => (
            <div key={c.id} onClick={()=>carregarMensagens(c)} style={{
              padding:"12px 16px", cursor:"pointer", borderBottom:"1px solid #1e1e1e",
              background:selecionada?.id===c.id?"#1e1e1e":"transparent",
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                <div style={{ width:"40px", height:"40px", borderRadius:"50%", background:"#2a2a2a", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <User size={18} color="#606060"/>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"2px" }}>
                    <span style={{ fontSize:"13px", fontWeight:"600", color:"#f0f0f0", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {c.contato_nome || c.contato_numero}
                    </span>
                    <span style={{ fontSize:"11px", color:"#606060", flexShrink:0 }}>{formatarHora(c.ultima_mensagem_at)}</span>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontSize:"12px", color:"#606060", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>
                      {c.ultima_mensagem}
                    </span>
                    {c.nao_lidas > 0 && (
                      <span style={{ background:"#22c55e", color:"#000", fontSize:"10px", fontWeight:"700", borderRadius:"10px", padding:"2px 6px", marginLeft:"6px" }}>
                        {c.nao_lidas}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat */}
      {selecionada ? (
        <div style={{ flex:1, display:"flex", flexDirection:"column", background:"#0f0f0f" }}>
          <div style={{ padding:"12px 20px", borderBottom:"1px solid #2e2e2e", display:"flex", alignItems:"center", gap:"12px", background:"#141414" }}>
            <button onClick={()=>setSelecionada(null)} className="btn-ghost" style={{ padding:"6px", cursor:"pointer" }}>
              <ArrowLeft size={16}/>
            </button>
            <div style={{ width:"36px", height:"36px", borderRadius:"50%", background:"#2a2a2a", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <User size={16} color="#606060"/>
            </div>
            <div style={{ flex:1 }}>
              <p style={{ fontSize:"14px", fontWeight:"600", color:"#f0f0f0" }}>{selecionada.contato_nome || selecionada.contato_numero}</p>
              <p style={{ fontSize:"11px", color:"#606060" }}>+{selecionada.contato_numero}</p>
            </div>
            {!selecionada.lead_id ? (
              <button className="btn-secondary" style={{ padding:"6px 12px", fontSize:"12px", cursor:"pointer" }} onClick={criarLead}>
                <UserPlus size={13}/> Criar Lead
              </button>
            ) : (
              <a href="/crm" style={{ display:"flex", alignItems:"center", gap:"6px", padding:"6px 12px", fontSize:"12px", background:"rgba(34,197,94,0.1)", color:"#22c55e", borderRadius:"6px", textDecoration:"none", border:"1px solid rgba(34,197,94,0.2)" }}>
                ✓ No CRM
              </a>
            )}
            <button className="btn-ghost" style={{ padding:"6px 10px", fontSize:"12px", cursor:"pointer" }}
              onClick={()=>sincronizarHistorico(selecionada)} disabled={sincronizando}
              title="Sincronizar histórico">
              <RefreshCw size={14} style={{ animation:sincronizando?"spin 1s linear infinite":"none" }}/>
            </button>
          </div>

          <div style={{ flex:1, overflowY:"auto", padding:"20px", display:"flex", flexDirection:"column", gap:"8px" }}>
            {!mensagens.length && (
              <div style={{ textAlign:"center", color:"#606060", fontSize:"13px", marginTop:"40px" }}>Nenhuma mensagem ainda.</div>
            )}
            {mensagens.map(m => (
              <div key={m.id} style={{ display:"flex", justifyContent:m.de_mim?"flex-end":"flex-start" }}>
                <div style={{
                  maxWidth:"70%", padding:"10px 14px",
                  borderRadius:m.de_mim?"16px 16px 4px 16px":"16px 16px 16px 4px",
                  background:m.de_mim?"#22c55e":"#1e1e1e",
                  color:m.de_mim?"#000":"#f0f0f0",
                  fontSize:"13px", lineHeight:"1.5",
                }}>
                  {renderMensagem(m)}
                  <p style={{ fontSize:"10px", opacity:0.6, margin:"4px 0 0", textAlign:"right" }}>
                    {formatarHora(m.created_at)}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef}/>
          </div>

          <div style={{ padding:"16px 20px", borderTop:"1px solid #2e2e2e", display:"flex", gap:"10px", alignItems:"center", background:"#141414" }}>
            <input className="form-input" placeholder="Digite uma mensagem..." value={texto}
              onChange={e=>setTexto(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&enviarMensagem()}
              style={{ flex:1 }}/>
            <button onClick={enviarMensagem} disabled={enviando||!texto.trim()} style={{
              width:"40px", height:"40px", borderRadius:"50%", background:"#22c55e",
              border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
              opacity:enviando||!texto.trim()?0.5:1,
            }}>
              <Send size={16} color="#000"/>
            </button>
          </div>
        </div>
      ) : (
        <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:"16px", color:"#606060" }}>
          <MessageCircle size={48} style={{ opacity:0.3 }}/>
          <p style={{ fontSize:"14px" }}>Selecione uma conversa para começar</p>
        </div>
      )}
    </div>
  );
}
