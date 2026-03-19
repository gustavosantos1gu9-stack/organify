"use client";

import { useState, useEffect } from "react";
import { Search, RefreshCw, Plus, Edit2, ExternalLink, Instagram } from "lucide-react";
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

const COLUNAS = [
  { key: "nome", label: "Nome", fixo: true },
  { key: "status", label: "Status Cliente" },
  { key: "instagram", label: "Instagram" },
  { key: "data_entrada", label: "Data de Entrada" },
  { key: "data_inicio_campanha", label: "Data Início Campanha" },
  { key: "agendamentos", label: "Agendamentos Mensais" },
  { key: "faturamento_medio", label: "Faturamento Médio" },
  { key: "progresso_gestor", label: "P. Gestor T." },
  { key: "progresso_consultor", label: "Progresso Consultor" },
  { key: "feed", label: "Feed" },
  { key: "feedback", label: "Feedback/Resultado" },
  { key: "sdr", label: "SDR" },
  { key: "head_squad", label: "HEAD SQUAD" },
  { key: "consultor", label: "Consultor" },
  { key: "gestor", label: "Gestor" },
  { key: "squad", label: "Squad" },
  { key: "investimento_mensal", label: "Investimento Mensal" },
  { key: "ultimo_aumento", label: "Último Aumento Inv." },
  { key: "acao", label: "Ação" },
  { key: "acao_feita", label: "Ação Feita?" },
  { key: "otimizacoes", label: "Otimizações (G.T.)" },
  { key: "tarefas", label: "Tarefas (C.)" },
  { key: "datas_otimizacoes", label: "Datas Otimizações" },
  { key: "motivo", label: "Motivo" },
  { key: "razao_nome", label: "RAZÃO + NOME" },
];

function CelulaEditavel({ valor, onSave }: { valor: string; onSave: (v: string) => void }) {
  const [editando, setEditando] = useState(false);
  const [v, setV] = useState(valor || "");

  if (editando) return (
    <input autoFocus value={v} onChange={e => setV(e.target.value)}
      onBlur={() => { setEditando(false); onSave(v); }}
      onKeyDown={e => { if (e.key === "Enter") { setEditando(false); onSave(v); } if (e.key === "Escape") { setEditando(false); setV(valor||""); }}}
      style={{ background:"#1a1a1a", border:"1px solid #29ABE2", borderRadius:"4px", padding:"4px 8px", color:"#f0f0f0", fontSize:"12px", width:"100%", minWidth:"80px" }}/>
  );

  return (
    <span onClick={() => setEditando(true)} style={{ cursor:"pointer", padding:"4px", borderRadius:"4px", display:"block", minHeight:"24px", fontSize:"12px", color: v ? "#f0f0f0" : "#3a3a3a" }}
      title="Clique para editar">
      {v || "—"}
    </span>
  );
}

