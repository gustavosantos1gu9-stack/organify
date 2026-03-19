"use client";

import { useState, useEffect, useRef } from "react";
import { Search, RefreshCw, ChevronDown, ChevronRight, Plus, MessageSquare, X, Send, ArrowUpDown } from "lucide-react";
import { supabase, getAgenciaId } from "@/lib/hooks";

interface ControleCliente {
  id: string; nome: string; status: string; instagram: string;
  data_entrada: string; data_inicio_campanha: string; agendamentos: string;
  faturamento_medio: string; progresso_gestor: string; progresso_consultor: string;
  feed: string; feedback: string; sdr: string; head_squad: string;
  consultor: string; gestor: string; squad: string; investimento_mensal: number;
  ultimo_aumento: string; acao: string; acao_feita: string; otimizacoes: string;
  tarefas: string; datas_otimizacoes: string; motivo: string; razao_nome: string;
  grupo: string; created_at: string;
}

interface Subitem { id: string; cliente_id: string; texto: string; feito: boolean; created_at: string; }
interface Anotacao { id: string; cliente_id: string; cliente_nome: string; usuario: string; conteudo: string; created_at: string; tipo: string; }

const STATUS_OPTS = [
  { value: "ativo", label: "Ativo", cor: "#22c55e" },
  { value: "pausado", label: "Pausado", cor: "#f59e0b" },
  { value: "saiu", label: "Churn", cor: "#ef4444" },
];

const COLUNAS = [
  { key: "status", label: "Status" },
  { key: "data_entrada", label: "Data Entrada" },
  { key: "data_inicio_campanha", label: "Início Camp." },
  { key: "agendamentos", label: "Agendamentos" },
  { key: "faturamento_medio", label: "Fat. Médio" },
  { key: "progresso_gestor", label: "P. Gestor" },
  { key: "progresso_consultor", label: "P. Consultor" },
  { key: "feed", label: "Feed" },
  { key: "feedback", label: "Feedback" },
  { key: "sdr", label: "SDR" },
  { key: "head_squad", label: "HEAD" },
  { key: "consultor", label: "Consultor" },
  { key: "gestor", label: "Gestor" },
  { key: "squad", label: "Squad" },
  { key: "investimento_mensal", label: "Investimento" },
  { key: "ultimo_aumento", label: "Últ. Aumento" },
  { key: "acao", label: "Ação" },
  { key: "acao_feita", label: "Ação Feita?" },
  { key: "otimizacoes", label: "Otimizações" },
  { key: "tarefas", label: "Tarefas" },
  { key: "datas_otimizacoes", label: "Datas Otim." },
  { key: "motivo", label: "Motivo" },
  { key: "razao_nome", label: "Razão + Nome" },
];

const SORT_OPTS = [
  { value: "data_entrada", label: "Data de Entrada" },
  { value: "nome", label: "Nome A-Z" },
  { value: "investimento_mensal", label: "Investimento" },
  { value: "created_at", label: "Data de Criação" },
];

function formatarData(d: string) {
  if (!d) return "";
  // Tentar parsear vários formatos
  const limpo = d.trim();
  if (!limpo) return "";
  // Se já tem / é dd/mm/yyyy
  if (limpo.includes("/")) return limpo;
  // Se tem - pode ser yyyy-mm-dd
  if (limpo.match(/^\d{4}-\d{2}-\d{2}/)) {
    const [y, m, dia] = limpo.split("T")[0].split("-");
    return `${dia}/${m}/${y}`;
  }
  return limpo;
}

