"use client";

import { useState, useEffect, useRef } from "react";
import { Search, RefreshCw, ChevronDown, ChevronRight, MessageSquare, X, Send, Check, UserCircle2, Pencil, Trash2, Plus, FileText } from "lucide-react";
import ModalContrato from "@/components/controle/ModalContrato";
import ModalNovoCliente from "@/components/controle/ModalNovoCliente";
import { supabase, getAgenciaId } from "@/lib/hooks";

interface ControleCliente {
  id: string; nome: string; status: string; instagram: string;
  data_entrada: string; data_inicio_campanha: string; agendamentos: string;
  faturamento_medio: string; progresso_gestor: string; progresso_consultor: string;
  feed: string; feedback: string; sdr: string; head_squad: string;
  consultor: string; gestor: string; squad: string; investimento_mensal: number;
  ultimo_aumento: string; acao: string; acao_feita: string; otimizacoes: string;
  tarefas: string; datas_otimizacoes: string; motivo: string; razao_nome: string;
  grupo: string; created_at: string; cadastro_id?: string;
}
interface Subitem { id: string; cliente_id: string; texto: string; feito: boolean; created_at: string; }
interface Anotacao { id: string; cliente_id: string; usuario: string; conteudo: string; created_at: string; tipo: string; }
interface Cadastro {
  id: string; nome: string; cnpj: string; cpf: string; rg: string;
  endereco_empresa: string; endereco_pessoal: string; email: string;
  investimento_anuncios: string; ticket_micro_laser: string;
  regiao_anunciar: string; faturamento_medio: string; login_facebook: string; criado_em: string;
}

const STATUS_OPTS = [
  { value:"ativo", label:"Ativo", cor:"#22c55e" },
  { value:"pausado", label:"Pausado", cor:"#f59e0b" },
  { value:"saiu", label:"Churn", cor:"#ef4444" },
  { value:"entrada", label:"Entrada", cor:"#eab308" },
  { value:"debito", label:"Em Débito", cor:"#f97316" },
  { value:"renovar", label:"Renovar", cor:"#29ABE2" },
];

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function mesAtualStr() {
  const d = new Date();
  return `${MESES[d.getMonth()]}/${d.getFullYear()}`;
}

const COLUNAS_PADRAO = [
  { key:"status", label:"Status", w:110 },
  { key:"data_entrada", label:"Data Entrada", w:120 },
  { key:"data_inicio_campanha", label:"Início Camp.", w:120 },
  { key:"agendamentos", label:"Agendamentos", w:120 },
  { key:"faturamento_medio", label:"Fat. Médio", w:110 },
  { key:"progresso_gestor", label:"P. Gestor", w:100 },
  { key:"progresso_consultor", label:"P. Consultor", w:110 },
  { key:"feed", label:"Feed", w:100 },
  { key:"feedback", label:"Feedback", w:140 },
  { key:"sdr", label:"SDR", w:100 },
  { key:"head_squad", label:"HEAD", w:120 },
  { key:"consultor", label:"Consultor", w:120 },
  { key:"gestor", label:"Gestor", w:120 },
  { key:"squad", label:"Squad", w:120 },
  { key:"investimento_mensal", label:"Investimento", w:120 },
  { key:"ultimo_aumento", label:"Últ. Aumento", w:120 },
  { key:"acao", label:"Ação", w:120 },
  { key:"acao_feita", label:"Ação Feita?", w:100 },
  { key:"otimizacoes", label:"Otimizações", w:140 },
  { key:"tarefas", label:"Tarefas", w:140 },
  { key:"datas_otimizacoes", label:"Datas Otim.", w:120 },
  { key:"motivo", label:"Motivo", w:140 },
  { key:"razao_nome", label:"Razão + Nome", w:140 },
];

const SORT_OPTS = [
  { value:"data_entrada", label:"Data de Entrada" },
  { value:"nome", label:"Nome A-Z" },
  { value:"investimento_mensal", label:"Investimento" },
  { value:"created_at", label:"Data de Criação" },
];

function formatarData(d: string) {
  if (!d) return "";
  const limpo = d.trim().split(" ")[0].split("T")[0];
  if (limpo.includes("/")) {
    const p = limpo.split("/");
    if (p.length === 3) return `${p[0].padStart(2,"0")}/${p[1].padStart(2,"0")}/${p[2]}`;
    return limpo;
  }
  if (limpo.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [y,m,dia] = limpo.split("-");
    return `${dia}/${m}/${y}`;
  }
  return limpo;
}

function CelulaEditavel({ valor, onSave, tipo="text" }: { valor: string; onSave: (v: string) => void; tipo?: string }) {
  const [editando, setEditando] = useState(false);
  const [v, setV] = useState(valor||"");
  if (editando && tipo === "date") return (
    <input type="date" autoFocus defaultValue={v}
      onBlur={e => { setEditando(false); onSave(e.target.value); }}
      onChange={e => setV(e.target.value)}
      style={{ background:"#1a1a1a", border:"1px solid #29ABE2", borderRadius:"4px", padding:"3px 6px", color:"#f0f0f0", fontSize:"12px", width:"130px" }}/>
  );
  if (editando) return (
    <input autoFocus value={v} onChange={e => setV(e.target.value)}
      onBlur={() => { setEditando(false); onSave(v); }}
      onKeyDown={e => { if(e.key==="Enter"){setEditando(false);onSave(v);} if(e.key==="Escape"){setEditando(false);setV(valor||"");} }}
      style={{ background:"#1a1a1a", border:"1px solid #29ABE2", borderRadius:"4px", padding:"3px 6px", color:"#f0f0f0", fontSize:"12px", width:"100%", minWidth:"60px" }}/>
  );
  return (
    <span onClick={()=>setEditando(true)} title="Clique para editar"
      style={{ cursor:"pointer", padding:"3px 4px", borderRadius:"4px", display:"block", minHeight:"22px", fontSize:"12px", color:v?"#f0f0f0":"#2a2a2a" }}>
      {tipo==="date" ? formatarData(v) : (v||"—")}
    </span>
  );
}