export default function ControleClientesPage() {
  const [clientes, setClientes] = useState<ControleCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");

  const carregar = async () => {
    const agId = await getAgenciaId();
    const { data } = await supabase.from("controle_clientes")
      .select("*").eq("agencia_id", agId!).eq("status", "ativo")
      .order("nome");
    setClientes(data || []);
    setLoading(false);
  };

  const atualizar = async (id: string, campo: string, valor: string) => {
    await supabase.from("controle_clientes").update({ [campo]: valor }).eq("id", id);
  };

  useEffect(() => { carregar(); }, []);

  const filtrados = clientes.filter(c =>
    c.nome?.toLowerCase().includes(busca.toLowerCase()) ||
    c.consultor?.toLowerCase().includes(busca.toLowerCase()) ||
    c.gestor?.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="animate-in">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"20px" }}>
        <div>
          <div className="breadcrumb"><a href="/">Início</a><span>›</span><span className="current">Controle de Clientes</span></div>
          <h1 style={{ fontSize:"22px", fontWeight:"600" }}>Controle de Clientes</h1>
          <p style={{ fontSize:"13px", color:"#606060", marginTop:"4px" }}>
            {filtrados.length} clientes ativos
          </p>
        </div>
        <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
          <div style={{ position:"relative" }}>
            <Search size={13} style={{ position:"absolute", left:"10px", top:"50%", transform:"translateY(-50%)", color:"#606060" }}/>
            <input className="search-input" placeholder="Buscar cliente..." value={busca}
              onChange={e => setBusca(e.target.value)} style={{ paddingLeft:"32px", width:"220px" }}/>
          </div>
          <button onClick={carregar} className="btn-ghost" style={{ padding:"8px", cursor:"pointer" }}>
            <RefreshCw size={14}/>
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"12px", marginBottom:"20px" }}>
        {[
          { label:"Total Ativos", value:clientes.length },
          { label:"Investimento Total", value:`R$ ${clientes.reduce((s,c) => s + (Number(c.investimento_mensal)||0), 0).toLocaleString("pt-BR")}` },
          { label:"Com Consultor", value:clientes.filter(c=>c.consultor).length },
          { label:"Com Gestor", value:clientes.filter(c=>c.gestor).length },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding:"12px 16px" }}>
            <p style={{ fontSize:"11px", color:"#606060", margin:0 }}>{k.label}</p>
            <p style={{ fontSize:"20px", fontWeight:"700", color:"#f0f0f0", margin:0 }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Tabela horizontal com scroll */}
      <div style={{ overflowX:"auto", border:"1px solid #2e2e2e", borderRadius:"12px" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"12px" }}>
          <thead>
            <tr style={{ background:"#1a1a1a", borderBottom:"1px solid #2e2e2e" }}>
              {COLUNAS.map(col => (
                <th key={col.key} style={{ padding:"10px 12px", textAlign:"left", fontSize:"11px", color:"#606060", fontWeight:"600", whiteSpace:"nowrap", ...(col.fixo ? { position:"sticky", left:0, background:"#1a1a1a", zIndex:1 } : {}) }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={COLUNAS.length} style={{ textAlign:"center", color:"#606060", padding:"48px" }}>Carregando...</td></tr>
            ) : !filtrados.length ? (
              <tr><td colSpan={COLUNAS.length} style={{ textAlign:"center", color:"#606060", padding:"48px" }}>Nenhum cliente encontrado.</td></tr>
            ) : filtrados.map((c, idx) => (
              <tr key={c.id} style={{ borderBottom:"1px solid #1e1e1e", background:idx%2===0?"transparent":"#0d0d0d" }}>
                {COLUNAS.map(col => (
                  <td key={col.key} style={{ padding:"6px 12px", whiteSpace:"nowrap", maxWidth:"200px", overflow:"hidden", ...(col.fixo ? { position:"sticky", left:0, background:idx%2===0?"#141414":"#111", zIndex:1, fontWeight:"600", color:"#f0f0f0" } : {}) }}>
                    {col.key === "instagram" && c.instagram ? (
                      <a href={c.instagram} target="_blank" rel="noreferrer" style={{ color:"#29ABE2", display:"flex", alignItems:"center", gap:"4px", textDecoration:"none", fontSize:"12px" }}>
                        <Instagram size={11}/> Ver
                      </a>
                    ) : col.key === "investimento_mensal" ? (
                      <CelulaEditavel valor={c.investimento_mensal ? `R$ ${Number(c.investimento_mensal).toLocaleString("pt-BR")}` : ""} onSave={v => atualizar(c.id, col.key, v.replace(/\D/g,""))}/>
                    ) : col.fixo ? (
                      <span style={{ fontSize:"13px", fontWeight:"600" }}>{(c as any)[col.key] || "—"}</span>
                    ) : (
                      <CelulaEditavel valor={(c as any)[col.key] || ""} onSave={v => atualizar(c.id, col.key, v)}/>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize:"11px", color:"#606060", marginTop:"8px" }}>
        💡 Clique em qualquer célula para editar diretamente.
      </p>
    </div>
  );
}