function CelulaEditavel({ valor, onSave, tipo = "text" }: { valor: string; onSave: (v: string) => void; tipo?: string }) {
  const [editando, setEditando] = useState(false);
  const [v, setV] = useState(valor || "");

  if (editando) {
    if (tipo === "date") return (
      <input type="date" autoFocus value={v} onChange={e => setV(e.target.value)}
        onBlur={() => { setEditando(false); onSave(v); }}
        style={{ background:"#1a1a1a", border:"1px solid #29ABE2", borderRadius:"4px", padding:"4px", color:"#f0f0f0", fontSize:"12px", width:"130px" }}/>
    );
    return (
      <input autoFocus value={v} onChange={e => setV(e.target.value)}
        onBlur={() => { setEditando(false); onSave(v); }}
        onKeyDown={e => { if (e.key === "Enter") { setEditando(false); onSave(v); } if (e.key === "Escape") { setEditando(false); setV(valor||""); }}}
        style={{ background:"#1a1a1a", border:"1px solid #29ABE2", borderRadius:"4px", padding:"4px 8px", color:"#f0f0f0", fontSize:"12px", width:"100%", minWidth:"80px" }}/>
    );
  }

  return (
    <span onClick={() => setEditando(true)} title="Clique para editar"
      style={{ cursor:"pointer", padding:"4px", borderRadius:"4px", display:"block", minHeight:"24px", fontSize:"12px", color: v ? "#f0f0f0" : "#2a2a2a" }}>
      {tipo === "date" ? formatarData(v) : (v || "—")}
    </span>
  );
}

