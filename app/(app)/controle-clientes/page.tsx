"use client";

import { Faixa } from "@/components/ui/Canvas";
import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Search, RefreshCw, ChevronDown, ChevronRight, ChevronUp, MessageSquare, X, Send, Check, UserCircle2, Pencil, Trash2, Plus, FileText, ArrowUp, ArrowDown, BarChart2, AlertTriangle, ExternalLink } from "lucide-react";
import ModalContrato from "@/components/controle/ModalContrato";
import ModalNovoCliente from "@/components/controle/ModalNovoCliente";
import { supabase, getAgenciaId, gerarLancamentosRecorrencia } from "@/lib/hooks";

interface ControleCliente {
  id: string; nome: string; status: string; instagram: string; oferta: string;
  data_entrada: string; data_inicio_campanha: string; agendamentos: string;
  faturamento_medio: string; progresso_gestor: string; progresso_consultor: string;
  feed: string; feedback: string; sdr: string; head_squad: string;
  consultor: string; gestor: string; squad: string; investimento_mensal: number;
  ultimo_aumento: string; acao: string; acao_feita: string; otimizacoes: string;
  tarefas: string; datas_otimizacoes: string; motivo: string; razao_nome: string;
  grupo: string; created_at: string; cadastro_id?: string; ordem?: number;
  renovou?: boolean | null;
  relatorio_id?: string; link_planilha?: string;
  uti?: boolean;
}
interface Relatorio { id: string; nome: string; nome_cliente: string; ativo: boolean; }
interface AlertaSaldo { id: string; nome_cliente: string; ad_account_id: string; ativo: boolean; }
interface Subitem { id: string; cliente_id: string; texto: string; feito: boolean; created_at: string; }
interface Anotacao { id: string; cliente_id: string; usuario: string; conteudo: string; created_at: string; tipo: string; }
interface Cadastro {
  id: string; nome: string; cnpj: string; cpf: string; rg: string;
  endereco_empresa: string; endereco_pessoal: string; email: string;
  investimento_anuncios: string; ticket_micro_laser: string;
  regiao_anunciar: string; faturamento_medio: string; login_facebook: string; criado_em: string;
}

function DashboardVincular({ clienteId, clienteNome, relatorioId, relatorios, onVincular }: {
  clienteId: string; clienteNome: string; relatorioId?: string; relatorios: Relatorio[];
  onVincular: (relId: string | null) => void;
}) {
  const [trocando, setTrocando] = useState(false);
  const [busca, setBusca] = useState("");
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (trocando && wrapRef.current) {
      const r = wrapRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + 2, left: r.left, width: Math.max(r.width, 240) });
    } else if (!trocando) {
      setDropPos(null);
    }
  }, [trocando]);

  const fechar = () => { setDropPos(null); setTrocando(false); setBusca(""); };

  if (!relatorioId && !trocando) {
    return (
      <button onClick={() => setTrocando(true)} className="cc-ghost" title="Vincular um relatório da Meta">
        + Vincular
      </button>
    );
  }

  if (relatorioId && !trocando) {
    return (
      <div style={{ display:"flex", alignItems:"center", gap:"4px" }}>
        <a href={`/relatorios-meta/dashboard?id=${relatorioId}&tab=performance`} target="_blank" rel="noopener"
          style={{ display:"inline-flex", alignItems:"center", gap:"4px", background:"rgba(41,171,226,0.15)", color:"var(--brand)", border:"none", borderRadius:"4px", padding:"4px 10px", fontSize:"11px", fontWeight:600, cursor:"pointer", textDecoration:"none", whiteSpace:"nowrap" }}>
          <BarChart2 size={12}/> Performance
        </a>
        <button onClick={() => setTrocando(true)} title="Trocar relatório"
          style={{ background:"none", border:"1px solid var(--border)", borderRadius:"4px", padding:"2px 6px", cursor:"pointer", color:"var(--text-secondary)", fontSize:"10px" }}>
          ⇄
        </button>
      </div>
    );
  }

  const filtered = busca
    ? relatorios.filter(r => (r.nome_cliente || r.nome || "").toLowerCase().includes(busca.toLowerCase()))
    : relatorios;

  const dropdown = dropPos ? createPortal(
    <div style={{ position:"fixed", top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex:999999, background:"var(--card-bg)", border:"1px solid var(--border)", borderRadius:"6px", maxHeight:"260px", overflowY:"auto", boxShadow:"0 8px 32px rgba(0,0,0,0.9)" }}>
      {trocando && (
        <button onMouseDown={() => { onVincular(null); setTrocando(false); setBusca(""); setDropPos(null); }}
          style={{ display:"block", width:"100%", padding:"8px 12px", background:"none", border:"none", cursor:"pointer", color:"var(--alert-text)", fontSize:"11px", textAlign:"left", borderBottom:"1px solid var(--border)" }}>
          Desvincular
        </button>
      )}
      {filtered.slice(0, 40).map(r => (
        <button key={r.id} onMouseDown={() => { onVincular(r.id); setTrocando(false); setBusca(""); setDropPos(null); }}
          style={{ display:"block", width:"100%", padding:"8px 12px", background:"none", border:"none", cursor:"pointer", color:"var(--navy)", fontSize:"11px", textAlign:"left" }}
          onMouseEnter={e => e.currentTarget.style.background="var(--hover-row)"}
          onMouseLeave={e => e.currentTarget.style.background="none"}>
          {r.nome_cliente || r.nome}
        </button>
      ))}
      {filtered.length === 0 && <p style={{ color:"var(--text-secondary)", fontSize:"11px", padding:"8px 12px", margin:0 }}>Nenhum resultado</p>}
    </div>,
    document.body
  ) : null;

  return (
    <>
      <div ref={wrapRef} style={{ minWidth:"140px" }}>
        <input
          autoFocus={trocando}
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar relatório..."
          onBlur={() => setTimeout(fechar, 200)}
          style={{ width:"100%", background:"var(--card-bg)", border:"1px solid rgba(28,108,166,0.25)", borderRadius:"4px", padding:"4px 6px", color:"var(--navy)", fontSize:"11px", boxSizing:"border-box" as any }}
        />
      </div>
      {dropdown}
    </>
  );
}

const STATUS_OPTS = [
  { value:"ativo", label:"Ativo", cor:"var(--success)" },
  { value:"pausado", label:"Pausado", cor:"var(--caution-text)" },
  { value:"saiu", label:"Churn", cor:"var(--alert-text)" },
  { value:"entrada", label:"Entrada", cor:"#C2620E" /* warning */ },
  { value:"debito", label:"Em Débito", cor:"#C2620E" },
  { value:"renovar", label:"Renovar", cor:"var(--brand)" },
];

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function mesAtualStr() {
  const d = new Date();
  return `${MESES[d.getMonth()]}/${d.getFullYear()}`;
}

const COLUNAS_PADRAO = [
  { key:"status", label:"Status", w:110 },
  { key:"regiao_anunciar", label:"Região", w:140 },
  { key:"data_entrada", label:"Data Entrada", w:120 },
  { key:"data_inicio_campanha", label:"Início Camp.", w:120 },
  { key:"renovacao", label:"Renovação", w:180 },
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
  { key:"fixados", label:"Fixados", w:80 },
  { key:"dashboard", label:"Dashboard", w:100 },
  { key:"link_planilha", label:"Planilha", w:100 },
  { key:"instagram_link", label:"Instagram", w:100 },
  { key:"oferta", label:"Oferta", w:80 },
  { key:"resposta_planilha", label:"Resp. Planilha", w:120 },
  { key:"acao_atual", label:"Ação Atual", w:160 },
  { key:"roas_mes", label:"ROAS (mês ant.)", w:110 },
];