function StatusSelect({ valor, onSave }: { valor: string; onSave: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const opt = STATUS_OPTS.find(s=>s.value===valor)||STATUS_OPTS[0];
  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen(v => !v);
  };
  const handleSelect = (e: React.MouseEvent, val: string) => {
    e.stopPropagation();
    onSave(val);
    setOpen(false);
  };
  return (
    <>
      <button ref={btnRef} onClick={handleOpen} style={{ display:"flex", alignItems:"center", gap:"5px", background:"none", border:"none", cursor:"pointer", padding:"3px 6px", borderRadius:"6px" }}>
        <span style={{ width:"8px", height:"8px", borderRadius:"50%", background:opt.cor, flexShrink:0 }}/>
        <span style={{ fontSize:"12px", color:opt.cor }}>{opt.label}</span>
      </button>
      {open && (
        <>
          <div onClick={()=>setOpen(false)} style={{ position:"fixed", inset:0, zIndex:9998 }}/>
          <div style={{ position:"fixed", top:pos.top, left:pos.left, background:"#1e1e1e", border:"1px solid #3a3a3a", borderRadius:"8px", zIndex:9999, minWidth:"140px", overflow:"hidden", boxShadow:"0 8px 24px rgba(0,0,0,0.7)" }}>
            {STATUS_OPTS.map(s => (
              <button key={s.value} onClick={e=>handleSelect(e,s.value)}
                style={{ display:"flex", alignItems:"center", gap:"8px", padding:"9px 14px", width:"100%", background: s.value===valor?"#2a2a2a":"none", border:"none", cursor:"pointer", color:s.cor, fontSize:"12px" }}
                onMouseEnter={e=>(e.currentTarget.style.background="#2a2a2a")}
                onMouseLeave={e=>(e.currentTarget.style.background=s.value===valor?"#2a2a2a":"none")}>
                <span style={{ width:"8px", height:"8px", borderRadius:"50%", background:s.cor }}/>{s.label}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function PainelPerfil({ cliente, cadastro, todos_cadastros, onClose, onVincular }: {
  cliente: ControleCliente;
  cadastro: Cadastro | null;
  todos_cadastros: Cadastro[];
  onClose: () => void;
  onVincular: (cadastroId: string) => void;
}) {
  const [buscaCadastro, setBuscaCadastro] = useState("");
  const [mostraBusca, setMostraBusca] = useState(false);
  const [modalContrato, setModalContrato] = useState(false);
  const filtrados = todos_cadastros.filter(c =>
    c.nome.toLowerCase().includes(buscaCadastro.toLowerCase())
  );
  const campos = [
    { label: "Email", key: "email" },
    { label: "CNPJ", key: "cnpj" },
    { label: "CPF", key: "cpf" },
    { label: "RG", key: "rg" },
    { label: "Endereço Empresa", key: "endereco_empresa" },
    { label: "Endereço Pessoal", key: "endereco_pessoal" },
    { label: "Investimento Anúncios", key: "investimento_anuncios" },
    { label: "Ticket Micro/Laser", key: "ticket_micro_laser" },
    { label: "Região", key: "regiao_anunciar" },
    { label: "Faturamento Médio", key: "faturamento_medio" },
    { label: "Login Facebook", key: "login_facebook" },
  ];
  return (
    <div style={{ position:"fixed", right:0, top:0, bottom:0, width:"400px", background:"#141414", borderLeft:"1px solid #2e2e2e", zIndex:200, display:"flex", flexDirection:"column", boxShadow:"-4px 0 20px rgba(0,0,0,0.3)" }}>
      <div style={{ padding:"14px 16px", borderBottom:"1px solid #2e2e2e", display:"flex", alignItems:"center", gap:"10px", background:"#1a1a1a" }}>
        <UserCircle2 size={20} color="#29ABE2"/>
        <div style={{ flex:1 }}>
          <p style={{ fontSize:"14px", fontWeight:"600", color:"#f0f0f0", margin:0 }}>{cliente.nome}</p>
          <p style={{ fontSize:"11px", color:"#606060", margin:0 }}>Perfil do Cliente</p>
        </div>
        <button onClick={()=>setModalContrato(true)} style={{ background:"#29ABE215", border:"1px solid #29ABE240", borderRadius:"6px", padding:"5px 10px", cursor:"pointer", color:"#29ABE2", fontSize:"11px", display:"flex", alignItems:"center", gap:"4px" }}><FileText size={12}/> Contrato</button>
        <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"#606060" }}><X size={16}/></button>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"16px" }}>
        {cadastro ? (
          <>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px" }}>
              <span style={{ fontSize:"11px", color:"#22c55e", background:"#052e16", padding:"3px 8px", borderRadius:"10px" }}>✓ Cadastro vinculado</span>
              <button onClick={()=>setMostraBusca(v=>!v)}
                style={{ background:"none", border:"1px solid #2e2e2e", borderRadius:"6px", padding:"4px 10px", cursor:"pointer", color:"#606060", fontSize:"11px" }}>
                Trocar
              </button>
            </div>
            {mostraBusca && (
              <div style={{ marginBottom:"16px" }}>
                <input value={buscaCadastro} onChange={e=>setBuscaCadastro(e.target.value)}
                  placeholder="Buscar cadastro..."
                  style={{ width:"100%", background:"#1a1a1a", border:"1px solid #2e2e2e", borderRadius:"6px", padding:"8px 10px", color:"#f0f0f0", fontSize:"13px", boxSizing:"border-box" as const }}/>
                <div style={{ maxHeight:"160px", overflowY:"auto", marginTop:"4px", border:"1px solid #2e2e2e", borderRadius:"6px", background:"#1a1a1a" }}>
                  {filtrados.map(c=>(
                    <button key={c.id} onClick={()=>{onVincular(c.id);setMostraBusca(false);}}
                      style={{ display:"block", width:"100%", padding:"8px 12px", background:"none", border:"none", cursor:"pointer", color:"#f0f0f0", fontSize:"12px", textAlign:"left" }}
                      onMouseEnter={e=>e.currentTarget.style.background="#2a2a2a"}
                      onMouseLeave={e=>e.currentTarget.style.background="none"}>
                      {c.nome}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {campos.map(campo=>(
              <div key={campo.key} style={{ marginBottom:"12px" }}>
                <p style={{ fontSize:"10px", color:"#606060", margin:"0 0 2px", textTransform:"uppercase" }}>{campo.label}</p>
                <p style={{ fontSize:"13px", color:"#f0f0f0", margin:0, wordBreak:"break-word" }}>
                  {(cadastro as any)[campo.key] || "—"}
                </p>
              </div>
            ))}
          </>
        ) : (
          <div style={{ textAlign:"center", padding:"32px 0" }}>
            <UserCircle2 size={48} color="#2e2e2e" style={{ marginBottom:"12px" }}/>
            <p style={{ color:"#606060", fontSize:"13px", marginBottom:"16px" }}>Nenhum cadastro vinculado</p>
            <button onClick={()=>setMostraBusca(v=>!v)}
              style={{ background:"#29ABE2", border:"none", borderRadius:"8px", padding:"10px 20px", cursor:"pointer", color:"#000", fontWeight:"600", fontSize:"13px" }}>
              Vincular cadastro
            </button>
            {mostraBusca && (
              <div style={{ marginTop:"16px", textAlign:"left" }}>
                <input value={buscaCadastro} onChange={e=>setBuscaCadastro(e.target.value)}
                  placeholder="Buscar por nome..."
                  style={{ width:"100%", background:"#1a1a1a", border:"1px solid #2e2e2e", borderRadius:"6px", padding:"8px 10px", color:"#f0f0f0", fontSize:"13px", boxSizing:"border-box" as const }}/>
                <div style={{ maxHeight:"200px", overflowY:"auto", marginTop:"4px", border:"1px solid #2e2e2e", borderRadius:"6px", background:"#1a1a1a" }}>
                  {filtrados.map(c=>(
                    <button key={c.id} onClick={()=>{onVincular(c.id);setMostraBusca(false);}}
                      style={{ display:"block", width:"100%", padding:"8px 12px", background:"none", border:"none", cursor:"pointer", color:"#f0f0f0", fontSize:"12px", textAlign:"left" }}
                      onMouseEnter={e=>e.currentTarget.style.background="#2a2a2a"}
                      onMouseLeave={e=>e.currentTarget.style.background="none"}>
                      {c.nome}
                    </button>
                  ))}
                  {!filtrados.length && <p style={{ color:"#606060", fontSize:"12px", padding:"12px", margin:0 }}>Nenhum resultado.</p>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {modalContrato && (
        <ModalContrato
          clienteId={cliente.id}
          nome={cadastro?.nome || cliente.nome}
          email={cadastro?.email || ""}
          cnpj={cadastro?.cnpj || ""}
          cpf={cadastro?.cpf || ""}
          rg={cadastro?.rg || ""}
          endereco_empresa={cadastro?.endereco_empresa || ""}
          endereco_pessoal={cadastro?.endereco_pessoal || ""}
          onClose={()=>setModalContrato(false)}
        />
      )}
    </div>
  );
}

function PainelLateral({ cliente, onClose }: { cliente: ControleCliente; onClose:()=>void }) {
  const [aba, setAba] = useState<"atualizacoes"|"log">("atualizacoes");
  const [anotacoes, setAnotacoes] = useState<Anotacao[]>([]);
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [agIdLocal, setAgIdLocal] = useState("");
  const [nomeUsuario, setNomeUsuario] = useState("Usuário");
  const [erroAnotacao, setErroAnotacao] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function init() {
      const id = await getAgenciaId();
      if (!id) return;
      setAgIdLocal(id);
      const { data: user } = await supabase.auth.getUser();
      const nome = user?.user?.user_metadata?.nome || user?.user?.email?.split("@")[0] || "Usuário";
      setNomeUsuario(nome);
      const { data } = await supabase.from("anotacoes")
        .select("*").eq("agencia_id", id).eq("cliente_id", cliente.id)
        .order("created_at", { ascending: true });
      setAnotacoes(data || []);
    }
    init();
  }, [cliente.id]);

  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:"smooth" }), 50);
  }, [anotacoes.length, aba]);

  const salvar = async () => {
    if (!texto.trim() || salvando) return;
    if (!agIdLocal) return;
    const textoEnvio = texto.trim();
    setSalvando(true);
    setTexto("");
    const tempId = `temp-${Date.now()}`;
    const tempItem: Anotacao = { id: tempId, cliente_id: cliente.id, usuario: nomeUsuario, conteudo: textoEnvio, created_at: new Date().toISOString(), tipo: "atualizacoes" };
    setAnotacoes(prev => [...prev, tempItem]);
    try {
      const { data, error } = await supabase.from("anotacoes").insert({
        agencia_id: agIdLocal, cliente_id: cliente.id, usuario: nomeUsuario,
        conteudo: textoEnvio, created_at: new Date().toISOString(), tipo: "atualizacoes",
      }).select().single();
      if (error) { setErroAnotacao(`Erro: ${error.message}`); setAnotacoes(prev=>prev.filter(a=>a.id!==tempId)); setTexto(textoEnvio); }
      else { setErroAnotacao(""); setAnotacoes(prev=>prev.map(a=>a.id===tempId?data:a)); }
    } finally { setSalvando(false); }
  };

  const filtradas = anotacoes.filter(a => a.tipo === aba);
  return (
    <div style={{ position:"fixed", right:0, top:0, bottom:0, width:"380px", background:"#141414", borderLeft:"1px solid #2e2e2e", zIndex:200, display:"flex", flexDirection:"column", boxShadow:"-4px 0 20px rgba(0,0,0,0.3)" }}>
      <div style={{ padding:"14px 16px", borderBottom:"1px solid #2e2e2e", display:"flex", alignItems:"center", gap:"10px", background:"#1a1a1a" }}>
        <div style={{ flex:1 }}>
          <p style={{ fontSize:"14px", fontWeight:"600", color:"#f0f0f0", margin:0 }}>{cliente.nome}</p>
          <p style={{ fontSize:"11px", color:"#606060", margin:0 }}>Atualizações e Log</p>
        </div>
        <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"#606060" }}><X size={16}/></button>
      </div>
      <div style={{ display:"flex", borderBottom:"1px solid #2e2e2e" }}>
        {[{key:"atualizacoes",label:"Atualizações"},{key:"log",label:"Log de Atividade"}].map(t=>(
          <button key={t.key} onClick={()=>setAba(t.key as any)} style={{ flex:1, padding:"10px", background:"none", border:"none", cursor:"pointer", fontSize:"12px", color:aba===t.key?"#29ABE2":"#606060", borderBottom:aba===t.key?"2px solid #29ABE2":"2px solid transparent", fontWeight:aba===t.key?"600":"400" }}>{t.label}</button>
        ))}
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"12px" }}>
        {!filtradas.length ? (
          <p style={{ color:"#606060", fontSize:"13px", textAlign:"center", marginTop:"40px" }}>{aba==="atualizacoes"?"Nenhuma atualização ainda.":"Nenhuma atividade registrada."}</p>
        ) : filtradas.map(a => (
          <div key={a.id} style={{ marginBottom:"14px" }}>
            {a.tipo === "log" ? (
              <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                <div style={{ width:"6px", height:"6px", borderRadius:"50%", background:"#3a3a3a", flexShrink:0 }}/>
                <p style={{ fontSize:"11px", color:"#505050", margin:0, flex:1 }}>{a.conteudo}</p>
                <span style={{ fontSize:"10px", color:"#3a3a3a", whiteSpace:"nowrap" }}>{new Date(a.created_at).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</span>
              </div>
            ) : (
              <div style={{ display:"flex", gap:"8px", alignItems:"flex-start" }}>
                <div style={{ width:"30px", height:"30px", borderRadius:"50%", background:"#29ABE2", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:"12px", fontWeight:"700", color:"#000" }}>{a.usuario.charAt(0).toUpperCase()}</div>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"4px" }}>
                    <span style={{ fontSize:"12px", fontWeight:"600", color:"#f0f0f0" }}>{a.usuario}</span>
                    <span style={{ fontSize:"10px", color:"#606060" }}>{new Date(a.created_at).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"})}</span>
                  </div>
                  <div style={{ background:"#1e1e1e", borderRadius:"4px 12px 12px 12px", padding:"8px 12px", border:"1px solid #2e2e2e" }}>
                    <p style={{ fontSize:"13px", color:"#f0f0f0", margin:0, whiteSpace:"pre-wrap", lineHeight:"1.5" }}>{a.conteudo}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef}/>
      </div>
      {aba==="atualizacoes" && (
        <div style={{ padding:"10px 12px", borderTop:"1px solid #2e2e2e", background:"#1a1a1a", display:"flex", gap:"8px", alignItems:"flex-end" }}>
          <textarea className="form-input" placeholder="Escreva uma atualização... (Enter para enviar)" value={texto}
            onChange={e=>setTexto(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();salvar();}}}
            style={{ resize:"none", minHeight:"40px", maxHeight:"120px", flex:1, margin:0, fontSize:"13px" }}/>
          <button onClick={salvar} disabled={salvando||!texto.trim()}
            style={{ background:texto.trim()?"#29ABE2":"#2e2e2e", border:"none", borderRadius:"8px", padding:"8px 12px", cursor:texto.trim()?"pointer":"default", color:texto.trim()?"#000":"#606060", flexShrink:0, display:"flex", alignItems:"center" }}>
            {salvando ? <span style={{fontSize:"10px"}}>...</span> : <Send size={14}/>}
          </button>
          {erroAnotacao && <p style={{color:"#ef4444",fontSize:"11px",margin:"4px 0 0",width:"100%"}}>{erroAnotacao}</p>}
        </div>
      )}
    </div>
  );
}

export default function ControleClientesPage() {
  const [clientes, setClientes] = useState<ControleCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [sort, setSort] = useState("data_entrada");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("asc");
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [subitens, setSubitens] = useState<Record<string,Subitem[]>>({});
  const [novoSubitem, setNovoSubitem] = useState<Record<string,string>>({});
  const [painelAberto, setPainelAberto] = useState<ControleCliente|null>(null);
  const [perfilAberto, setPerfilAberto] = useState<ControleCliente|null>(null);
  const [agId, setAgId] = useState("");
  const [usuarios, setUsuarios] = useState<string[]>([]);
  const [times, setTimes] = useState<string[]>([]);
  const [snapsMensais, setSnapsMensais] = useState<any[]>([]);
  const [churnsMes, setChurnsMes] = useState<any[]>([]);
  const [metaDiasInicio, setMetaDiasInicio] = useState<number>(() => {
    try { return parseInt(localStorage.getItem("meta_dias_inicio") || "10") || 10; } catch { return 10; }
  });
  const [editandoMeta, setEditandoMeta] = useState(false);
  const [colWidths, setColWidths] = useState<Record<string,number>>(() => Object.fromEntries(COLUNAS_PADRAO.map(c=>[c.key,c.w])));
  const [colunas, setColunas] = useState(() => {
    try {
      const salvo = localStorage.getItem("controle_colunas");
      return salvo ? JSON.parse(salvo) : COLUNAS_PADRAO;
    } catch { return COLUNAS_PADRAO; }
  });
  const [editandoHeader, setEditandoHeader] = useState<string|null>(null);
  const [cadastros, setCadastros] = useState<Cadastro[]>([]);
  const [cadastrosMap, setCadastrosMap] = useState<Record<string,Cadastro>>({});
  const [modalNovoCliente, setModalNovoCliente] = useState(false);
  const resizing = useRef<{key:string;startX:number;startW:number}|null>(null);

  const salvarColunas = (novas: typeof COLUNAS_PADRAO) => {
    setColunas(novas);
    try { localStorage.setItem("controle_colunas", JSON.stringify(novas)); } catch {}
  };

  const renomearColuna = (key: string, novoLabel: string) => {
    salvarColunas(colunas.map((c: any) => c.key === key ? { ...c, label: novoLabel } : c));
    setEditandoHeader(null);
  };

  const excluirColuna = (key: string) => {
    salvarColunas(colunas.filter((c: any) => c.key !== key));
  };

  const carregar = async () => {
    const id = await getAgenciaId();
    setAgId(id||"");
    const { data } = await supabase.from("controle_clientes").select("*").eq("agencia_id",id!).neq("status","saiu");
    setClientes(data||[]);
    const { data: churns } = await supabase.from("controle_clientes").select("data_churn").eq("agencia_id",id!).eq("status","saiu");
    setChurnsMes(churns||[]);
    const resSnap = await fetch(`/api/snapshots?agencia_id=${id}`);
    const jsonSnap = await resSnap.json();
    setSnapsMensais(jsonSnap.data||[]);
    const { data: users } = await supabase.from("configuracoes_usuarios").select("nome").eq("agencia_id",id!);
    const { data: tms } = await supabase.from("times").select("nome").eq("agencia_id",id!);
    setUsuarios(users?.map((u:any)=>u.nome)||[]);
    setTimes(tms?.map((t:any)=>t.nome)||[]);

    // Carregar cadastros para associação
    const { data: cads } = await supabase.from("cadastros_clientes").select("*").eq("agencia_id", id!);
    const lista = cads || [];
    setCadastros(lista);
    const mapa: Record<string,Cadastro> = {};
    lista.forEach((c: Cadastro) => { mapa[c.id] = c; });
    setCadastrosMap(mapa);

    setLoading(false);
  };

  // Auto-associar por nome ao carregar
  useEffect(() => {
    if (clientes.length && cadastros.length) {
      clientes.forEach(async (cliente) => {
        if (cliente.cadastro_id) return; // já vinculado
        const match = cadastros.find(c =>
          c.nome.toLowerCase().trim() === cliente.nome.toLowerCase().trim()
        );
        if (match) {
          await supabase.from("controle_clientes").update({ cadastro_id: match.id }).eq("id", cliente.id);
          setClientes(prev => prev.map(c => c.id === cliente.id ? { ...c, cadastro_id: match.id } : c));
        }
      });
    }
  }, [clientes.length, cadastros.length]);

  const atualizar = async (id: string, campo: string, valor: any, nomeCliente: string) => {
    const updates: any = { [campo]: valor };

    // Churn automático: grava data_churn = mês atual
    if (campo === "status" && valor === "saiu") {
      updates.data_churn = mesAtualStr();
    }

    await supabase.from("controle_clientes").update(updates).eq("id", id);
    setClientes(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));

    // Se virou churn, remove da lista visível após um tick
    if (campo === "status" && valor === "saiu") {
      setTimeout(() => setClientes(prev => prev.filter(c => c.id !== id)), 800);
    }

    try {
      const agIdAtual = agId || (await getAgenciaId()) || "";
      if (!agIdAtual) return;
      const { data: user } = await supabase.auth.getUser();
      const nomeUser = user?.user?.user_metadata?.nome||user?.user?.email?.split("@")[0]||"Usuário";
      const campoLabel: Record<string,string> = {
        status:"Status", consultor:"Consultor", gestor:"Gestor", squad:"Squad",
        investimento_mensal:"Investimento", data_entrada:"Data de Entrada",
        data_inicio_campanha:"Início Campanha", feed:"Feed", feedback:"Feedback",
        acao:"Ação", acao_feita:"Ação Feita", otimizacoes:"Otimizações", tarefas:"Tarefas",
      };
      const label = campoLabel[campo] || campo;
      await supabase.from("anotacoes").insert({
        agencia_id: agIdAtual, cliente_id: id, usuario: nomeUser,
        conteudo: `${nomeUser} alterou ${label} → "${valor}"`,
        tipo: "log", created_at: new Date().toISOString(),
      });
    } catch(e) { console.error("Log exceção:", e); }
  };

  const vincularCadastro = async (clienteId: string, cadastroId: string) => {
    await supabase.from("controle_clientes").update({ cadastro_id: cadastroId }).eq("id", clienteId);
    setClientes(prev => prev.map(c => c.id === clienteId ? { ...c, cadastro_id: cadastroId } : c));
    if (perfilAberto?.id === clienteId) {
      setPerfilAberto(prev => prev ? { ...prev, cadastro_id: cadastroId } : prev);
    }
  };

  const toggleExpandir = async (id: string) => {
    const novos = new Set(expandidos);
    if (novos.has(id)) { novos.delete(id); }
    else {
      novos.add(id);
      if (!subitens[id]) {
        const { data } = await supabase.from("subitens_clientes").select("*").eq("cliente_id",id).order("created_at");
        setSubitens(prev=>({...prev,[id]:data||[]}));
      }
    }
    setExpandidos(novos);
  };

  const adicionarSubitem = async (clienteId: string) => {
    const texto = novoSubitem[clienteId]?.trim();
    if (!texto) return;
    const { data } = await supabase.from("subitens_clientes").insert({
      cliente_id: clienteId, agencia_id: agId, texto, feito: false, created_at: new Date().toISOString(),
    }).select().single();
    if (data) {
      setSubitens(prev=>({...prev,[clienteId]:[...(prev[clienteId]||[]),data]}));
      setNovoSubitem(prev=>({...prev,[clienteId]:""}));
    }
  };

  const toggleSubitem = async (clienteId: string, subId: string, feito: boolean) => {
    await supabase.from("subitens_clientes").update({feito:!feito}).eq("id",subId);
    setSubitens(prev=>({...prev,[clienteId]:prev[clienteId].map(s=>s.id===subId?{...s,feito:!feito}:s)}));
  };

  const startResize = (key: string, e: React.MouseEvent) => {
    e.preventDefault();
    resizing.current = { key, startX: e.clientX, startW: colWidths[key] || 120 };
    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return;
      const newW = Math.max(60, resizing.current.startW + ev.clientX - resizing.current.startX);
      setColWidths(prev=>({...prev,[resizing.current!.key]:newW}));
    };
    const onUp = () => { resizing.current = null; document.removeEventListener("mousemove",onMove); document.removeEventListener("mouseup",onUp); };
    document.addEventListener("mousemove",onMove);
    document.addEventListener("mouseup",onUp);
  };

  useEffect(() => { carregar(); }, []);

  const filtrados = clientes
    .filter(c=>c.nome?.toLowerCase().includes(busca.toLowerCase()))
    .sort((a,b) => {
      let va=(a as any)[sort]||""; let vb=(b as any)[sort]||"";
      if (sort==="investimento_mensal"){va=Number(va);vb=Number(vb);}
      if (sortDir==="asc") return va>vb?1:-1;
      return va<vb?1:-1;
    });

  const painelLateralAberto = painelAberto || perfilAberto;

  return (
    <div className="animate-in">
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        .resize-handle{width:4px;cursor:col-resize;position:absolute;right:0;top:0;bottom:0;background:transparent;}
        .resize-handle:hover{background:#29ABE2;}
        .th-group:hover .th-actions{opacity:1!important;}
      `}</style>

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"20px" }}>
        <div>
          <div className="breadcrumb"><a href="/">Início</a><span>›</span><span className="current">Controle de Clientes</span></div>
          <h1 style={{ fontSize:"22px", fontWeight:"600" }}>Controle de Clientes</h1>
          <p style={{ fontSize:"13px", color:"#606060", marginTop:"4px" }}>{filtrados.length} clientes ativos</p>
        </div>
        <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
          <div style={{ position:"relative" }}>
            <Search size={13} style={{ position:"absolute", left:"10px", top:"50%", transform:"translateY(-50%)", color:"#606060" }}/>
            <input className="search-input" placeholder="Buscar cliente..." value={busca} onChange={e=>setBusca(e.target.value)} style={{ paddingLeft:"32px", width:"200px" }}/>
          </div>
          <select value={sort} onChange={e=>setSort(e.target.value)} style={{ background:"#1a1a1a", border:"1px solid #2e2e2e", borderRadius:"8px", padding:"7px 10px", color:"#f0f0f0", fontSize:"12px", cursor:"pointer" }}>
            {SORT_OPTS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <button onClick={()=>setSortDir(d=>d==="asc"?"desc":"asc")} className="btn-ghost" style={{ padding:"7px 10px", cursor:"pointer", fontSize:"12px" }}>
            {sortDir==="asc"?"↑ Crescente":"↓ Decrescente"}
          </button>
          <button onClick={carregar} className="btn-ghost" style={{ padding:"8px", cursor:"pointer" }}><RefreshCw size={14}/></button>
          <button onClick={()=>setModalNovoCliente(true)} style={{ background:"#29ABE2", border:"none", borderRadius:"8px", padding:"8px 14px", cursor:"pointer", color:"#000", fontWeight:"600", fontSize:"13px", display:"flex", alignItems:"center", gap:"6px" }}><Plus size={14}/> Novo Cliente</button>
        </div>
      </div>

      {/* KPIs */}
      {(() => {
        const hoje = new Date();
        const mesesNomes = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
        const mesAtualStr2 = `${mesesNomes[hoje.getMonth()]}/${hoje.getFullYear()}`;
        const mesPassadoIdx = hoje.getMonth()===0?11:hoje.getMonth()-1;
        const anoMesPassado = hoje.getMonth()===0?hoje.getFullYear()-1:hoje.getFullYear();
        const mesPassadoStr = `${mesesNomes[mesPassadoIdx]}/${anoMesPassado}`;
        const comData = clientes.filter(c => c.data_entrada && c.data_entrada.trim());
        const tempoMedioDias = comData.length > 0 ? comData.reduce((s, c) => {
          try {
            const entrada = new Date(c.data_entrada.includes("/") ? c.data_entrada.split("/").reverse().join("-") : c.data_entrada);
            return s + (hoje.getTime() - entrada.getTime()) / (1000*60*60*24*30);
          } catch { return s; }
        }, 0) / comData.length : 0;
        const ativos = clientes.filter(c=>c.status==="ativo");
        const pausados = clientes.filter(c=>c.status==="pausado");
        const entrada = clientes.filter(c=>c.status==="entrada");
        const basePassada = snapsMensais.find((s:any)=>s.mes_ano===mesPassadoStr)?.clientes_ativos || 0;
        const kpis = [
          { label:"Clientes Totais", value:clientes.length, cor:"#f0f0f0" },
          { label:"Clientes Ativos", value:ativos.length, cor:"#22c55e" },
          { label:"Pausados", value:pausados.length, cor:"#f59e0b" },
          { label:"Em Entrada", value:entrada.length, cor:"#eab308" },
          { label:`Base ${mesPassadoStr}`, value: basePassada || "—", cor:"#29ABE2" },
          { label:"Tempo Médio (meses)", value:tempoMedioDias > 0 ? tempoMedioDias.toFixed(1) : "—", cor:"#f0f0f0" },
          { label:`Churn ${mesAtualStr2}`, value: churnsMes.filter((c:any) => c.data_churn === mesAtualStr2).length, cor:"#ef4444" },
        ];
        return (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"12px", marginBottom:"20px" }}>
            {kpis.map(k=>(
              <div key={k.label} className="card" style={{ padding:"12px 16px" }}>
                <p style={{ fontSize:"11px", color:"#606060", margin:0 }}>{k.label}</p>
                <p style={{ fontSize:"20px", fontWeight:"700", color:k.cor, margin:0 }}>{k.value}</p>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Métrica: Dias para iniciar campanha */}
      {(() => {
        const hoje = new Date();
        const mesAtual = hoje.getMonth();
        const anoAtual = hoje.getFullYear();

        function parseData(d: string): Date | null {
          if (!d) return null;
          try {
            if (d.includes("/")) { const p = d.split("/"); return new Date(parseInt(p[2]), parseInt(p[1])-1, parseInt(p[0])); }
            return new Date(d);
          } catch { return null; }
        }

        // Clientes que iniciaram campanha no mês atual
        const iniciaram = clientes.filter(c => {
          const inicio = parseData(c.data_inicio_campanha);
          const entrada = parseData(c.data_entrada);
          return inicio && entrada && inicio.getMonth() === mesAtual && inicio.getFullYear() === anoAtual;
        });

        const diasPorCliente = iniciaram.map(c => {
          const inicio = parseData(c.data_inicio_campanha)!;
          const entrada = parseData(c.data_entrada)!;
          return { nome: c.nome, dias: Math.max(0, Math.round((inicio.getTime() - entrada.getTime()) / (1000*60*60*24))) };
        });

        const totalDias = diasPorCliente.reduce((s, c) => s + c.dias, 0);
        const media = iniciaram.length > 0 ? totalDias / iniciaram.length : 0;
        const percentMeta = metaDiasInicio > 0 ? Math.round((media / metaDiasInicio) * 100) : 0;

        // Cor do progresso: verde se abaixo da meta, amarelo se perto, vermelho se acima
        const corProgresso = media === 0 ? "#606060" : media <= metaDiasInicio * 0.5 ? "#22c55e" : media <= metaDiasInicio * 0.75 ? "#29ABE2" : media <= metaDiasInicio ? "#f59e0b" : "#ef4444";
        const labelProgresso = media === 0 ? "Sem dados" : media <= metaDiasInicio * 0.5 ? "Excelente" : media <= metaDiasInicio * 0.75 ? "Bom" : media <= metaDiasInicio ? "Atenção" : "Acima da meta";

        return (
          <div className="card" style={{ padding:"16px", marginBottom:"20px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"12px" }}>
              <div>
                <p style={{ fontSize:"12px", fontWeight:"600", color:"#606060", margin:"0 0 4px" }}>DIAS PARA INICIAR CAMPANHA</p>
                <p style={{ fontSize:"11px", color:"#505050", margin:0 }}>Média do mês atual — {iniciaram.length} cliente{iniciaram.length !== 1 ? "s" : ""} iniciaram</p>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                <span style={{ fontSize:"11px", color:"#606060" }}>Meta:</span>
                {editandoMeta ? (
                  <input type="number" min="1" value={metaDiasInicio} autoFocus
                    onChange={e => { const v = parseInt(e.target.value) || 10; setMetaDiasInicio(v); localStorage.setItem("meta_dias_inicio", String(v)); }}
                    onBlur={() => setEditandoMeta(false)}
                    onKeyDown={e => { if (e.key === "Enter") setEditandoMeta(false); }}
                    style={{ width:"50px", background:"#222", border:"1px solid #29ABE2", borderRadius:"4px", padding:"2px 6px", color:"#f0f0f0", fontSize:"12px", textAlign:"center" }}/>
                ) : (
                  <button onClick={() => setEditandoMeta(true)} style={{ background:"#1a1a1a", border:"1px solid #2e2e2e", borderRadius:"4px", padding:"2px 8px", color:"#f0f0f0", fontSize:"12px", cursor:"pointer" }}>
                    {metaDiasInicio} dias
                  </button>
                )}
              </div>
            </div>

            <div style={{ display:"flex", alignItems:"flex-end", gap:"16px", marginBottom:"12px" }}>
              <div>
                <p style={{ fontSize:"32px", fontWeight:"700", color:corProgresso, margin:0, lineHeight:1 }}>
                  {media > 0 ? media.toFixed(1) : "—"}
                </p>
                <p style={{ fontSize:"11px", color:"#606060", margin:"4px 0 0" }}>dias (média)</p>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"4px" }}>
                  <span style={{ fontSize:"11px", fontWeight:"600", color:corProgresso }}>{labelProgresso}</span>
                  <span style={{ fontSize:"11px", color:"#606060" }}>{percentMeta}% da meta</span>
                </div>
                <div style={{ height:"8px", background:"#1a1a1a", borderRadius:"4px", overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${Math.min(percentMeta, 100)}%`, background:corProgresso, borderRadius:"4px", transition:"width 0.3s" }}/>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:"2px" }}>
                  <span style={{ fontSize:"9px", color:"#404040" }}>0</span>
                  <span style={{ fontSize:"9px", color:"#404040" }}>{Math.round(metaDiasInicio*0.5)}d (50%)</span>
                  <span style={{ fontSize:"9px", color:"#404040" }}>{Math.round(metaDiasInicio*0.75)}d (75%)</span>
                  <span style={{ fontSize:"9px", color:"#404040" }}>{metaDiasInicio}d (meta)</span>
                </div>
              </div>
            </div>

            {/* Detalhamento por cliente */}
            {diasPorCliente.length > 0 && (
              <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>
                {diasPorCliente.map(c => (
                  <span key={c.nome} style={{ fontSize:"11px", padding:"2px 8px", borderRadius:"12px", background:c.dias <= metaDiasInicio ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", color:c.dias <= metaDiasInicio ? "#22c55e" : "#ef4444", border:`1px solid ${c.dias <= metaDiasInicio ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}` }}>
                    {c.nome}: {c.dias}d
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Tabela */}
      <div style={{ overflowX:"auto", border:"1px solid #2e2e2e", borderRadius:"12px", marginRight:painelLateralAberto?"400px":"0", transition:"margin 0.2s" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"12px", tableLayout:"fixed" }}>
          <thead>
            <tr style={{ background:"#1a1a1a", borderBottom:"1px solid #2e2e2e" }}>
              <th style={{ width:"30px", padding:"10px 6px" }}></th>
              <th style={{ padding:"10px 12px", textAlign:"left", fontSize:"11px", color:"#606060", fontWeight:"600", position:"sticky", left:0, background:"#1a1a1a", zIndex:2, width:"160px", whiteSpace:"nowrap" }}>NOME</th>
              {/* Coluna Info. Cliente */}
              <th style={{ padding:"10px 8px", textAlign:"center", fontSize:"11px", color:"#606060", fontWeight:"600", width:"60px", whiteSpace:"nowrap" }}>INFO.</th>
              {colunas.map((col: any)=>(
                <th key={col.key} className="th-group" style={{ padding:"10px 8px", textAlign:"left", fontSize:"11px", color:"#606060", fontWeight:"600", width:colWidths[col.key]||col.w, position:"relative", whiteSpace:"nowrap", overflow:"hidden", borderLeft:"1px solid #29ABE220" }}>
                  {editandoHeader === col.key ? (
                    <input autoFocus defaultValue={col.label}
                      onBlur={e => renomearColuna(col.key, e.target.value)}
                      onKeyDown={e => { if(e.key==="Enter") renomearColuna(col.key, (e.target as HTMLInputElement).value); if(e.key==="Escape") setEditandoHeader(null); }}
                      style={{ background:"#0f0f0f", border:"1px solid #29ABE2", borderRadius:"4px", padding:"2px 6px", color:"#f0f0f0", fontSize:"11px", width:"80%", outline:"none" }}/>
                  ) : (
                    <div style={{ display:"flex", alignItems:"center", gap:"4px", paddingRight:"20px" }}>
                      <span>{col.label}</span>
                      <span className="th-actions" style={{ opacity:0, display:"flex", gap:"2px", transition:"opacity 0.15s" }}>
                        <button onClick={()=>setEditandoHeader(col.key)} style={{ background:"none", border:"none", cursor:"pointer", color:"#404040", padding:"1px" }} title="Renomear">
                          <Pencil size={10}/>
                        </button>
                        <button onClick={()=>excluirColuna(col.key)} style={{ background:"none", border:"none", cursor:"pointer", color:"#ef444480", padding:"1px" }} title="Excluir coluna">
                          <Trash2 size={10}/>
                        </button>
                      </span>
                    </div>
                  )}
                  <div className="resize-handle" onMouseDown={e=>startResize(col.key,e)}/>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={colunas.length+4} style={{ textAlign:"center", color:"#606060", padding:"48px" }}>Carregando...</td></tr>
            ) : !filtrados.length ? (
              <tr><td colSpan={colunas.length+4} style={{ textAlign:"center", color:"#606060", padding:"48px" }}>Nenhum cliente encontrado.</td></tr>
            ) : filtrados.map((c,idx)=>(
              <>
              <tr key={c.id} style={{ borderBottom:"1px solid #29ABE230", background:idx%2===0?"transparent":"#0a0a0a" }}>
                <td style={{ padding:"4px 6px", textAlign:"center" }}>
                  <button onClick={()=>toggleExpandir(c.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#606060", padding:"2px" }}>
                    {expandidos.has(c.id)?<ChevronDown size={14}/>:<ChevronRight size={14}/>}
                  </button>
                </td>
                <td style={{ padding:"4px 8px 4px 12px", position:"sticky", left:0, background:idx%2===0?"#141414":"#111", zIndex:1, whiteSpace:"nowrap", width:"200px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                    <span style={{ fontWeight:"600", color:"#f0f0f0", overflow:"hidden", textOverflow:"ellipsis", flex:1 }}>{c.nome}</span>
                    <button onClick={()=>{ setPainelAberto(painelAberto?.id===c.id?null:c); setPerfilAberto(null); }}
                      style={{ background:"none", border:"none", cursor:"pointer", color:painelAberto?.id===c.id?"#29ABE2":"#404040", padding:"2px", flexShrink:0 }}
                      title="Atualizações">
                      <MessageSquare size={13}/>
                    </button>
                  </div>
                </td>
                {/* Célula Info. Cliente */}
                <td style={{ padding:"2px 6px", textAlign:"center", width:"60px" }}>
                  <button onClick={()=>{ setPerfilAberto(perfilAberto?.id===c.id?null:c); setPainelAberto(null); }}
                    style={{ background:"none", border:"none", cursor:"pointer", padding:"2px" }}
                    title="Ver perfil do cliente">
                    <UserCircle2 size={18} color={c.cadastro_id ? "#29ABE2" : (perfilAberto?.id===c.id ? "#29ABE2" : "#3a3a3a")}/>
                  </button>
                </td>
                {colunas.map((col: any)=>(
                  <td key={col.key} style={{ padding:"2px 6px", overflow:"hidden", width:colWidths[col.key]||col.w, borderLeft:"1px solid #29ABE215", whiteSpace:"nowrap", maxWidth:colWidths[col.key]||col.w, height:"36px" }}>
                    {col.key==="status" ? (
                      <StatusSelect valor={c.status} onSave={v=>atualizar(c.id,"status",v,c.nome)}/>
                    ) : col.key==="head_squad"||col.key==="consultor"||col.key==="gestor" ? (
                      <select value={(c as any)[col.key]||""} onChange={e=>atualizar(c.id,col.key,e.target.value,c.nome)}
                        style={{ background:"#1a1a1a", border:"1px solid #2e2e2e", borderRadius:"4px", padding:"3px 6px", color:"#f0f0f0", fontSize:"12px", cursor:"pointer", width:"100%" }}>
                        <option value="">—</option>
                        {usuarios.length?usuarios.map(u=><option key={u} value={u}>{u}</option>):<option value={(c as any)[col.key]}>{(c as any)[col.key]}</option>}
                      </select>
                    ) : col.key==="squad" ? (
                      <select value={(c as any)[col.key]||""} onChange={e=>atualizar(c.id,col.key,e.target.value,c.nome)}
                        style={{ background:"#1a1a1a", border:"1px solid #2e2e2e", borderRadius:"4px", padding:"3px 6px", color:"#f0f0f0", fontSize:"12px", cursor:"pointer", width:"100%" }}>
                        <option value="">—</option>
                        {times.length?times.map(t=><option key={t} value={t}>{t}</option>):<option value={(c as any)[col.key]}>{(c as any)[col.key]}</option>}
                      </select>
                    ) : col.key==="data_entrada"||col.key==="data_inicio_campanha" ? (
                      <CelulaEditavel valor={(c as any)[col.key]||""} tipo="date" onSave={v=>atualizar(c.id,col.key,v,c.nome)}/>
                    ) : col.key==="investimento_mensal" ? (
                      <CelulaEditavel valor={c.investimento_mensal?String(c.investimento_mensal):""} onSave={v=>atualizar(c.id,col.key,Number(v.replace(/\D/g,"")),c.nome)}/>
                    ) : (
                      <CelulaEditavel valor={(c as any)[col.key]||""} onSave={v=>atualizar(c.id,col.key,v,c.nome)}/>
                    )}
                  </td>
                ))}
              </tr>
              {expandidos.has(c.id) && (
                <tr key={`sub-${c.id}`} style={{ background:"#080808", borderBottom:"1px solid #1e1e1e" }}>
                  <td></td>
                  <td colSpan={colunas.length+3} style={{ padding:"8px 16px 12px 40px" }}>
                    <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                      {(subitens[c.id]||[]).map(s=>(
                        <div key={s.id} style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                          <div onClick={()=>toggleSubitem(c.id,s.id,s.feito)} style={{ width:"16px", height:"16px", borderRadius:"3px", border:`2px solid ${s.feito?"#29ABE2":"#3a3a3a"}`, background:s.feito?"#29ABE2":"transparent", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                            {s.feito&&<Check size={10} color="#000"/>}
                          </div>
                          <span style={{ fontSize:"12px", color:s.feito?"#606060":"#f0f0f0", textDecoration:s.feito?"line-through":"none" }}>{s.texto}</span>
                        </div>
                      ))}
                      <div style={{ display:"flex", alignItems:"center", gap:"6px", marginTop:"4px" }}>
                        <div style={{ width:"16px", height:"16px", borderRadius:"3px", border:"2px dashed #3a3a3a", flexShrink:0 }}/>
                        <input placeholder="+ Adicionar subitem..." value={novoSubitem[c.id]||""}
                          onChange={e=>setNovoSubitem(prev=>({...prev,[c.id]:e.target.value}))}
                          onKeyDown={e=>{if(e.key==="Enter")adicionarSubitem(c.id);}}
                          style={{ background:"transparent", border:"none", outline:"none", color:"#606060", fontSize:"12px", flex:1 }}/>
                        {novoSubitem[c.id]&&(
                          <button onClick={()=>adicionarSubitem(c.id)} style={{ background:"#29ABE2", border:"none", borderRadius:"4px", padding:"2px 8px", cursor:"pointer", color:"#000", fontSize:"11px" }}>Adicionar</button>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {modalNovoCliente && <ModalNovoCliente agId={agId} cadastros={cadastros} onClose={()=>setModalNovoCliente(false)} onSave={()=>{setModalNovoCliente(false);carregar();}}/>}
      {painelAberto && <PainelLateral cliente={painelAberto} onClose={()=>setPainelAberto(null)}/>}
      {perfilAberto && (
        <PainelPerfil
          cliente={perfilAberto}
          cadastro={perfilAberto.cadastro_id ? cadastrosMap[perfilAberto.cadastro_id] || null : null}
          todos_cadastros={cadastros}
          onClose={()=>setPerfilAberto(null)}
          onVincular={(cadastroId)=>vincularCadastro(perfilAberto.id, cadastroId)}
        />
      )}
    </div>
  );
}