function StatusSelect({ valor, onSave }: { valor: string; onSave: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const opt = STATUS_OPTS.find(s => s.value === valor) || STATUS_OPTS[0];
  return (
    <div style={{ position:"relative" }}>
      <button onClick={() => setOpen(!open)} style={{ display:"flex", alignItems:"center", gap:"6px", background:"none", border:"none", cursor:"pointer", padding:"4px 6px", borderRadius:"6px" }}>
        <span style={{ width:"8px", height:"8px", borderRadius:"50%", background:opt.cor, flexShrink:0 }}/>
        <span style={{ fontSize:"12px", color:opt.cor }}>{opt.label}</span>
      </button>
      {open && (
        <div style={{ position:"absolute", top:"100%", left:0, background:"#1a1a1a", border:"1px solid #2e2e2e", borderRadius:"8px", zIndex:100, minWidth:"120px", overflow:"hidden" }}>
          {STATUS_OPTS.map(s => (
            <button key={s.value} onClick={() => { onSave(s.value); setOpen(false); }} style={{ display:"flex", alignItems:"center", gap:"8px", padding:"8px 12px", width:"100%", background:"none", border:"none", cursor:"pointer", color:s.cor, fontSize:"12px" }}>
              <span style={{ width:"8px", height:"8px", borderRadius:"50%", background:s.cor }}/>
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PainelLateral({ cliente, onClose, agId }: { cliente: ControleCliente; onClose: () => void; agId: string }) {
  const [aba, setAba] = useState<"atualizacoes"|"log">("atualizacoes");
  const [anotacoes, setAnotacoes] = useState<Anotacao[]>([]);
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    const { data } = await supabase.from("anotacoes").select("*")
      .eq("agencia_id", agId).eq("cliente_id", cliente.id)
      .order("created_at", { ascending: false });
    setAnotacoes(data || []);
  };

  const salvar = async () => {
    if (!texto.trim() || salvando) return;
    setSalvando(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      const nomeUser = user?.user?.user_metadata?.nome || user?.user?.email?.split("@")[0] || "Usuário";
      await supabase.from("anotacoes").insert({
        agencia_id: agId, cliente_id: cliente.id, cliente_nome: cliente.nome,
        usuario: nomeUser, conteudo: texto.trim(), tipo: aba, created_at: new Date().toISOString(),
      });
      // Log de atividade
      await supabase.from("anotacoes").insert({
        agencia_id: agId, cliente_id: cliente.id, cliente_nome: cliente.nome,
        usuario: nomeUser, conteudo: `Adicionou uma atualização`, tipo: "log", created_at: new Date().toISOString(),
      });
      setTexto("");
      await carregar();
    } finally { setSalvando(false); }
  };

  useEffect(() => { carregar(); }, [cliente.id]);

  const filtradas = anotacoes.filter(a => a.tipo === aba);

  return (
    <div style={{ position:"fixed", right:0, top:0, bottom:0, width:"380px", background:"#141414", borderLeft:"1px solid #2e2e2e", zIndex:200, display:"flex", flexDirection:"column" }}>
      <div style={{ padding:"14px 16px", borderBottom:"1px solid #2e2e2e", display:"flex", alignItems:"center", gap:"10px", background:"#1a1a1a" }}>
        <div style={{ flex:1 }}>
          <p style={{ fontSize:"14px", fontWeight:"600", color:"#f0f0f0", margin:0 }}>{cliente.nome}</p>
          <p style={{ fontSize:"11px", color:"#606060", margin:0 }}>Atualizações e Log</p>
        </div>
        <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"#606060" }}><X size={16}/></button>
      </div>

      {/* Abas */}
      <div style={{ display:"flex", borderBottom:"1px solid #2e2e2e" }}>
        {[{key:"atualizacoes",label:"Atualizações"},{key:"log",label:"Log de Atividade"}].map(t => (
          <button key={t.key} onClick={() => setAba(t.key as any)} style={{
            flex:1, padding:"10px", background:"none", border:"none", cursor:"pointer",
            fontSize:"12px", color: aba === t.key ? "#29ABE2" : "#606060",
            borderBottom: aba === t.key ? "2px solid #29ABE2" : "2px solid transparent",
            fontWeight: aba === t.key ? "600" : "400",
          }}>{t.label}</button>
        ))}
      </div>

      {/* Conteúdo */}
      <div style={{ flex:1, overflowY:"auto", padding:"12px" }}>
        {!filtradas.length ? (
          <p style={{ color:"#606060", fontSize:"13px", textAlign:"center", marginTop:"40px" }}>
            {aba === "atualizacoes" ? "Nenhuma atualização ainda." : "Nenhuma atividade registrada."}
          </p>
        ) : filtradas.map(a => (
          <div key={a.id} style={{ background:"#1a1a1a", borderRadius:"8px", padding:"10px 12px", marginBottom:"8px", border:"1px solid #2e2e2e" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"4px" }}>
              <span style={{ fontSize:"12px", fontWeight:"600", color:"#29ABE2" }}>{a.usuario}</span>
              <span style={{ fontSize:"10px", color:"#606060" }}>
                {new Date(a.created_at).toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", year:"2-digit", hour:"2-digit", minute:"2-digit" })}
              </span>
            </div>
            <p style={{ fontSize:"13px", color:"#f0f0f0", margin:0, whiteSpace:"pre-wrap" }}>{a.conteudo}</p>
          </div>
        ))}
      </div>

      {/* Input só para atualizações */}
      {aba === "atualizacoes" && (
        <div style={{ padding:"12px", borderTop:"1px solid #2e2e2e", background:"#1a1a1a" }}>
          <textarea className="form-input" placeholder="Escrever atualização..." value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); salvar(); }}}
            style={{ resize:"none", minHeight:"60px", marginBottom:"8px" }}/>
          <button onClick={salvar} disabled={salvando || !texto.trim()} className="btn-primary" style={{ cursor:"pointer", width:"100%", fontSize:"12px" }}>
            <Send size={12}/> {salvando ? "Enviando..." : "Enviar"}
          </button>
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
  const [sortDir, setSortDir] = useState<"asc"|"desc">("desc");
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [subitens, setSubitens] = useState<Record<string, Subitem[]>>({});
  const [painelAberto, setPainelAberto] = useState<ControleCliente|null>(null);
  const [agId, setAgId] = useState("");
  const [usuarios, setUsuarios] = useState<string[]>([]);
  const [times, setTimes] = useState<string[]>([]);

  const carregar = async () => {
    const id = await getAgenciaId();
    setAgId(id || "");
    const { data } = await supabase.from("controle_clientes")
      .select("*").eq("agencia_id", id!).eq("status", "ativo");
    setClientes(data || []);

    // Buscar usuários e times
    const { data: users } = await supabase.from("usuarios_agencia").select("nome").eq("agencia_id", id!);
    const { data: tms } = await supabase.from("times").select("nome").eq("agencia_id", id!);
    setUsuarios(users?.map((u: any) => u.nome) || []);
    setTimes(tms?.map((t: any) => t.nome) || []);
    setLoading(false);
  };

  const atualizar = async (id: string, campo: string, valor: string | number, clienteNome: string) => {
    await supabase.from("controle_clientes").update({ [campo]: valor }).eq("id", id);
    setClientes(prev => prev.map(c => c.id === id ? { ...c, [campo]: valor } : c));
    // Log
    const { data: user } = await supabase.auth.getUser();
    const nomeUser = user?.user?.user_metadata?.nome || user?.user?.email?.split("@")[0] || "Usuário";
    await supabase.from("anotacoes").insert({
      agencia_id: agId, cliente_id: id, cliente_nome: clienteNome,
      usuario: nomeUser, conteudo: `Alterou "${campo}" para "${valor}"`, tipo: "log",
      created_at: new Date().toISOString(),
    });
  };

  const toggleExpandir = async (id: string) => {
    const novos = new Set(expandidos);
    if (novos.has(id)) { novos.delete(id); }
    else {
      novos.add(id);
      if (!subitens[id]) {
        const { data } = await supabase.from("subitens_clientes").select("*").eq("cliente_id", id).order("created_at");
        setSubitens(prev => ({ ...prev, [id]: data || [] }));
      }
    }
    setExpandidos(novos);
  };

  const adicionarSubitem = async (clienteId: string) => {
    const texto = prompt("Texto do subitem:");
    if (!texto) return;
    const { data } = await supabase.from("subitens_clientes").insert({
      cliente_id: clienteId, agencia_id: agId, texto, feito: false, created_at: new Date().toISOString(),
    }).select().single();
    if (data) setSubitens(prev => ({ ...prev, [clienteId]: [...(prev[clienteId]||[]), data] }));
  };

  const toggleSubitem = async (clienteId: string, subId: string, feito: boolean) => {
    await supabase.from("subitens_clientes").update({ feito: !feito }).eq("id", subId);
    setSubitens(prev => ({ ...prev, [clienteId]: prev[clienteId].map(s => s.id === subId ? { ...s, feito: !feito } : s) }));
  };

  useEffect(() => { carregar(); }, []);

  const filtrados = clientes
    .filter(c => c.nome?.toLowerCase().includes(busca.toLowerCase()))
    .sort((a, b) => {
      let va = (a as any)[sort] || "";
      let vb = (b as any)[sort] || "";
      if (sort === "investimento_mensal") { va = Number(va); vb = Number(vb); }
      if (sortDir === "asc") return va > vb ? 1 : -1;
      return va < vb ? 1 : -1;
    });

  return (
    <div className="animate-in">
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"20px" }}>
        <div>
          <div className="breadcrumb"><a href="/">Início</a><span>›</span><span className="current">Controle de Clientes</span></div>
          <h1 style={{ fontSize:"22px", fontWeight:"600" }}>Controle de Clientes</h1>
          <p style={{ fontSize:"13px", color:"#606060", marginTop:"4px" }}>{filtrados.length} clientes ativos</p>
        </div>
        <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
          <div style={{ position:"relative" }}>
            <Search size={13} style={{ position:"absolute", left:"10px", top:"50%", transform:"translateY(-50%)", color:"#606060" }}/>
            <input className="search-input" placeholder="Buscar cliente..." value={busca}
              onChange={e => setBusca(e.target.value)} style={{ paddingLeft:"32px", width:"200px" }}/>
          </div>
          {/* Sort */}
          <select value={sort} onChange={e => setSort(e.target.value)}
            style={{ background:"#1a1a1a", border:"1px solid #2e2e2e", borderRadius:"8px", padding:"7px 10px", color:"#f0f0f0", fontSize:"12px", cursor:"pointer" }}>
            {SORT_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <button onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")} className="btn-ghost" style={{ padding:"7px 10px", cursor:"pointer", fontSize:"12px", display:"flex", alignItems:"center", gap:"4px" }}>
            <ArrowUpDown size={13}/> {sortDir === "asc" ? "↑" : "↓"}
          </button>
          <button onClick={carregar} className="btn-ghost" style={{ padding:"8px", cursor:"pointer" }}><RefreshCw size={14}/></button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"12px", marginBottom:"20px" }}>
        {[
          { label:"Total Ativos", value:clientes.length },
          { label:"Investimento Total", value:`R$ ${clientes.reduce((s,c) => s+(Number(c.investimento_mensal)||0),0).toLocaleString("pt-BR")}` },
          { label:"Com Consultor", value:clientes.filter(c=>c.consultor).length },
          { label:"Com Gestor", value:clientes.filter(c=>c.gestor).length },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding:"12px 16px" }}>
            <p style={{ fontSize:"11px", color:"#606060", margin:0 }}>{k.label}</p>
            <p style={{ fontSize:"20px", fontWeight:"700", color:"#f0f0f0", margin:0 }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Tabela */}
      <div style={{ overflowX:"auto", border:"1px solid #2e2e2e", borderRadius:"12px", marginRight: painelAberto ? "390px" : "0", transition:"margin 0.2s" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"12px" }}>
          <thead>
            <tr style={{ background:"#1a1a1a", borderBottom:"1px solid #2e2e2e" }}>
              <th style={{ padding:"10px 8px", width:"30px" }}></th>
              <th style={{ padding:"10px 12px", textAlign:"left", fontSize:"11px", color:"#606060", fontWeight:"600", position:"sticky", left:0, background:"#1a1a1a", zIndex:1, whiteSpace:"nowrap" }}>NOME</th>
              {COLUNAS.map(col => (
                <th key={col.key} style={{ padding:"10px 12px", textAlign:"left", fontSize:"11px", color:"#606060", fontWeight:"600", whiteSpace:"nowrap" }}>{col.label}</th>
              ))}
              <th style={{ padding:"10px 8px", width:"40px" }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={COLUNAS.length+3} style={{ textAlign:"center", color:"#606060", padding:"48px" }}>Carregando...</td></tr>
            ) : !filtrados.length ? (
              <tr><td colSpan={COLUNAS.length+3} style={{ textAlign:"center", color:"#606060", padding:"48px" }}>Nenhum cliente encontrado.</td></tr>
            ) : filtrados.map((c, idx) => (
              <>
                <tr key={c.id} style={{ borderBottom:"1px solid #1e1e1e", background:idx%2===0?"transparent":"#0a0a0a" }}>
                  {/* Expandir */}
                  <td style={{ padding:"6px 8px", textAlign:"center" }}>
                    <button onClick={() => toggleExpandir(c.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#606060", padding:"2px" }}>
                      {expandidos.has(c.id) ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                    </button>
                  </td>
                  {/* Nome */}
                  <td style={{ padding:"6px 12px", position:"sticky", left:0, background:idx%2===0?"#141414":"#111", zIndex:1, fontWeight:"600", color:"#f0f0f0", whiteSpace:"nowrap" }}>
                    {c.nome}
                  </td>
                  {/* Colunas */}
                  {COLUNAS.map(col => (
                    <td key={col.key} style={{ padding:"2px 8px", whiteSpace:"nowrap" }}>
                      {col.key === "status" ? (
                        <StatusSelect valor={c.status} onSave={v => atualizar(c.id, "status", v, c.nome)}/>
                      ) : col.key === "head_squad" || col.key === "consultor" || col.key === "gestor" ? (
                        <select value={(c as any)[col.key] || ""} onChange={e => atualizar(c.id, col.key, e.target.value, c.nome)}
                          style={{ background:"#1a1a1a", border:"1px solid #2e2e2e", borderRadius:"4px", padding:"4px 6px", color:"#f0f0f0", fontSize:"12px", cursor:"pointer", minWidth:"100px" }}>
                          <option value="">—</option>
                          {usuarios.length ? usuarios.map(u => <option key={u} value={u}>{u}</option>) : <option value={(c as any)[col.key]}>{(c as any)[col.key]}</option>}
                        </select>
                      ) : col.key === "squad" ? (
                        <select value={(c as any)[col.key] || ""} onChange={e => atualizar(c.id, col.key, e.target.value, c.nome)}
                          style={{ background:"#1a1a1a", border:"1px solid #2e2e2e", borderRadius:"4px", padding:"4px 6px", color:"#f0f0f0", fontSize:"12px", cursor:"pointer", minWidth:"100px" }}>
                          <option value="">—</option>
                          {times.length ? times.map(t => <option key={t} value={t}>{t}</option>) : <option value={(c as any)[col.key]}>{(c as any)[col.key]}</option>}
                        </select>
                      ) : col.key === "data_entrada" || col.key === "data_inicio_campanha" ? (
                        <CelulaEditavel valor={(c as any)[col.key] || ""} tipo="date" onSave={v => atualizar(c.id, col.key, v, c.nome)}/>
                      ) : col.key === "investimento_mensal" ? (
                        <CelulaEditavel valor={c.investimento_mensal ? String(c.investimento_mensal) : ""} onSave={v => atualizar(c.id, col.key, Number(v.replace(/\D/g,"")), c.nome)}/>
                      ) : (
                        <CelulaEditavel valor={(c as any)[col.key] || ""} onSave={v => atualizar(c.id, col.key, v, c.nome)}/>
                      )}
                    </td>
                  ))}
                  {/* Balão de atualizações */}
                  <td style={{ padding:"6px 8px", textAlign:"center" }}>
                    <button onClick={() => setPainelAberto(painelAberto?.id === c.id ? null : c)}
                      style={{ background:"none", border:"none", cursor:"pointer", color: painelAberto?.id === c.id ? "#29ABE2" : "#606060", padding:"2px" }}>
                      <MessageSquare size={14}/>
                    </button>
                  </td>
                </tr>
                {/* Subitens */}
                {expandidos.has(c.id) && (
                  <tr key={`sub-${c.id}`} style={{ background:"#0a0a0a", borderBottom:"1px solid #1e1e1e" }}>
                    <td></td>
                    <td colSpan={COLUNAS.length+2} style={{ padding:"8px 16px 12px 32px" }}>
                      <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                        {(subitens[c.id] || []).map(s => (
                          <div key={s.id} style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                            <input type="checkbox" checked={s.feito} onChange={() => toggleSubitem(c.id, s.id, s.feito)}
                              style={{ cursor:"pointer", accentColor:"#29ABE2" }}/>
                            <span style={{ fontSize:"12px", color: s.feito ? "#606060" : "#f0f0f0", textDecoration: s.feito ? "line-through" : "none" }}>
                              {s.texto}
                            </span>
                          </div>
                        ))}
                        <button onClick={() => adicionarSubitem(c.id)} style={{ display:"flex", alignItems:"center", gap:"4px", background:"none", border:"1px dashed #2e2e2e", borderRadius:"6px", padding:"4px 10px", cursor:"pointer", color:"#606060", fontSize:"12px", width:"fit-content", marginTop:"4px" }}>
                          <Plus size={12}/> Adicionar subitem
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {painelAberto && <PainelLateral cliente={painelAberto} onClose={() => setPainelAberto(null)} agId={agId}/>}
    </div>
  );
}