const SORT_OPTS = [
  { value:"ordem", label:"Manual (Arrastar)" },
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

function parseData(d: string): Date | null {
  if (!d) return null;
  const limpo = d.trim().split(" ")[0].split("T")[0];
  if (limpo.includes("/")) {
    const p = limpo.split("/");
    if (p.length === 3) return new Date(Number(p[2]), Number(p[1])-1, Number(p[0]));
  }
  if (limpo.match(/^\d{4}-\d{2}-\d{2}$/)) return new Date(limpo + "T12:00:00");
  return null;
}

function iniciouAntesMesAtual(dataInicio: string): boolean {
  const inicio = parseData(dataInicio);
  if (!inicio) return false;
  const hoje = new Date();
  const inicioMesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  return inicio < inicioMesAtual;
}

function CelulaRenovacao({ cliente, onRenovou }: { cliente: ControleCliente; onRenovou: (val: boolean) => void }) {
  const inicio = parseData(cliente.data_inicio_campanha);
  if (!inicio) return <span style={{ fontSize:"11px", color:"var(--text-secondary)" }}>Sem data</span>;

  const hoje = new Date();
  hoje.setHours(0,0,0,0);
  const fimTrimestre = new Date(inicio);
  fimTrimestre.setDate(fimTrimestre.getDate() + 90);

  const diffMs = fimTrimestre.getTime() - hoje.getTime();
  const diasRestantes = Math.ceil(diffMs / (1000*60*60*24));
  const diasPassados = Math.floor((hoje.getTime() - inicio.getTime()) / (1000*60*60*24));
  const progresso = Math.min(100, Math.max(0, Math.round((diasPassados / 90) * 100)));

  // Já passou do 1º trimestre
  if (diasRestantes <= 0) {
    // Ainda não decidiu
    if (cliente.renovou === null || cliente.renovou === undefined) {
      return (
        <div style={{ display:"flex", gap:"4px" }}>
          <button onClick={() => onRenovou(true)}
            style={{ flex:1, padding:"3px 6px", borderRadius:"4px", border:"1px solid rgba(30,107,82,0.3)", background:"rgba(30,107,82,0.1)", color:"var(--success)", fontSize:"10px", cursor:"pointer", fontWeight:"600" }}>
            Renovou
          </button>
          <button onClick={() => onRenovou(false)}
            style={{ flex:1, padding:"3px 6px", borderRadius:"4px", border:"1px solid rgba(180,35,24,0.3)", background:"rgba(180,35,24,0.1)", color:"var(--alert-text)", fontSize:"10px", cursor:"pointer", fontWeight:"600" }}>
            Não
          </button>
        </div>
      );
    }
    // Não renovou
    if (cliente.renovou === false) {
      return <span style={{ fontSize:"11px", color:"var(--alert-text)", fontWeight:"600" }}>Não renovou</span>;
    }
    // Renovou — mostrar tempo total
    const mesesTotal = Math.floor(diasPassados / 30);
    const diasExtra = diasPassados % 30;
    return (
      <span style={{ fontSize:"11px", color:"var(--success)", fontWeight:"600" }}>
        {mesesTotal > 0 ? `${mesesTotal} ${mesesTotal===1?"mês":"meses"}` : ""}
        {mesesTotal > 0 && diasExtra > 0 ? " e " : ""}
        {diasExtra > 0 || mesesTotal === 0 ? `${diasExtra} dias` : ""}
      </span>
    );
  }

  // No 1º trimestre — barra de progresso
  const cor = diasRestantes > 30 ? "var(--success)" : diasRestantes > 15 ? "var(--caution-text)" : "var(--alert-text)";
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"2px" }}>
      <div style={{ height:"6px", background:"var(--card-bg)", borderRadius:"3px", overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${progresso}%`, background:cor, borderRadius:"3px", transition:"width 0.3s" }}/>
      </div>
      <span style={{ fontSize:"10px", color:cor, fontWeight:"500" }}>
        {diasRestantes} dias restantes
      </span>
    </div>
  );
}

function CelulaEditavel({ valor, onSave, tipo="text", placeholder }: { valor: string; onSave: (v: string) => void; tipo?: string; placeholder?: string }) {
  const [editando, setEditando] = useState(false);
  const [v, setV] = useState(valor||"");
  if (editando && tipo === "date") return (
    <input type="date" autoFocus defaultValue={v}
      onBlur={e => { setEditando(false); onSave(e.target.value); }}
      onChange={e => setV(e.target.value)}
      style={{ background:"var(--card-bg)", border:"1px solid var(--brand)", borderRadius:"4px", padding:"3px 6px", color:"var(--navy)", fontSize:"12px", width:"130px" }}/>
  );
  if (editando) return (
    <input autoFocus value={v} onChange={e => setV(e.target.value)}
      onBlur={() => { setEditando(false); onSave(v); }}
      onKeyDown={e => { if(e.key==="Enter"){setEditando(false);onSave(v);} if(e.key==="Escape"){setEditando(false);setV(valor||"");} }}
      style={{ background:"var(--card-bg)", border:"1px solid var(--brand)", borderRadius:"4px", padding:"3px 6px", color:"var(--navy)", fontSize:"12px", width:"100%", minWidth:"60px" }}/>
  );
  return (
    <span onClick={()=>setEditando(true)} title="Clique para editar"
      style={{ cursor:"pointer", padding:"3px 4px", borderRadius:"4px", display:"block", minHeight:"22px", fontSize:"12px", color:v?"var(--navy)":placeholder?"var(--text-secondary)":"var(--hover-row)" }}>
      {tipo==="date" ? formatarData(v) : (v || placeholder || "—")}
    </span>
  );
}

function CelulaInstagram({ valor, onSave }: { valor: string; onSave: (v: string) => void }) {
  const [editando, setEditando] = useState(false);
  const [v, setV] = useState(valor||"");
  if (editando) return (
    <input autoFocus value={v} onChange={e=>setV(e.target.value)}
      onBlur={()=>{ setEditando(false); onSave(v); }}
      onKeyDown={e=>{ if(e.key==="Enter"){setEditando(false);onSave(v);} if(e.key==="Escape"){setEditando(false);setV(valor||"");} }}
      placeholder="@usuario"
      style={{ background:"var(--card-bg)", border:"1px solid #E1306C" /* instagram */, borderRadius:"4px", padding:"3px 6px", color:"var(--navy)", fontSize:"12px", width:"100%", minWidth:"60px" }}/>
  );
  if (valor) {
    const handle = valor.replace(/^.*instagram\.com\//,"").replace(/^@/,"").replace(/\/$/,"");
    const href = valor.startsWith("http") ? valor : `https://instagram.com/${handle}`;
    return (
      <div style={{ display:"flex", alignItems:"center", gap:"4px", overflow:"hidden" }}>
        <a href={href} target="_blank" rel="noopener"
          style={{ color:"#E1306C" /* instagram */, fontSize:"12px", fontWeight:600, textDecoration:"none", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>
          @{handle}
        </a>
        <span onClick={()=>setEditando(true)} title="Editar Instagram"
          style={{ cursor:"pointer", color:"#555", fontSize:"11px", flexShrink:0, lineHeight:1 }}>✏️</span>
      </div>
    );
  }
  return (
    <span onClick={()=>setEditando(true)} title="Clique para editar"
      style={{ cursor:"pointer", padding:"3px 4px", borderRadius:"4px", display:"block", minHeight:"22px", fontSize:"12px", color:"var(--text-secondary)" }}>
      @usuario
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
      <button ref={btnRef} onClick={handleOpen} className="cc-status" style={{ ["--st" as any]: opt.cor }}>
        <span className="cc-status-dot"/>
        <span>{opt.label}</span>
      </button>
      {open && (
        <>
          <div onClick={()=>setOpen(false)} style={{ position:"fixed", inset:0, zIndex:9998 }}/>
          <div style={{ position:"fixed", top:pos.top, left:pos.left, background:"var(--card-bg)", border:"1px solid var(--border)", borderRadius:"8px", zIndex:9999, minWidth:"140px", overflow:"hidden", boxShadow:"0 8px 24px rgba(0,0,0,0.7)" }}>
            {STATUS_OPTS.map(s => (
              <button key={s.value} onClick={e=>handleSelect(e,s.value)}
                style={{ display:"flex", alignItems:"center", gap:"8px", padding:"9px 14px", width:"100%", background: s.value===valor?"var(--hover-row)":"none", border:"none", cursor:"pointer", color:s.cor, fontSize:"12px" }}
                onMouseEnter={e=>(e.currentTarget.style.background="var(--hover-row)")}
                onMouseLeave={e=>(e.currentTarget.style.background=s.value===valor?"var(--hover-row)":"none")}>
                <span style={{ width:"8px", height:"8px", borderRadius:"50%", background:s.cor }}/>{s.label}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function PainelPerfil({ cliente, cadastro, todos_cadastros, relatorios, alertas, onClose, onVincular, onVincularRelatorio, onVincularAlerta }: {
  cliente: ControleCliente;
  cadastro: Cadastro | null;
  todos_cadastros: Cadastro[];
  relatorios: Relatorio[];
  alertas: AlertaSaldo[];
  onClose: () => void;
  onVincular: (cadastroId: string) => void;
  onVincularRelatorio: (relatorioId: string | null) => void;
  onVincularAlerta: (alertaId: string, nome: string, ativo: boolean) => void;
}) {
  const [buscaCadastro, setBuscaCadastro] = useState("");
  const [mostraBusca, setMostraBusca] = useState(false);
  const [modalContrato, setModalContrato] = useState(false);
  const [senhaDecrypt, setSenhaDecrypt] = useState("");
  const [senhaVisivel, setSenhaVisivel] = useState(false);

  // Descriptografar senha ao vincular cadastro
  useEffect(() => {
    if (cadastro?.id) {
      setSenhaDecrypt(""); setSenhaVisivel(false);
      fetch("/api/cadastros/senha", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cadastro.id }),
      }).then(r => r.json()).then(d => setSenhaDecrypt(d.senha || "—")).catch(() => setSenhaDecrypt("Erro"));
    }
  }, [cadastro?.id]);

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
    { label: "Senha Facebook", key: "_senha_facebook" },
  ];
  return (
    <div style={{ position:"fixed", right:0, top:0, bottom:0, width:"400px", background:"var(--card-bg)", borderLeft:"1px solid var(--border)", zIndex:200, display:"flex", flexDirection:"column", boxShadow:"-4px 0 20px rgba(0,0,0,0.3)" }}>
      <div style={{ padding:"14px 16px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", gap:"10px", background:"var(--card-bg)" }}>
        <UserCircle2 size={20} color="var(--brand)"/>
        <div style={{ flex:1 }}>
          <p style={{ fontSize:"14px", fontWeight:"600", color:"var(--navy)", margin:0 }}>{cliente.nome}</p>
          <p style={{ fontSize:"11px", color:"var(--text-secondary)", margin:0 }}>Perfil do Cliente</p>
        </div>
        <button onClick={()=>setModalContrato(true)} style={{ background:"rgba(28,108,166,0.08)", border:"1px solid rgba(28,108,166,0.25)", borderRadius:"6px", padding:"5px 10px", cursor:"pointer", color:"var(--brand)", fontSize:"11px", display:"flex", alignItems:"center", gap:"4px" }}><FileText size={12}/> Contrato</button>
        <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-secondary)" }}><X size={16}/></button>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"16px" }}>
        {cadastro ? (
          <>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px" }}>
              <span style={{ fontSize:"11px", color:"var(--success)", background:"rgba(30,107,82,0.1)", padding:"3px 8px", borderRadius:"10px" }}>✓ Cadastro vinculado</span>
              <button onClick={()=>setMostraBusca(v=>!v)}
                style={{ background:"none", border:"1px solid var(--border)", borderRadius:"6px", padding:"4px 10px", cursor:"pointer", color:"var(--text-secondary)", fontSize:"11px" }}>
                Trocar
              </button>
            </div>
            {mostraBusca && (
              <div style={{ marginBottom:"16px" }}>
                <input value={buscaCadastro} onChange={e=>setBuscaCadastro(e.target.value)}
                  placeholder="Buscar cadastro..."
                  style={{ width:"100%", background:"var(--card-bg)", border:"1px solid var(--border)", borderRadius:"6px", padding:"8px 10px", color:"var(--navy)", fontSize:"13px", boxSizing:"border-box" as const }}/>
                <div style={{ maxHeight:"160px", overflowY:"auto", marginTop:"4px", border:"1px solid var(--border)", borderRadius:"6px", background:"var(--card-bg)" }}>
                  {filtrados.map(c=>(
                    <button key={c.id} onClick={()=>{onVincular(c.id);setMostraBusca(false);}}
                      style={{ display:"block", width:"100%", padding:"8px 12px", background:"none", border:"none", cursor:"pointer", color:"var(--navy)", fontSize:"12px", textAlign:"left" }}
                      onMouseEnter={e=>e.currentTarget.style.background="var(--hover-row)"}
                      onMouseLeave={e=>e.currentTarget.style.background="none"}>
                      {c.nome}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {campos.map(campo=>(
              <div key={campo.key} style={{ marginBottom:"12px" }}>
                <p style={{ fontSize:"10px", color:"var(--text-secondary)", margin:"0 0 2px", textTransform:"uppercase" }}>{campo.label}</p>
                {campo.key === "_senha_facebook" ? (
                  <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                    <p style={{ fontSize:"13px", color:"var(--navy)", margin:0, wordBreak:"break-word" }}>
                      {senhaVisivel ? senhaDecrypt || "—" : "••••••••"}
                    </p>
                    <button onClick={()=>setSenhaVisivel(!senhaVisivel)}
                      style={{ background:"none", border:"1px solid var(--border)", borderRadius:"4px", padding:"2px 8px", cursor:"pointer", color:"var(--text-secondary)", fontSize:"11px" }}>
                      {senhaVisivel ? "Ocultar" : "Ver"}
                    </button>
                    {senhaVisivel && senhaDecrypt && senhaDecrypt !== "—" && (
                      <button onClick={()=>navigator.clipboard.writeText(senhaDecrypt)}
                        style={{ background:"none", border:"1px solid var(--border)", borderRadius:"4px", padding:"2px 8px", cursor:"pointer", color:"var(--text-secondary)", fontSize:"11px" }}>
                        Copiar
                      </button>
                    )}
                  </div>
                ) : (
                  <p style={{ fontSize:"13px", color:"var(--navy)", margin:0, wordBreak:"break-word" }}>
                    {(cadastro as any)[campo.key] || "—"}
                  </p>
                )}
              </div>
            ))}
          </>
        ) : (
          <div style={{ textAlign:"center", padding:"32px 0" }}>
            <UserCircle2 size={48} color="var(--border)" style={{ marginBottom:"12px" }}/>
            <p style={{ color:"var(--text-secondary)", fontSize:"13px", marginBottom:"16px" }}>Nenhum cadastro vinculado</p>
            <button onClick={()=>setMostraBusca(v=>!v)}
              style={{ background:"var(--brand)", border:"none", borderRadius:"8px", padding:"10px 20px", cursor:"pointer", color:"#FFFFFF", fontWeight:"600", fontSize:"13px" }}>
              Vincular cadastro
            </button>
            {mostraBusca && (
              <div style={{ marginTop:"16px", textAlign:"left" }}>
                <input value={buscaCadastro} onChange={e=>setBuscaCadastro(e.target.value)}
                  placeholder="Buscar por nome..."
                  style={{ width:"100%", background:"var(--card-bg)", border:"1px solid var(--border)", borderRadius:"6px", padding:"8px 10px", color:"var(--navy)", fontSize:"13px", boxSizing:"border-box" as const }}/>
                <div style={{ maxHeight:"200px", overflowY:"auto", marginTop:"4px", border:"1px solid var(--border)", borderRadius:"6px", background:"var(--card-bg)" }}>
                  {filtrados.map(c=>(
                    <button key={c.id} onClick={()=>{onVincular(c.id);setMostraBusca(false);}}
                      style={{ display:"block", width:"100%", padding:"8px 12px", background:"none", border:"none", cursor:"pointer", color:"var(--navy)", fontSize:"12px", textAlign:"left" }}
                      onMouseEnter={e=>e.currentTarget.style.background="var(--hover-row)"}
                      onMouseLeave={e=>e.currentTarget.style.background="none"}>
                      {c.nome}
                    </button>
                  ))}
                  {!filtrados.length && <p style={{ color:"var(--text-secondary)", fontSize:"12px", padding:"12px", margin:0 }}>Nenhum resultado.</p>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Relatório vinculado ── */}
        <div style={{ borderTop:"1px solid var(--border)", paddingTop:"16px", marginTop:"16px" }}>
          <p style={{ fontSize:"10px", color:"var(--text-secondary)", margin:"0 0 8px", textTransform:"uppercase", fontWeight:"600" }}>Relatório automático</p>
          {(() => {
            const relVinculado = cliente.relatorio_id ? relatorios.find(r => r.id === cliente.relatorio_id) : null;
            const relPorNome = !relVinculado ? relatorios.filter(r => r.nome_cliente && cliente.nome && r.nome_cliente.toLowerCase().trim() === cliente.nome.toLowerCase().trim()) : [];
            return (
              <>
                {relVinculado ? (
                  <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"8px" }}>
                    <span style={{ fontSize:"12px", color:relVinculado.ativo?"var(--success)":"var(--alert-text)", background:relVinculado.ativo?"rgba(30,107,82,0.1)":"rgba(180,35,24,0.1)", padding:"3px 8px", borderRadius:"10px" }}>
                      {relVinculado.ativo ? "✓ Ativo" : "✗ Inativo"}
                    </span>
                    <span style={{ fontSize:"12px", color:"var(--navy)", flex:1 }}>{relVinculado.nome_cliente || relVinculado.nome}</span>
                    <button onClick={() => onVincularRelatorio(null)}
                      style={{ background:"none", border:"1px solid var(--border)", borderRadius:"4px", padding:"2px 6px", cursor:"pointer", color:"var(--text-secondary)", fontSize:"10px" }}>
                      Desvincular
                    </button>
                  </div>
                ) : relPorNome.length > 0 ? (
                  <div>
                    <p style={{ fontSize:"11px", color:"var(--caution-text)", marginBottom:"6px" }}>Encontrado por nome:</p>
                    {relPorNome.map(r => (
                      <div key={r.id} style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"4px" }}>
                        <span style={{ fontSize:"12px", color:r.ativo?"var(--success)":"var(--alert-text)" }}>{r.ativo ? "●" : "○"}</span>
                        <span style={{ fontSize:"12px", color:"var(--navy)", flex:1 }}>{r.nome_cliente || r.nome}</span>
                        <button onClick={() => onVincularRelatorio(r.id)}
                          style={{ background:"rgba(28,108,166,0.08)", border:"1px solid rgba(28,108,166,0.25)", borderRadius:"4px", padding:"2px 8px", cursor:"pointer", color:"var(--brand)", fontSize:"10px" }}>
                          Vincular
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
                <select value={cliente.relatorio_id || ""} onChange={e => onVincularRelatorio(e.target.value || null)}
                  style={{ width:"100%", background:"var(--card-bg)", border:"1px solid var(--border)", borderRadius:"6px", padding:"6px 8px", color:"var(--navy)", fontSize:"12px", marginTop:"4px" }}>
                  <option value="">{relVinculado ? "Trocar relatório..." : "Vincular relatório..."}</option>
                  {relatorios.map(r => <option key={r.id} value={r.id}>{r.nome_cliente || r.nome} {r.ativo ? "" : "(inativo)"}</option>)}
                </select>
              </>
            );
          })()}
        </div>

        {/* ── Alertas de saldo ── */}
        <div style={{ borderTop:"1px solid var(--border)", paddingTop:"16px", marginTop:"16px" }}>
          <p style={{ fontSize:"10px", color:"var(--text-secondary)", margin:"0 0 8px", textTransform:"uppercase", fontWeight:"600" }}>Alertas de saldo</p>
          {(() => {
            const alertasCliente = alertas.filter(a =>
              a.nome_cliente && cliente.nome &&
              a.nome_cliente.toLowerCase().trim() === cliente.nome.toLowerCase().trim()
            );
            return alertasCliente.length > 0 ? (
              alertasCliente.map(a => (
                <div key={a.id} style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"6px", padding:"6px 8px", background:"var(--card-bg)", borderRadius:"6px", border:"1px solid var(--border)" }}>
                  <span style={{ fontSize:"12px", color:a.ativo?"var(--success)":"var(--alert-text)" }}>{a.ativo ? "●" : "○"}</span>
                  <span style={{ fontSize:"12px", color:"var(--navy)", flex:1 }}>{a.ad_account_id}</span>
                  <button onClick={() => onVincularAlerta(a.id, a.nome_cliente, !a.ativo)}
                    style={{ background:"none", border:"1px solid var(--border)", borderRadius:"4px", padding:"2px 8px", cursor:"pointer", color:a.ativo?"var(--alert-text)":"var(--success)", fontSize:"10px" }}>
                    {a.ativo ? "Desativar" : "Ativar"}
                  </button>
                </div>
              ))
            ) : (
              <p style={{ fontSize:"12px", color:"var(--text-secondary)" }}>Nenhum alerta vinculado a este cliente.</p>
            );
          })()}
        </div>

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
    <div style={{ position:"fixed", right:0, top:0, bottom:0, width:"380px", background:"var(--card-bg)", borderLeft:"1px solid var(--border)", zIndex:200, display:"flex", flexDirection:"column", boxShadow:"-4px 0 20px rgba(0,0,0,0.3)" }}>
      <div style={{ padding:"14px 16px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", gap:"10px", background:"var(--card-bg)" }}>
        <div style={{ flex:1 }}>
          <p style={{ fontSize:"14px", fontWeight:"600", color:"var(--navy)", margin:0 }}>{cliente.nome}</p>
          <p style={{ fontSize:"11px", color:"var(--text-secondary)", margin:0 }}>Atualizações e Log</p>
        </div>
        <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-secondary)" }}><X size={16}/></button>
      </div>
      <div style={{ display:"flex", borderBottom:"1px solid var(--border)" }}>
        {[{key:"atualizacoes",label:"Atualizações"},{key:"log",label:"Log de Atividade"}].map(t=>(
          <button key={t.key} onClick={()=>setAba(t.key as any)} style={{ flex:1, padding:"10px", background:"none", border:"none", cursor:"pointer", fontSize:"12px", color:aba===t.key?"var(--brand)":"var(--text-secondary)", borderBottom:aba===t.key?"2px solid var(--brand)":"2px solid transparent", fontWeight:aba===t.key?"600":"400" }}>{t.label}</button>
        ))}
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"12px" }}>
        {!filtradas.length ? (
          <p style={{ color:"var(--text-secondary)", fontSize:"13px", textAlign:"center", marginTop:"40px" }}>{aba==="atualizacoes"?"Nenhuma atualização ainda.":"Nenhuma atividade registrada."}</p>
        ) : filtradas.map(a => (
          <div key={a.id} style={{ marginBottom:"14px" }}>
            {a.tipo === "log" ? (
              <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                <div style={{ width:"6px", height:"6px", borderRadius:"50%", background:"var(--border)", flexShrink:0 }}/>
                <p style={{ fontSize:"11px", color:"var(--text-secondary)", margin:0, flex:1 }}>{a.conteudo}</p>
                <span style={{ fontSize:"10px", color:"var(--text-secondary)", whiteSpace:"nowrap" }}>{new Date(a.created_at).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</span>
              </div>
            ) : (
              <div style={{ display:"flex", gap:"8px", alignItems:"flex-start" }}>
                <div style={{ width:"30px", height:"30px", borderRadius:"50%", background:"var(--brand)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:"12px", fontWeight:"700", color:"#FFFFFF" }}>{a.usuario.charAt(0).toUpperCase()}</div>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"4px" }}>
                    <span style={{ fontSize:"12px", fontWeight:"600", color:"var(--navy)" }}>{a.usuario}</span>
                    <span style={{ fontSize:"10px", color:"var(--text-secondary)" }}>{new Date(a.created_at).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"})}</span>
                  </div>
                  <div style={{ background:"var(--card-bg)", borderRadius:"4px 12px 12px 12px", padding:"8px 12px", border:"1px solid var(--border)" }}>
                    <p style={{ fontSize:"13px", color:"var(--navy)", margin:0, whiteSpace:"pre-wrap", lineHeight:"1.5" }}>{a.conteudo}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef}/>
      </div>
      {aba==="atualizacoes" && (
        <div style={{ padding:"10px 12px", borderTop:"1px solid var(--border)", background:"var(--card-bg)", display:"flex", gap:"8px", alignItems:"flex-end" }}>
          <textarea className="form-input" placeholder="Escreva uma atualização... (Enter para enviar)" value={texto}
            onChange={e=>setTexto(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();salvar();}}}
            style={{ resize:"none", minHeight:"40px", maxHeight:"120px", flex:1, margin:0, fontSize:"13px" }}/>
          <button onClick={salvar} disabled={salvando||!texto.trim()}
            style={{ background:texto.trim()?"var(--brand)":"var(--border)", border:"none", borderRadius:"8px", padding:"8px 12px", cursor:texto.trim()?"pointer":"default", color:texto.trim()?"#FFFFFF":"var(--text-secondary)", flexShrink:0, display:"flex", alignItems:"center" }}>
            {salvando ? <span style={{fontSize:"10px"}}>...</span> : <Send size={14}/>}
          </button>
          {erroAnotacao && <p style={{color:"var(--alert-text)",fontSize:"11px",margin:"4px 0 0",width:"100%"}}>{erroAnotacao}</p>}
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
  const [relatorios, setRelatorios] = useState<Relatorio[]>([]);
  const [relatoriosMap, setRelatoriosMap] = useState<Record<string,Relatorio>>({});
  const [alertas, setAlertas] = useState<AlertaSaldo[]>([]);
  const [roasData, setRoasData] = useState<Record<string, { spend: number | null; faturamento: number | null } | null>>({});
  const [modalNovoCliente, setModalNovoCliente] = useState(false);
  const [modalColunas, setModalColunas] = useState(false);
  // IDs de cadastro_id presentes no financeiro (tabela clientes)
  const [cadastrosFinanceiro, setCadastrosFinanceiro] = useState<Set<string>>(new Set());
  // Nomes presentes no financeiro (fallback quando sem cadastro_id)
  const [nomesFinanceiro, setNomesFinanceiro] = useState<Set<string>>(new Set());
  const [filtraSemFinanceiro, setFiltraSemFinanceiro] = useState(false);
  const [modalFinanceiro, setModalFinanceiro] = useState<ControleCliente | null>(null);
  const [finFreq, setFinFreq] = useState("mensal");
  const [finValor, setFinValor] = useState("");
  const [finDia, setFinDia] = useState("");
  const [finDia2, setFinDia2] = useState("");
  const [finSalvando, setFinSalvando] = useState(false);
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
    const { data: users } = await supabase.from("usuarios").select("nome").eq("agencia_id",id!).order("nome");
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

    // Carregar relatórios para associação Dashboard
    const { data: rels } = await supabase.from("relatorios").select("id, nome, nome_cliente, ativo").eq("agencia_id", id!);
    const listaRels = rels || [];
    setRelatorios(listaRels);
    const mapaRels: Record<string,Relatorio> = {};
    listaRels.forEach((r: Relatorio) => { mapaRels[r.id] = r; });
    setRelatoriosMap(mapaRels);

    // Carregar alertas de saldo
    const { data: alts } = await supabase.from("alertas_saldo").select("id, nome_cliente, ad_account_id, ativo").eq("agencia_id", id!);
    setAlertas(alts || []);

    // Carregar clientes do financeiro para reconciliação
    const { data: clientesFinan } = await supabase.from("clientes").select("cadastro_id, nome").eq("agencia_id", id!).neq("status", "inativo");
    const setCadFinan = new Set<string>();
    const setNomesFinan = new Set<string>();
    (clientesFinan || []).forEach((c: any) => {
      if (c.cadastro_id) setCadFinan.add(c.cadastro_id);
      if (c.nome) setNomesFinan.add(c.nome.toLowerCase().trim());
    });
    setCadastrosFinanceiro(setCadFinan);
    setNomesFinanceiro(setNomesFinan);

    setLoading(false);

    // Carregar ROAS do mês atual para clientes elegíveis (>1 mês de campanha + relatório vinculado)
    carregarRoas(data || [], rels || []);
  };

  const carregarRoas = async (clientesList: ControleCliente[], relsList: Relatorio[]) => {
    const relIds = new Set(relsList.map(r => r.id));
    const elegiveis = clientesList.filter(c =>
      c.relatorio_id && relIds.has(c.relatorio_id) && iniciouAntesMesAtual(c.data_inicio_campanha)
    );
    if (!elegiveis.length) return;

    const relatorioIds = Array.from(new Set(elegiveis.map(c => c.relatorio_id!)));
    try {
      const res = await fetch("/api/controle/roas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relatorio_ids: relatorioIds }),
      });
      const json = await res.json();
      const byRelId: Record<string, { spend: number | null; faturamento: number | null }> = {};
      (json.results || []).forEach((r: any) => { byRelId[r.relatorio_id] = { spend: r.spend, faturamento: r.faturamento ?? null }; });
      const novo: Record<string, { spend: number | null; faturamento: number | null } | null> = {};
      elegiveis.forEach(c => { novo[c.id] = c.relatorio_id ? (byRelId[c.relatorio_id] ?? null) : null; });
      setRoasData(novo);
    } catch {}
  };

  // Auto-associar por nome ao carregar
  useEffect(() => {
    if (clientes.length && cadastros.length) {
      clientes.forEach(async (cliente) => {
        if (cliente.cadastro_id) return; // já vinculado
        const match = cadastros.find(c =>
          c.nome && cliente.nome &&
          c.nome.toLowerCase().trim() === cliente.nome.toLowerCase().trim()
        );
        if (match) {
          await supabase.from("controle_clientes").update({ cadastro_id: match.id }).eq("id", cliente.id);
          setClientes(prev => prev.map(c => c.id === cliente.id ? { ...c, cadastro_id: match.id } : c));
        }
      });
    }
  }, [clientes.length, cadastros.length]);

  // Auto-associar relatórios por nome_cliente
  useEffect(() => {
    if (clientes.length && relatorios.length) {
      clientes.forEach(async (cliente) => {
        if (cliente.relatorio_id) return;
        const match = relatorios.find(r =>
          r.nome_cliente && cliente.nome &&
          r.nome_cliente.toLowerCase().trim() === cliente.nome.toLowerCase().trim()
        );
        if (match) {
          await supabase.from("controle_clientes").update({ relatorio_id: match.id }).eq("id", cliente.id);
          setClientes(prev => prev.map(c => c.id === cliente.id ? { ...c, relatorio_id: match.id } : c));
        }
      });
    }
  }, [clientes.length, relatorios.length]);

  const atualizar = async (id: string, campo: string, valor: any, nomeCliente: string) => {
    const updates: any = { [campo]: valor };

    // Churn automático: grava data_churn = mês atual
    if (campo === "status" && valor === "saiu") {
      updates.data_churn = mesAtualStr();
    }

    await supabase.from("controle_clientes").update(updates).eq("id", id);
    setClientes(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));

    // Se virou churn, remove da lista visível e desativa automações
    if (campo === "status" && valor === "saiu") {
      setTimeout(() => setClientes(prev => prev.filter(c => c.id !== id)), 800);

      // Desativar relatórios vinculados (por nome ou relatorio_id)
      const clienteChurn = clientes.find(c => c.id === id);
      if (clienteChurn) {
        // Desativar por nome_cliente
        await supabase.from("relatorios").update({ ativo: false })
          .ilike("nome_cliente", clienteChurn.nome);
        // Desativar alertas de saldo por nome_cliente
        await supabase.from("alertas_saldo").update({ ativo: false })
          .ilike("nome_cliente", clienteChurn.nome);
        // Se tem relatorio_id vinculado, desativar também
        if (clienteChurn.relatorio_id) {
          await supabase.from("relatorios").update({ ativo: false })
            .eq("id", clienteChurn.relatorio_id);
        }
      }
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

  const excluirCliente = async (id: string, nome: string) => {
    if (!confirm(`Excluir "${nome}" do controle de clientes? Isso NÃO será contado como churn.`)) return;
    // Desativar automações vinculadas
    await supabase.from("relatorios").update({ ativo: false }).ilike("nome_cliente", nome);
    await supabase.from("alertas_saldo").update({ ativo: false }).ilike("nome_cliente", nome);
    const cliente = clientes.find(c => c.id === id);
    if (cliente?.relatorio_id) {
      await supabase.from("relatorios").update({ ativo: false }).eq("id", cliente.relatorio_id);
    }
    // Deletar subitens e anotações
    await supabase.from("subitens_clientes").delete().eq("cliente_id", id);
    await supabase.from("anotacoes").delete().eq("cliente_id", id);
    // Deletar o registro (sem registrar data_churn)
    await supabase.from("controle_clientes").delete().eq("id", id);
    setClientes(prev => prev.filter(c => c.id !== id));
    if (perfilAberto?.id === id) setPerfilAberto(null);
    if (painelAberto?.id === id) setPainelAberto(null);
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

  const moverCliente = async (idx: number, direcao: "up"|"down") => {
    const lista = [...filtrados];
    const targetIdx = direcao === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= lista.length) return;
    const clienteA = lista[idx];
    const clienteB = lista[targetIdx];
    const ordemA = clienteA.ordem ?? idx;
    const ordemB = clienteB.ordem ?? targetIdx;
    // Swap ordens
    await Promise.all([
      supabase.from("controle_clientes").update({ ordem: ordemB }).eq("id", clienteA.id),
      supabase.from("controle_clientes").update({ ordem: ordemA }).eq("id", clienteB.id),
    ]);
    setClientes(prev => prev.map(c => {
      if (c.id === clienteA.id) return { ...c, ordem: ordemB };
      if (c.id === clienteB.id) return { ...c, ordem: ordemA };
      return c;
    }));
  };

  const startResize = (key: string, e: React.MouseEvent) => {
    e.preventDefault();
    resizing.current = { key, startX: e.clientX, startW: colWidths[key] || 120 };
    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return;
      const key = resizing.current.key;
      const newW = Math.max(60, Math.min(800, resizing.current.startW + ev.clientX - resizing.current.startX));
      setColWidths(prev=>({...prev,[key]:newW}));
    };
    const onUp = () => { resizing.current = null; document.removeEventListener("mousemove",onMove); document.removeEventListener("mouseup",onUp); };
    document.addEventListener("mousemove",onMove);
    document.addEventListener("mouseup",onUp);
  };

  useEffect(() => { carregar(); }, []);

  // Similaridade fuzzy: palavras relevantes em comum (ignora preposições e palavras curtas)
  const nomeSimilar = (a: string, b: string): boolean => {
    const stopWords = new Set(["de","da","do","das","dos","e","a","o","as","os","em","na","no","nas","nos","ltda","me","eireli","sa","s/a"]);
    const palavras = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9\s]/g,"").split(/\s+/).filter(w => w.length > 1 && !stopWords.has(w));
    const wa = palavras(a); const wb = palavras(b);
    if (!wa.length || !wb.length) return false;
    // Uma contém a outra (substring de palavras)
    const strA = wa.join(" "); const strB = wb.join(" ");
    if (strA.includes(strB) || strB.includes(strA)) return true;
    // 60% das palavras do menor em comum com o maior
    const [menor, maior] = wa.length <= wb.length ? [wa, wb] : [wb, wa];
    const emComum = menor.filter(w => maior.includes(w));
    return emComum.length / menor.length >= 0.6;
  };

  const criarNoFinanceiro = async () => {
    if (!modalFinanceiro) return;
    const v = parseFloat(finValor.replace(",", "."));
    if (!v || v <= 0) { alert("Preencha o valor mensal."); return; }
    setFinSalvando(true);
    try {
      // Parse data_entrada → created_at
      const de = modalFinanceiro.data_entrada || "";
      let createdAt: string;
      if (de.includes("/")) {
        const parts = de.split("/");
        createdAt = `${parts[2]}-${parts[1]}-${parts[0]}T12:00:00.000Z`;
      } else if (de) {
        createdAt = de.includes("T") ? de : `${de}T12:00:00.000Z`;
      } else {
        createdAt = new Date().toISOString();
      }

      // Criar em clientes (igual ao fluxo padrão)
      const { data: novoCliente, error: errCliente } = await supabase.from("clientes").insert({
        agencia_id: agId,
        nome: modalFinanceiro.nome,
        status: "ativo",
        status_recorrencia: "ativo",
        servico: "assessoria",
        valor_oportunidade: v,
        frequencia: finFreq,
        cadastro_id: modalFinanceiro.cadastro_id || null,
        created_at: createdAt,
        updated_at: new Date().toISOString(),
      }).select().single();
      if (errCliente) throw errCliente;

      // Usar a mesma função do fluxo padrão de clientes
      // Se informou dia, ajusta a data de hoje para refletir o dia correto
      const diaNum = parseInt(finDia);
      if (diaNum >= 1 && diaNum <= 31) {
        const hoje2 = new Date();
        hoje2.setDate(diaNum);
        // Substituir temporariamente Date para a função usar o dia certo não é possível,
        // então geramos os lançamentos manualmente com o dia correto
        const agId2 = await getAgenciaId();
        const lancamentos: any[] = [];
        const anoIni = hoje2.getFullYear();
        const mesIni = hoje2.getMonth(); // 0-indexed
        const d1 = diaNum;
        const d2 = finFreq === "quinzenal" ? (parseInt(finDia2) || d1 + 15) : 0;
        if (finFreq === "quinzenal") {
          const valorMetade = Math.round(v * 100 / 2) / 100;
          for (let m = 0; m < 12; m++) {
            for (const dd of [d1, d2]) {
              lancamentos.push({ agencia_id: agId2, tipo: "entrada", descricao: `Assessoria quinzenal - ${novoCliente.nome} (parcela ${m*2+(dd===d1?1:2)})`, valor: valorMetade, data_vencimento: new Date(anoIni, mesIni + m, dd).toISOString().split("T")[0], cliente_id: novoCliente.id, pago: false });
            }
          }
        } else if (finFreq === "trimestral") {
          const valorTri = Math.round(v * 3 * 100) / 100;
          for (let i = 0; i < 4; i++) {
            lancamentos.push({ agencia_id: agId2, tipo: "entrada", descricao: `Assessoria trimestral - ${novoCliente.nome} (trimestre ${i+1})`, valor: valorTri, data_vencimento: new Date(anoIni, mesIni + i*3, d1).toISOString().split("T")[0], cliente_id: novoCliente.id, pago: false });
          }
        } else {
          for (let i = 0; i < 12; i++) {
            lancamentos.push({ agencia_id: agId2, tipo: "entrada", descricao: `Assessoria - ${novoCliente.nome} (${i===0?"1º mês":`${i+1}º mês`})`, valor: v, data_vencimento: new Date(anoIni, mesIni + i, d1).toISOString().split("T")[0], cliente_id: novoCliente.id, pago: false });
          }
        }
        const periodicidade = finFreq === "quinzenal" ? "mensal" : finFreq;
        const diaVenc = finFreq === "quinzenal" ? `${d1},${d2}` : String(d1);
        await supabase.from("recorrencias").insert({ agencia_id: agId2, tipo: "entrada", descricao: `Assessoria - ${novoCliente.nome}`, valor: finFreq==="quinzenal"?Math.round(v/2*100)/100:finFreq==="trimestral"?Math.round(v*3*100)/100:v, periodicidade, dia_vencimento: diaVenc, ativo: true, cliente_id: novoCliente.id });
        if (lancamentos.length) await supabase.from("lancamentos_futuros").insert(lancamentos);
      } else {
        await gerarLancamentosRecorrencia({ ...novoCliente, valor_oportunidade: v, servico: "assessoria", frequencia: finFreq });
      }

      // Atualizar estado local para remover o ⚠
      if (modalFinanceiro.cadastro_id) {
        setCadastrosFinanceiro(prev => new Set(Array.from(prev).concat(modalFinanceiro.cadastro_id!)));
      } else {
        setNomesFinanceiro(prev => new Set(Array.from(prev).concat(modalFinanceiro.nome.toLowerCase().trim())));
      }
      setModalFinanceiro(null);
      setFinFreq("mensal"); setFinValor(""); setFinDia(""); setFinDia2("");
    } catch (e: any) { alert("Erro: " + (e?.message || e)); }
    setFinSalvando(false);
  };

  const semFinanceiro = (c: ControleCliente) => {
    if (c.cadastro_id && cadastrosFinanceiro.has(c.cadastro_id)) return false;
    if (c.nome) {
      for (const nomeF of Array.from(nomesFinanceiro)) {
        if (nomeSimilar(c.nome, nomeF)) return false;
      }
    }
    return true;
  };

  const filtrados = clientes
    .filter(c=>c.nome?.toLowerCase().includes(busca.toLowerCase()))
    .filter(c=> !filtraSemFinanceiro || semFinanceiro(c))
    .sort((a,b) => {
      let va=(a as any)[sort]||""; let vb=(b as any)[sort]||"";
      if (sort==="investimento_mensal"||sort==="ordem"){va=Number(va)||0;vb=Number(vb)||0;}
      else if (sort==="data_entrada"||sort==="data_inicio_campanha"||sort==="created_at"){
        const pa=(va as string).includes("/")?((va as string).split("/").reverse().join("-")):(va as string);
        const pb=(vb as string).includes("/")?((vb as string).split("/").reverse().join("-")):(vb as string);
        va=pa||"0000";vb=pb||"0000";
      }
      if (sortDir==="asc") return va>vb?1:-1;
      return va<vb?1:-1;
    });

  const painelLateralAberto = painelAberto || perfilAberto;

  return (
    <div className="animate-in">
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        .resize-handle{width:4px;cursor:col-resize;position:absolute;right:0;top:0;bottom:0;background:transparent;}
        .resize-handle:hover{background:var(--brand);}
        .th-group:hover .th-actions{opacity:1!important;}
      `}</style>

      <header className="pg-head">
        <div className="pg-head-txt">
          <span className="pg-ctx">Clientes · {clientes.length} na carteira</span>
          <h1 className="pg-title">Carteira <span className="font-serif-accent pg-accent">de clientes</span></h1>
        </div>
        <div className="pg-actions">
          <div style={{ position:"relative" }}>
            <Search size={13} style={{ position:"absolute", left:"10px", top:"50%", transform:"translateY(-50%)", color:"var(--text-secondary)" }}/>
            <input className="search-input" placeholder="Buscar cliente" value={busca} onChange={e=>setBusca(e.target.value)} style={{ paddingLeft:"34px", width:"220px" }}/>
          </div>
          <select value={sort} onChange={e=>setSort(e.target.value)} style={{ background:"var(--card-bg)", border:"0", borderRadius:"999px", height:"44px", padding:"0 16px", color:"var(--navy)", fontSize:"14px", cursor:"pointer", boxShadow:"var(--shadow-soft)" }}>
            {SORT_OPTS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <button onClick={()=>setSortDir(d=>d==="asc"?"desc":"asc")} className="btn-ghost" style={{ padding:"7px 10px", cursor:"pointer", fontSize:"12px" }}>
            {sortDir==="asc"?"↑ Crescente":"↓ Decrescente"}
          </button>
          <button onClick={carregar} className="btn-ghost" style={{ padding:"8px", cursor:"pointer" }}><RefreshCw size={14}/></button>
          <button onClick={()=>setModalColunas(true)} className="btn-secondary" style={{ height:"44px", padding:"0 18px", cursor:"pointer", fontSize:"14px", display:"flex", alignItems:"center", gap:"6px" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            Colunas
          </button>
          {(() => {
            const qtd = clientes.filter(semFinanceiro).length;
            return qtd > 0 ? (
              <button onClick={()=>setFiltraSemFinanceiro(v=>!v)} style={{ background: filtraSemFinanceiro ? "rgba(180,35,24,0.08)" : "var(--hover-row)", border:`1px solid ${filtraSemFinanceiro?"var(--alert-text)":"var(--border)"}`, borderRadius:"8px", padding:"7px 12px", cursor:"pointer", color: filtraSemFinanceiro ? "var(--alert-text)" : "var(--caution-text)", fontWeight:"600", fontSize:"12px", display:"flex", alignItems:"center", gap:"6px" }}
                title="Clientes no controle mas sem cadastro no financeiro">
                ⚠ {qtd} sem financeiro
              </button>
            ) : null;
          })()}
          <button onClick={()=>setModalNovoCliente(true)} className="btn-primary" style={{ height:"44px", padding:"0 18px", cursor:"pointer", fontSize:"14px", display:"flex", alignItems:"center", gap:"6px" }}><Plus size={14}/> Nova cliente</button>
        </div>
      </header>

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
          { label:"Clientes Totais", value:clientes.length, cor:"var(--navy)" },
          { label:"Clientes Ativos", value:ativos.length, cor:"var(--success)" },
          { label:"Pausados", value:pausados.length, cor:"var(--caution-text)" },
          { label:"Em Entrada", value:entrada.length, cor:"#C2620E" /* warning */ },
          { label:`Base ${mesPassadoStr}`, value: basePassada || "—", cor:"var(--brand)" },
          { label:"Tempo Médio (meses)", value:tempoMedioDias > 0 ? tempoMedioDias.toFixed(1) : "—", cor:"var(--navy)" },
          { label:`Churn ${mesAtualStr2}`, value: churnsMes.filter((c:any) => c.data_churn === mesAtualStr2).length, cor:"var(--alert-text)" },
        ];
        void kpis;
        const mesLongo = hoje.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
        const churnMesAtual = churnsMes.filter((c:any) => c.data_churn === mesAtualStr2).length;
        return (
          <Faixa
            contexto={`${mesLongo.charAt(0).toUpperCase() + mesLongo.slice(1).replace(" de ", " de ")} · base de ${mesPassadoStr}: ${basePassada || "—"}`}
            titulo={`${ativos.length} ativas,`}
            destaque={`${entrada.length} em entrada`}
            link={{ label: "Ver churn", href: "/churn" }}
            numeros={[
              { label: "Clientes totais", valor: clientes.length },
              { label: "Ativas", valor: ativos.length },
              { label: "Pausadas", valor: pausados.length },
              { label: "Tempo médio", valor: tempoMedioDias > 0 ? `${tempoMedioDias.toFixed(1).replace(".", ",")} meses` : "—" },
              { label: `Churn de ${hoje.toLocaleDateString("pt-BR", { month: "long" })}`, valor: churnMesAtual },
            ]}
          />
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

        // Clientes que iniciaram campanha no mês atual (e não no futuro)
        const mesStr = String(mesAtual + 1).padStart(2, "0"); // "03" pra março
        const anoStr = String(anoAtual); // "2026"
        const iniciaram = clientes.filter(c => {
          const inicio = parseData(c.data_inicio_campanha);
          if (!inicio) return false;
          const entrada = parseData(c.data_entrada);
          if (!entrada) return false;
          // Deve ser do mês atual E não ser data futura
          if (inicio.getMonth() !== mesAtual || inicio.getFullYear() !== anoAtual) return false;
          if (inicio > hoje) return false; // data futura não conta
          return true;
        });

        const diasPorCliente = iniciaram.map(c => {
          const inicio = parseData(c.data_inicio_campanha)!;
          const entrada = parseData(c.data_entrada)!;
          return { nome: c.nome, dias: Math.max(0, Math.round((inicio.getTime() - entrada.getTime()) / (1000*60*60*24))) };
        });

        const totalDias = diasPorCliente.reduce((s, c) => s + c.dias, 0);
        const media = iniciaram.length > 0 ? totalDias / iniciaram.length : 0;
        // % de cumprimento: meta/media — quanto menos dias, maior o %
        const percentMeta = media > 0 && metaDiasInicio > 0 ? Math.min(100, Math.round((metaDiasInicio / media) * 100)) : media === 0 ? 0 : 100;

        // Cor: verde se dentro da meta, vermelho quanto mais passa
        const corProgresso = media === 0 ? "var(--text-secondary)" : percentMeta >= 100 ? "var(--success)" : percentMeta >= 75 ? "var(--brand)" : percentMeta >= 50 ? "var(--caution-text)" : "var(--alert-text)";
        const labelProgresso = media === 0 ? "Sem dados" : percentMeta >= 100 ? "Dentro da meta" : percentMeta >= 75 ? "Levemente acima" : percentMeta >= 50 ? "Atenção" : "Crítico";

        return (
          <div className="card" style={{ padding:"16px", marginBottom:"20px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"12px" }}>
              <div>
                <p style={{ fontSize:"12px", fontWeight:"600", color:"var(--text-secondary)", margin:"0 0 4px" }}>Dias para iniciar campanha</p>
                <p style={{ fontSize:"11px", color:"var(--text-secondary)", margin:0 }}>Média do mês atual — {iniciaram.length} cliente{iniciaram.length !== 1 ? "s" : ""} iniciaram</p>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                <span style={{ fontSize:"11px", color:"var(--text-secondary)" }}>Meta:</span>
                {editandoMeta ? (
                  <input type="number" min="1" value={metaDiasInicio} autoFocus
                    onChange={e => { const v = parseInt(e.target.value) || 10; setMetaDiasInicio(v); localStorage.setItem("meta_dias_inicio", String(v)); }}
                    onBlur={() => setEditandoMeta(false)}
                    onKeyDown={e => { if (e.key === "Enter") setEditandoMeta(false); }}
                    style={{ width:"50px", background:"var(--hover-row)", border:"1px solid var(--brand)", borderRadius:"4px", padding:"2px 6px", color:"var(--navy)", fontSize:"12px", textAlign:"center" }}/>
                ) : (
                  <button onClick={() => setEditandoMeta(true)} style={{ background:"var(--card-bg)", border:"1px solid var(--border)", borderRadius:"4px", padding:"2px 8px", color:"var(--navy)", fontSize:"12px", cursor:"pointer" }}>
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
                <p style={{ fontSize:"11px", color:"var(--text-secondary)", margin:"4px 0 0" }}>dias (média)</p>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"4px" }}>
                  <span style={{ fontSize:"11px", fontWeight:"600", color:corProgresso }}>{labelProgresso}</span>
                  <span style={{ fontSize:"11px", color:"var(--text-secondary)" }}>{percentMeta}% da meta</span>
                </div>
                <div style={{ height:"8px", background:"var(--card-bg)", borderRadius:"4px", overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${Math.min(percentMeta, 100)}%`, background:corProgresso, borderRadius:"4px", transition:"width 0.3s" }}/>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:"2px" }}>
                  <span style={{ fontSize:"9px", color:"var(--alert-text)" }}>0%</span>
                  <span style={{ fontSize:"9px", color:"var(--caution-text)" }}>50%</span>
                  <span style={{ fontSize:"9px", color:"var(--brand)" }}>75%</span>
                  <span style={{ fontSize:"9px", color:"var(--success)" }}>100% ({metaDiasInicio}d)</span>
                </div>
              </div>
            </div>

            {/* Detalhamento por cliente */}
            {diasPorCliente.length > 0 && (
              <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>
                {diasPorCliente.map(c => (
                  <span key={c.nome} style={{ fontSize:"11px", padding:"2px 8px", borderRadius:"12px", background:c.dias <= metaDiasInicio ? "rgba(30,107,82,0.1)" : "rgba(180,35,24,0.1)", color:c.dias <= metaDiasInicio ? "var(--success)" : "var(--alert-text)", border:`1px solid ${c.dias <= metaDiasInicio ? "rgba(30,107,82,0.2)" : "rgba(180,35,24,0.2)"}` }}>
                    {c.nome}: {c.dias}d
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Tabela */}
      <div className="cc-wrap" style={{ marginRight:painelLateralAberto?"400px":"0" }}>
        <table className="cc-table" style={{ width:"100%", borderCollapse:"collapse", fontSize:"13px", tableLayout:"fixed" }}>
          <thead>
            <tr style={{ background:"var(--card-bg)", borderBottom:"1px solid var(--border)" }}>
              <th style={{ width:"30px", padding:"10px 6px" }}></th>
              {sort==="ordem" && <th style={{ width:"50px", padding:"10px 4px", textAlign:"center", fontSize:"11px", color:"var(--text-secondary)", fontWeight:"600" }}>↕</th>}
              <th className="cc-sticky" style={{ padding:"12px 12px", textAlign:"left", width:"280px", whiteSpace:"nowrap" }}>Cliente</th>
              {/* Coluna UTI fixa */}
              <th style={{ padding:"12px 8px", textAlign:"center", width:"64px", whiteSpace:"nowrap" }}>UTI</th>
              {colunas.map((col: any)=>(
                <th key={col.key} className="th-group" style={{ padding:"12px 10px", textAlign:"left", width:colWidths[col.key]||col.w, position:"relative", whiteSpace:"nowrap", overflow:"hidden" }}>
                  {editandoHeader === col.key ? (
                    <input autoFocus defaultValue={col.label}
                      onBlur={e => renomearColuna(col.key, e.target.value)}
                      onKeyDown={e => { if(e.key==="Enter") renomearColuna(col.key, (e.target as HTMLInputElement).value); if(e.key==="Escape") setEditandoHeader(null); }}
                      style={{ background:"var(--off-white)", border:"1px solid var(--brand)", borderRadius:"4px", padding:"2px 6px", color:"var(--navy)", fontSize:"11px", width:"80%", outline:"none" }}/>
                  ) : (
                    <div style={{ display:"flex", alignItems:"center", gap:"4px", paddingRight:"20px" }}>
                      <span>{col.label}</span>
                      <span className="th-actions" style={{ opacity:0, display:"flex", gap:"2px", transition:"opacity 0.15s" }}>
                        <button onClick={()=>setEditandoHeader(col.key)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-secondary)", padding:"1px" }} title="Renomear">
                          <Pencil size={10}/>
                        </button>
                        <button onClick={()=>excluirColuna(col.key)} style={{ background:"none", border:"none", cursor:"pointer", color:"rgba(180,35,24,0.5)", padding:"1px" }} title="Excluir coluna">
                          <Trash2 size={10}/>
                        </button>
                      </span>
                    </div>
                  )}
                  <div className="resize-handle"
                    onMouseDown={e=>startResize(col.key,e)}
                    onDoubleClick={e=>{ e.stopPropagation(); const padrao = COLUNAS_PADRAO.find(c=>c.key===col.key)?.w||120; const atual = colWidths[col.key]||padrao; setColWidths(prev=>({...prev,[col.key]: atual===padrao ? Math.min(padrao*2.5, 400) : padrao})); }}
                    title="Duplo clique para expandir/resetar"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={colunas.length+4} style={{ textAlign:"center", color:"var(--text-secondary)", padding:"48px" }}>Carregando...</td></tr>
            ) : !filtrados.length ? (
              <tr><td colSpan={colunas.length+4} style={{ textAlign:"center", color:"var(--text-secondary)", padding:"48px" }}>Nenhum cliente encontrado.</td></tr>
            ) : filtrados.map((c,idx)=>(
              <React.Fragment key={c.id}>
              <tr className={c.uti ? "cc-row cc-uti" : "cc-row"}>
                <td style={{ padding:"4px 6px", textAlign:"center" }}>
                  <button onClick={()=>toggleExpandir(c.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-secondary)", padding:"2px" }}>
                    {expandidos.has(c.id)?<ChevronDown size={14}/>:<ChevronRight size={14}/>}
                  </button>
                </td>
                {sort==="ordem" && (
                  <td style={{ padding:"2px 4px", textAlign:"center", width:"50px" }}>
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"1px" }}>
                      <button onClick={()=>moverCliente(idx,"up")} disabled={idx===0}
                        style={{ background:"none", border:"none", cursor:idx===0?"default":"pointer", color:idx===0?"var(--border)":"var(--text-secondary)", padding:"1px" }} title="Subir">
                        <ArrowUp size={13}/>
                      </button>
                      <button onClick={()=>moverCliente(idx,"down")} disabled={idx===filtrados.length-1}
                        style={{ background:"none", border:"none", cursor:idx===filtrados.length-1?"default":"pointer", color:idx===filtrados.length-1?"var(--border)":"var(--text-secondary)", padding:"1px" }} title="Descer">
                        <ArrowDown size={13}/>
                      </button>
                    </div>
                  </td>
                )}
                <td className="cc-sticky cc-name-cell" style={{ padding:"8px 12px", whiteSpace:"nowrap", width:"280px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                    <a href={`/controle-clientes/${c.id}`} title="Abrir ficha da cliente" className="cc-avatar cc-avatar-link" style={{ ["--st" as any]: (STATUS_OPTS.find(s=>s.value===c.status)||STATUS_OPTS[0]).cor }}>
                      {(c.nome||"?").trim().split(/\s+/).slice(0,2).map((p:string)=>p[0]).join("").toUpperCase()}
                    </a>
                    <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column" }}>
                      <div className="cc-name">
                        <CelulaEditavel valor={c.nome||""} onSave={v=>atualizar(c.id,"nome",v,c.nome)} placeholder="Nome do cliente"/>
                      </div>
                      <span className="cc-sub">{c.gestor || "Sem gestor"}</span>
                    </div>
                    <div className="cc-actions">
                      {semFinanceiro(c) && (
                        <button
                          onClick={() => { setModalFinanceiro(c); setFinValor(c.investimento_mensal ? String(c.investimento_mensal) : ""); setFinFreq("mensal"); setFinDia(""); setFinDia2(""); }}
                          title="Sem cadastro no financeiro: criar agora"
                          className="cc-icon cc-warn">
                          <AlertTriangle size={13}/>
                        </button>
                      )}
                      <a href={`/controle-clientes/${c.id}`} className="cc-icon" title="Abrir ficha da cliente">
                        <ExternalLink size={14}/>
                      </a>
                      <button onClick={()=>{ setPainelAberto(painelAberto?.id===c.id?null:c); setPerfilAberto(null); }}
                        className={painelAberto?.id===c.id ? "cc-icon on" : "cc-icon"}
                        title="Atualizações">
                        <MessageSquare size={14}/>
                      </button>
                      <button onClick={()=>{ setPerfilAberto(perfilAberto?.id===c.id?null:c); setPainelAberto(null); }}
                        className={perfilAberto?.id===c.id || c.cadastro_id ? "cc-icon on" : "cc-icon"}
                        title="Ver perfil do cliente">
                        <UserCircle2 size={15}/>
                      </button>
                      <button onClick={()=>excluirCliente(c.id, c.nome)} className="cc-icon cc-del" title="Excluir cliente">
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  </div>
                </td>
                {/* Célula UTI fixa */}
                <td style={{ padding:"4px", textAlign:"center", width:"64px" }}>
                  <button
                    onClick={()=>atualizar(c.id,"uti",!c.uti,c.nome)}
                    title={c.uti ? "Remover da UTI" : "Enviar para UTI"}
                    className={c.uti ? "cc-uti-btn on" : "cc-uti-btn"}>
                    UTI
                  </button>
                </td>
                {colunas.map((col: any)=>(
                  <td key={col.key} style={{ padding:"4px 8px", overflow:"hidden", width:colWidths[col.key]||col.w, whiteSpace:"nowrap", maxWidth:colWidths[col.key]||col.w, height:"60px" }}>
                    {col.key==="status" ? (
                      <StatusSelect valor={c.status} onSave={v=>atualizar(c.id,"status",v,c.nome)}/>
                    ) : col.key==="instagram_link" ? (
                      <CelulaInstagram valor={c.instagram||""} onSave={v=>atualizar(c.id,"instagram",v,c.nome)}/>
                    ) : col.key==="oferta" ? (
                      <select value={c.oferta||""} onChange={e=>atualizar(c.id,"oferta",e.target.value,c.nome)}
                        style={{ background:"var(--card-bg)", border:"1px solid var(--border)", borderRadius:"4px", padding:"3px 6px", color: c.oferta==="sim"?"var(--success)":c.oferta==="nao"?"var(--alert-text)":"var(--text-secondary)", fontSize:"12px", cursor:"pointer", width:"100%" }}>
                        <option value="">—</option>
                        <option value="sim">Sim</option>
                        <option value="nao">Não</option>
                      </select>
                    ) : col.key==="regiao_anunciar" ? (
                      <span style={{ fontSize:"12px", color:"var(--text-secondary)", display:"block", overflow:"hidden", textOverflow:"ellipsis" }} title={c.cadastro_id ? cadastrosMap[c.cadastro_id]?.regiao_anunciar || "—" : "—"}>
                        {c.cadastro_id ? cadastrosMap[c.cadastro_id]?.regiao_anunciar || "—" : "—"}
                      </span>
                    ) : col.key==="head_squad"||col.key==="consultor"||col.key==="gestor" ? (
                      <select value={(c as any)[col.key]||""} onChange={e=>atualizar(c.id,col.key,e.target.value,c.nome)}
                        style={{ background:"var(--card-bg)", border:"1px solid var(--border)", borderRadius:"4px", padding:"3px 6px", color:"var(--navy)", fontSize:"12px", cursor:"pointer", width:"100%" }}>
                        <option value="">—</option>
                        {usuarios.length?usuarios.map(u=><option key={u} value={u}>{u}</option>):<option value={(c as any)[col.key]}>{(c as any)[col.key]}</option>}
                      </select>
                    ) : col.key==="squad" ? (
                      <select value={(c as any)[col.key]||""} onChange={e=>atualizar(c.id,col.key,e.target.value,c.nome)}
                        style={{ background:"var(--card-bg)", border:"1px solid var(--border)", borderRadius:"4px", padding:"3px 6px", color:"var(--navy)", fontSize:"12px", cursor:"pointer", width:"100%" }}>
                        <option value="">—</option>
                        {times.length?times.map(t=><option key={t} value={t}>{t}</option>):<option value={(c as any)[col.key]}>{(c as any)[col.key]}</option>}
                      </select>
                    ) : col.key==="renovacao" ? (
                      <CelulaRenovacao cliente={c} onRenovou={async (val) => {
                        await supabase.from("controle_clientes").update({ renovou: val }).eq("id", c.id);
                        carregar();
                      }}/>
                    ) : col.key==="data_entrada"||col.key==="data_inicio_campanha" ? (
                      <CelulaEditavel valor={(c as any)[col.key]||""} tipo="date" onSave={v=>atualizar(c.id,col.key,v,c.nome)}/>
                    ) : col.key==="investimento_mensal" ? (
                      <CelulaEditavel valor={c.investimento_mensal?String(c.investimento_mensal):""} onSave={v=>atualizar(c.id,col.key,Number(v.replace(/\D/g,"")),c.nome)}/>
                    ) : col.key==="fixados" ? (
                      <select value={(c as any).fixados||""} onChange={e=>atualizar(c.id,"fixados",e.target.value,c.nome)}
                        style={{
                          background: (c as any).fixados==="sim"?"rgba(30,107,82,0.1)":(c as any).fixados==="nao"?"rgba(180,35,24,0.1)":"var(--hover-row)",
                          border:"1px solid var(--border)", borderRadius:"4px", padding:"3px 6px",
                          color:(c as any).fixados==="sim"?"var(--success)":(c as any).fixados==="nao"?"var(--alert-text)":"var(--text-secondary)",
                          fontSize:"12px", cursor:"pointer", width:"100%", fontWeight:600,
                        }}>
                        <option value="">—</option>
                        <option value="sim">Sim</option>
                        <option value="nao">Não</option>
                      </select>
                    ) : col.key==="dashboard" ? (
                      <DashboardVincular
                        clienteId={c.id}
                        clienteNome={c.nome}
                        relatorioId={c.relatorio_id}
                        relatorios={relatorios}
                        onVincular={(relId) => atualizar(c.id, "relatorio_id", relId, c.nome)}
                      />
                    ) : col.key==="link_planilha" ? (
                      c.link_planilha ? (
                        <div style={{ display:"flex", alignItems:"center", gap:"4px" }}>
                          <a href={c.link_planilha} target="_blank" rel="noopener"
                            style={{ color:"var(--success)", fontSize:"11px", fontWeight:600, textDecoration:"none", display:"inline-flex", alignItems:"center", gap:"3px" }}>
                            <FileText size={12}/> Abrir
                          </a>
                          <button onClick={() => atualizar(c.id, "link_planilha", "", c.nome)}
                            style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-secondary)", padding:"2px" }} title="Remover link">
                            <X size={10}/>
                          </button>
                        </div>
                      ) : (
                        <CelulaEditavel valor="" placeholder="Colar link..." onSave={v => {
                          if (!v) return;
                          // Garantir gid da aba Dashboard Mensal
                          let link = v;
                          if (link.includes('docs.google.com/spreadsheets') && !link.includes('gid=')) {
                            link = link.replace(/\/edit.*$/, '/edit?gid=393388794#gid=393388794');
                          }
                          atualizar(c.id, "link_planilha", link, c.nome);
                        }}/>
                      )
                    ) : col.key==="resposta_planilha" ? (
                      <select value={(c as any).resposta_planilha||""} onChange={e=>atualizar(c.id,"resposta_planilha",e.target.value,c.nome)}
                        style={{
                          background: (c as any).resposta_planilha==="sim"?"rgba(30,107,82,0.1)":(c as any).resposta_planilha==="parcialmente"?"rgba(194,98,14,0.08)":(c as any).resposta_planilha==="nao"?"rgba(180,35,24,0.1)":"var(--hover-row)",
                          border:"1px solid var(--border)", borderRadius:"4px", padding:"3px 6px",
                          color:(c as any).resposta_planilha==="sim"?"var(--success)":(c as any).resposta_planilha==="parcialmente"?"var(--caution-text)":(c as any).resposta_planilha==="nao"?"var(--alert-text)":"var(--text-secondary)",
                          fontSize:"12px", cursor:"pointer", width:"100%", fontWeight:600,
                        }}>
                        <option value="">—</option>
                        <option value="sim">Sim</option>
                        <option value="nao">Não</option>
                        <option value="parcialmente">Parcialmente</option>
                      </select>
                    ) : col.key==="acao_atual" ? (
                      <CelulaEditavel valor={(c as any).acao_atual||""} onSave={v=>atualizar(c.id,"acao_atual",v,c.nome)}/>
                    ) : col.key==="roas_mes" ? (
                      (() => {
                        if (!iniciouAntesMesAtual(c.data_inicio_campanha))
                          return <span style={{ fontSize:"11px", color:"var(--text-secondary)" }}>—</span>;
                        if (!c.relatorio_id)
                          return <span style={{ fontSize:"11px", color:"var(--text-secondary)" }}>Sem rel.</span>;
                        if (!(c.id in roasData))
                          return <span style={{ fontSize:"11px", color:"var(--text-secondary)" }}>carregando...</span>;
                        const entry = roasData[c.id];
                        if (!entry || entry.spend === null || entry.spend === 0)
                          return <span style={{ fontSize:"11px", color:"var(--text-secondary)" }}>Sem dados</span>;
                        const fat = entry.faturamento;
                        if (!fat)
                          return (
                            <span style={{ fontSize:"11px", color:"var(--text-secondary)" }} title={`Gasto: R$ ${entry.spend.toFixed(2)}`}>
                              R$ {entry.spend.toLocaleString("pt-BR",{minimumFractionDigits:0,maximumFractionDigits:0})}
                            </span>
                          );
                        const roas = fat / entry.spend;
                        const cor = roas >= 5 ? "var(--success)" : roas >= 3 ? "var(--brand)" : roas >= 1.5 ? "var(--caution-text)" : "var(--alert-text)";
                        return (
                          <span style={{ fontSize:"12px", fontWeight:600, color: cor }} title={`Fat: R$ ${fat.toLocaleString("pt-BR")} / Gasto: R$ ${entry.spend.toFixed(2)}`}>
                            {roas.toFixed(2)}x
                          </span>
                        );
                      })()
                    ) : (
                      <CelulaEditavel valor={(c as any)[col.key]||""} onSave={v=>atualizar(c.id,col.key,v,c.nome)}/>
                    )}
                  </td>
                ))}
              </tr>
              {expandidos.has(c.id) && (
                <tr key={`sub-${c.id}`} style={{ background:"var(--off-white)", borderBottom:"1px solid var(--border)" }}>
                  <td></td>
                  <td colSpan={colunas.length+3} style={{ padding:"8px 16px 12px 40px" }}>
                    <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                      {(subitens[c.id]||[]).map(s=>(
                        <div key={s.id} style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                          <div onClick={()=>toggleSubitem(c.id,s.id,s.feito)} style={{ width:"16px", height:"16px", borderRadius:"3px", border:`2px solid ${s.feito?"var(--brand)":"var(--border)"}`, background:s.feito?"var(--brand)":"transparent", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                            {s.feito&&<Check size={10} color="#FFFFFF"/>}
                          </div>
                          <span style={{ fontSize:"12px", color:s.feito?"var(--text-secondary)":"var(--navy)", textDecoration:s.feito?"line-through":"none" }}>{s.texto}</span>
                        </div>
                      ))}
                      <div style={{ display:"flex", alignItems:"center", gap:"6px", marginTop:"4px" }}>
                        <div style={{ width:"16px", height:"16px", borderRadius:"3px", border:"2px dashed var(--border)", flexShrink:0 }}/>
                        <input placeholder="+ Adicionar subitem..." value={novoSubitem[c.id]||""}
                          onChange={e=>setNovoSubitem(prev=>({...prev,[c.id]:e.target.value}))}
                          onKeyDown={e=>{if(e.key==="Enter")adicionarSubitem(c.id);}}
                          style={{ background:"transparent", border:"none", outline:"none", color:"var(--text-secondary)", fontSize:"12px", flex:1 }}/>
                        {novoSubitem[c.id]&&(
                          <button onClick={()=>adicionarSubitem(c.id)} style={{ background:"var(--brand)", border:"none", borderRadius:"4px", padding:"2px 8px", cursor:"pointer", color:"#FFFFFF", fontSize:"11px" }}>Adicionar</button>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {modalFinanceiro && (
        <div onClick={()=>setModalFinanceiro(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:"var(--card-bg)", border:"1px solid var(--border)", borderRadius:"12px", width:"400px", boxShadow:"0 20px 60px rgba(0,0,0,0.8)" }}>
            <div style={{ padding:"16px 20px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div>
                <p style={{ fontSize:"15px", fontWeight:"700", color:"var(--navy)", margin:0 }}>Criar no Financeiro</p>
                <p style={{ fontSize:"12px", color:"var(--text-secondary)", margin:"2px 0 0" }}>{modalFinanceiro.nome}</p>
              </div>
              <button onClick={()=>setModalFinanceiro(null)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-secondary)" }}><X size={16}/></button>
            </div>
            <div style={{ padding:"20px", display:"flex", flexDirection:"column", gap:"12px" }}>
              <div>
                <label style={{ display:"block", fontSize:"11px", color:"var(--text-secondary)", marginBottom:"6px" }}>Condição</label>
                <select value={finFreq} onChange={e=>{setFinFreq(e.target.value);setFinDia2("");}}
                  style={{ width:"100%", background:"var(--card-bg)", border:"1px solid var(--border)", borderRadius:"8px", padding:"9px 12px", color:"var(--navy)", fontSize:"13px", cursor:"pointer" }}>
                  <option value="mensal">Mensal</option>
                  <option value="trimestral">Trimestral</option>
                  <option value="quinzenal">Quinzenal</option>
                </select>
              </div>
              <div>
                <label style={{ display:"block", fontSize:"11px", color:"var(--text-secondary)", marginBottom:"6px" }}>VALOR MENSAL (R$)</label>
                <input type="number" step="0.01" value={finValor} onChange={e=>setFinValor(e.target.value)} placeholder="Ex: 1500"
                  style={{ width:"100%", background:"var(--card-bg)", border:"1px solid var(--border)", borderRadius:"8px", padding:"9px 12px", color:"var(--navy)", fontSize:"13px", boxSizing:"border-box" as const }}/>
              </div>
              <div style={{ display:"flex", gap:"10px" }}>
                <div style={{ flex:1 }}>
                  <label style={{ display:"block", fontSize:"11px", color:"var(--text-secondary)", marginBottom:"6px" }}>{finFreq==="quinzenal"?"1º DIA":"DIA DE VENCIMENTO"}</label>
                  <input type="number" min="1" max="31" value={finDia} onChange={e=>setFinDia(e.target.value)} placeholder="Ex: 5"
                    style={{ width:"100%", background:"var(--card-bg)", border:"1px solid var(--border)", borderRadius:"8px", padding:"9px 12px", color:"var(--navy)", fontSize:"13px", boxSizing:"border-box" as const, textAlign:"center" as const }}/>
                </div>
                {finFreq==="quinzenal" && (
                  <div style={{ flex:1 }}>
                    <label style={{ display:"block", fontSize:"11px", color:"var(--text-secondary)", marginBottom:"6px" }}>2º DIA</label>
                    <input type="number" min="1" max="31" value={finDia2} onChange={e=>setFinDia2(e.target.value)} placeholder="Ex: 20"
                      style={{ width:"100%", background:"var(--card-bg)", border:"1px solid var(--border)", borderRadius:"8px", padding:"9px 12px", color:"var(--navy)", fontSize:"13px", boxSizing:"border-box" as const, textAlign:"center" as const }}/>
                  </div>
                )}
              </div>
              {modalFinanceiro.data_entrada && (
                <p style={{ fontSize:"11px", color:"var(--text-secondary)", margin:0 }}>Data de entrada usada: <strong style={{ color:"var(--text-secondary)" }}>{modalFinanceiro.data_entrada}</strong></p>
              )}
            </div>
            <div style={{ padding:"14px 20px", borderTop:"1px solid var(--border)", display:"flex", justifyContent:"flex-end", gap:"8px" }}>
              <button onClick={()=>setModalFinanceiro(null)} style={{ background:"var(--hover-row)", border:"none", borderRadius:"8px", padding:"10px 20px", cursor:"pointer", color:"var(--navy)", fontSize:"13px" }}>Cancelar</button>
              <button onClick={criarNoFinanceiro} disabled={finSalvando}
                style={{ background:"var(--success)", border:"none", borderRadius:"8px", padding:"10px 20px", cursor:"pointer", color:"#FFFFFF", fontWeight:"700", fontSize:"13px", opacity:finSalvando?0.7:1 }}>
                {finSalvando ? "Criando..." : "Criar Cliente + Recorrência"}
              </button>
            </div>
          </div>
        </div>
      )}
      {modalNovoCliente && <ModalNovoCliente agId={agId} cadastros={cadastros} onClose={()=>setModalNovoCliente(false)} onSave={()=>{setModalNovoCliente(false);carregar();}}/>}
      {modalColunas && <ModalColunas colunas={colunas} onSave={(novas: any) => { salvarColunas(novas); setModalColunas(false); }} onClose={() => setModalColunas(false)} />}
      {painelAberto && <PainelLateral cliente={painelAberto} onClose={()=>setPainelAberto(null)}/>}
      {perfilAberto && (
        <PainelPerfil
          cliente={perfilAberto}
          cadastro={perfilAberto.cadastro_id ? cadastrosMap[perfilAberto.cadastro_id] || null : null}
          todos_cadastros={cadastros}
          relatorios={relatorios}
          alertas={alertas}
          onClose={()=>setPerfilAberto(null)}
          onVincular={(cadastroId)=>vincularCadastro(perfilAberto.id, cadastroId)}
          onVincularRelatorio={async (relId) => {
            await supabase.from("controle_clientes").update({ relatorio_id: relId }).eq("id", perfilAberto.id);
            setClientes(prev => prev.map(c => c.id === perfilAberto.id ? { ...c, relatorio_id: relId || undefined } : c));
            setPerfilAberto(prev => prev ? { ...prev, relatorio_id: relId || undefined } : prev);
          }}
          onVincularAlerta={async (alertaId, _nome, ativo) => {
            await supabase.from("alertas_saldo").update({ ativo }).eq("id", alertaId);
            setAlertas(prev => prev.map(a => a.id === alertaId ? { ...a, ativo } : a));
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Modal Editar Colunas (drag to reorder + toggle visibility)         */
/* ------------------------------------------------------------------ */

function ModalColunas({ colunas, onSave, onClose }: { colunas: any[]; onSave: (c: any[]) => void; onClose: () => void }) {
  const dragIdx = useRef<number | null>(null);
  const [items, setItems] = useState(() => {
    const visKeys = new Set(colunas.map((c: any) => c.key));
    const ordered: { key: string; label: string; w: number; visible: boolean }[] = [];
    colunas.forEach((c: any) => {
      const def = COLUNAS_PADRAO.find(d => d.key === c.key);
      ordered.push({ key: c.key, label: c.label, w: c.w || def?.w || 120, visible: true });
    });
    COLUNAS_PADRAO.forEach(d => { if (!visKeys.has(d.key)) ordered.push({ ...d, visible: false }); });
    return ordered;
  });

  const toggle = (key: string) => setItems(prev => prev.map(i => i.key === key ? { ...i, visible: !i.visible } : i));

  const move = (from: number, to: number) => {
    setItems(prev => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const salvar = () => {
    onSave(items.filter(i => i.visible).map(({ key, label, w }) => ({ key, label, w })));
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center" }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"var(--card-bg)", border:"1px solid var(--border)", borderRadius:12, width:400, maxHeight:"80vh", display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"16px 20px", borderBottom:"1px solid var(--border)" }}>
          <h3 style={{ fontSize:15, fontWeight:600, color:"var(--navy)", margin:0 }}>Editar Colunas</h3>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-secondary)", padding:4 }}><X size={16}/></button>
        </div>
        <p style={{ padding:"8px 20px 0", fontSize:11, color:"var(--text-secondary)", margin:0 }}>Arraste para reordenar. Clique no toggle para mostrar/esconder.</p>
        <div style={{ flex:1, overflowY:"auto", padding:"12px 20px" }}>
          {items.map((item, idx) => (
            <div
              key={item.key}
              draggable
              onDragStart={() => { dragIdx.current = idx; }}
              onDragOver={e => { e.preventDefault(); }}
              onDrop={() => { if (dragIdx.current !== null && dragIdx.current !== idx) move(dragIdx.current, idx); dragIdx.current = null; }}
              style={{
                display:"flex", alignItems:"center", gap:10, padding:"8px 10px", marginBottom:4,
                background: item.visible ? "var(--hover-row)" : "var(--off-white)", borderRadius:8, cursor:"grab",
                border: "1px solid var(--border)", opacity: item.visible ? 1 : 0.5,
              }}
            >
              <span style={{ color:"var(--text-secondary)", cursor:"grab", fontSize:14 }}>&#x2807;</span>
              <span style={{ flex:1, fontSize:13, color: item.visible ? "var(--navy)" : "var(--text-secondary)", fontWeight: item.visible ? 500 : 400 }}>{item.label}</span>
              <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                {idx > 0 && <button onClick={() => move(idx, idx-1)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-secondary)", padding:2 }}><ArrowUp size={12}/></button>}
                {idx < items.length-1 && <button onClick={() => move(idx, idx+1)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-secondary)", padding:2 }}><ArrowDown size={12}/></button>}
                <button onClick={() => toggle(item.key)}
                  style={{
                    width:36, height:20, borderRadius:10, border:"none", cursor:"pointer",
                    background: item.visible ? "var(--brand)" : "var(--border)",
                    position:"relative", transition:"background 0.2s",
                  }}>
                  <span style={{
                    position:"absolute", top:2, left: item.visible ? 18 : 2,
                    width:16, height:16, borderRadius:"50%", background:"#fff",
                    transition:"left 0.2s",
                  }}/>
                </button>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display:"flex", gap:8, padding:"12px 20px", borderTop:"1px solid var(--border)", justifyContent:"flex-end" }}>
          <button onClick={() => { setItems(COLUNAS_PADRAO.map(c => ({ ...c, visible: true }))); }}
            style={{ background:"var(--hover-row)", border:"1px solid var(--border)", borderRadius:6, padding:"8px 16px", color:"var(--text-secondary)", fontSize:12, cursor:"pointer" }}>
            Resetar Padrão
          </button>
          <button onClick={salvar}
            style={{ background:"var(--brand)", border:"none", borderRadius:6, padding:"8px 20px", color:"#FFFFFF", fontWeight:600, fontSize:12, cursor:"pointer" }}>
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
