"use client";

import { useState, useMemo } from "react";
import { Search, Plus, Edit2, Trash2, RefreshCw, Users, UserX, UserMinus, DollarSign, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import KPICard from "@/components/ui/KPICard";
import Filtros from "@/components/ui/Filtros";
import CadastrarClienteModal from "@/components/clientes/CadastrarClienteModal";
import EditarClienteModal from "@/components/clientes/EditarClienteModal";
import { useClientes, criarCliente, removerCliente, Cliente, useMovimentacoes } from "@/lib/hooks";
import { formatCurrency } from "@/lib/utils";

const FILTROS_GRUPOS = [
  { label: "Status", key: "status", opcoes: [
    { label: "Ativo", value: "ativo" },
    { label: "Inadimplente", value: "inadimplente" },
    { label: "Cancelado", value: "cancelado" },
  ]},
  { label: "Recorrência", key: "recorrencia", opcoes: [
    { label: "Recorrente (Ativo)", value: "recorrente" },
    { label: "Pendência", value: "pendencia" },
    { label: "Saiu", value: "saiu" },
  ]},
  { label: "Serviço", key: "servico", opcoes: [
    { label: "Assessoria", value: "assessoria" },
    { label: "Mentoria", value: "mentoria" },
  ]},
  { label: "Frequência", key: "frequencia", opcoes: [
    { label: "Mensal", value: "mensal" },
    { label: "Quinzenal", value: "quinzenal" },
    { label: "Trimestral", value: "trimestral" },
  ]},
  { label: "Origem", key: "origem", opcoes: [
    { label: "Facebook", value: "Facebook" },
    { label: "Instagram", value: "Instagram" },
    { label: "Google", value: "Google" },
    { label: "LinkedIn", value: "LinkedIn" },
    { label: "Indicação", value: "Indicação" },
  ]},
  { label: "Data de cadastro", key: "data", tipo: "date-range" as const, opcoes: [] },
];

type SortKey = "created_at" | "nome" | "status" | "servico" | "frequencia" | "cidade" | "estado" | "valor_oportunidade";
type SortDir = "asc" | "desc";

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (sortKey !== col) return <ChevronsUpDown size={12} style={{ color:"#404040", marginLeft:"4px" }}/>;
  return sortDir === "asc"
    ? <ChevronUp size={12} style={{ color:"#22c55e", marginLeft:"4px" }}/>
    : <ChevronDown size={12} style={{ color:"#22c55e", marginLeft:"4px" }}/>;
}

function StatusBadge({ cliente }: { cliente: Cliente }) {
  const sr = cliente.status_recorrencia || (
    cliente.status === "ativo" ? "ativo" :
    cliente.status === "inadimplente" ? "pendencia" : "saiu"
  );
  if (sr === "ativo") return (
    <div style={{ display:"flex", alignItems:"center", gap:"5px" }}>
      <div style={{ width:"10px", height:"10px", borderRadius:"50%", background:"#22c55e", flexShrink:0 }}/>
      <span style={{ fontSize:"12px", color:"#22c55e" }}>Ativo</span>
    </div>
  );
  if (sr === "pendencia") return (
    <div style={{ display:"flex", alignItems:"center", gap:"5px" }}>
      <div style={{ width:"10px", height:"10px", borderRadius:"50%", background:"#f59e0b", flexShrink:0 }}/>
      <span style={{ fontSize:"12px", color:"#f59e0b" }}>Pendência</span>
    </div>
  );
  return (
    <div style={{ display:"flex", alignItems:"center", gap:"5px" }}>
      <div style={{ width:"10px", height:"10px", borderRadius:"50%", background:"#ef4444", flexShrink:0 }}/>
      <span style={{ fontSize:"12px", color:"#ef4444" }}>Saiu</span>
    </div>
  );
}

export default function ClientesPage() {
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [busca, setBusca] = useState("");
  const [filtros, setFiltros] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { data: clientes, loading, refresh } = useClientes(busca, filtros.status || "");
  const { data: movs } = useMovimentacoes();

  const ativos = clientes?.filter((c) => c.status === "ativo") ?? [];
  const inadimplentes = clientes?.filter((c) => c.status === "inadimplente") ?? [];
  const cancelados = clientes?.filter((c) => c.status === "cancelado") ?? [];
  const receitaTotal = movs?.filter((m) => m.tipo === "entrada").reduce((a, b) => a + b.valor, 0) ?? 0;
  const receitaMedia = ativos.length > 0 ? receitaTotal / ativos.length : 0;
  const churnRate = clientes?.length ? Math.round((cancelados.length / clientes.length) * 100) : 0;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filtrados = useMemo(() => {
    let list = (clientes ?? []).filter((c) => {
      if (filtros.origem && c.origens?.nome !== filtros.origem) return false;
      if (filtros.tipo && c.tipo !== filtros.tipo) return false;
      if (filtros.servico && c.servico !== filtros.servico) return false;
      if (filtros.frequencia && c.frequencia !== filtros.frequencia) return false;
      if (filtros.data_de && c.created_at < filtros.data_de) return false;
      if (filtros.data_ate && c.created_at > filtros.data_ate + "T23:59:59") return false;
      if (filtros.recorrencia === "recorrente" && (c.status_recorrencia || "ativo") !== "ativo") return false;
      if (filtros.recorrencia === "pendencia" && (c.status_recorrencia || "") !== "pendencia") return false;
      if (filtros.recorrencia === "saiu" && (c.status_recorrencia || "") !== "saiu") return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      let va: string | number = "";
      let vb: string | number = "";
      switch (sortKey) {
        case "created_at": va = a.created_at; vb = b.created_at; break;
        case "nome": va = a.nome.toLowerCase(); vb = b.nome.toLowerCase(); break;
        case "status": va = a.status; vb = b.status; break;
        case "servico": va = a.servico || ""; vb = b.servico || ""; break;
        case "frequencia": va = a.frequencia || ""; vb = b.frequencia || ""; break;
        case "cidade": va = a.cidade || ""; vb = b.cidade || ""; break;
        case "estado": va = a.estado || ""; vb = b.estado || ""; break;
        case "valor_oportunidade": va = a.valor_oportunidade || 0; vb = b.valor_oportunidade || 0; break;
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [clientes, filtros, sortKey, sortDir]);

  const thStyle = {
    cursor: "pointer",
    userSelect: "none" as const,
    whiteSpace: "nowrap" as const,
  };
  
  const thContentStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: "2px",
  };

  const handleSalvar = async (data: Record<string, unknown>) => {
    try {
      await criarCliente({
        tipo: data.tipo as string,
        nome: data.nome as string,
        documento: data.documento as string || undefined,
        email: data.email as string || undefined,
        telefone: data.telefone as string || undefined,
        whatsapp: data.whatsapp as boolean,
        instagram: data.instagram as string || undefined,
        empresa: data.empresa as string || undefined,
        valor_oportunidade: parseFloat((data.valor_oportunidade as string)?.replace(/[^0-9,]/g,"").replace(",",".")) || 0,
        faturamento: parseFloat((data.faturamento as string)?.replace(/[^0-9,]/g,"").replace(",",".")) || 0,
        cep: data.cep as string || undefined,
        estado: data.estado as string || undefined,
        cidade: data.cidade as string || undefined,
        logradouro: data.logradouro as string || undefined,
        numero: data.numero as string || undefined,
        complemento: data.complemento as string || undefined,
        bairro: data.bairro as string || undefined,
        observacoes: data.observacoes as string || undefined,
        status: "ativo",
        status_recorrencia: "ativo",
      });
      refresh();
    } catch (e) { console.error(e); alert("Erro ao salvar cliente"); }
  };

  return (
    <div className="animate-in">
      <div className="breadcrumb">
        <a href="/">Início</a><span>›</span><span className="current">Clientes</span>
      </div>
      <h1 style={{ fontSize:"22px", fontWeight:"600", marginBottom:"24px" }}>Clientes</h1>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"16px", marginBottom:"16px" }}>
        <KPICard label="Clientes recorrentes" value={ativos.length} change={0} icon={<Users size={16}/>} iconBg="green"/>
        <KPICard label="Clientes inadimplentes" value={inadimplentes.length} change={0} icon={<UserX size={16}/>} iconBg="red"/>
        <KPICard label="Clientes cancelados" value={cancelados.length} change={0} icon={<UserMinus size={16}/>} iconBg="red"/>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"16px", marginBottom:"28px" }}>
        <KPICard label="Total de clientes" value={clientes?.length ?? 0} change={0} icon={<Users size={16}/>} iconBg="green"/>
        <KPICard label="Receita média por cliente" value={formatCurrency(receitaMedia)} change={0} icon={<DollarSign size={16}/>} iconBg="green"/>
        <KPICard label="Churn rate" value={`${churnRate}%`} change={0} icon={<UserMinus size={16}/>} iconBg={churnRate > 0 ? "red" : "green"}/>
      </div>

      <div className="table-wrapper">
        <div style={{ padding:"16px", display:"flex", gap:"12px", borderBottom:"1px solid #2e2e2e", flexWrap:"wrap" }}>
          <div style={{ position:"relative", flex:1, minWidth:"200px" }}>
            <Search size={14} style={{ position:"absolute", left:"12px", top:"50%", transform:"translateY(-50%)", color:"#606060" }}/>
            <input className="search-input" placeholder="Buscar clientes..." value={busca} onChange={(e) => setBusca(e.target.value)}/>
          </div>
          <Filtros grupos={FILTROS_GRUPOS} valores={filtros}
            onChange={(key, value) => setFiltros((f) => ({ ...f, [key]: value }))}
            onLimpar={() => setFiltros({})}/>
          <button className="btn-primary" onClick={() => setShowModal(true)}><Plus size={14}/> Novo cliente</button>
        </div>

        {Object.values(filtros).some(Boolean) && (
          <div style={{ padding:"8px 16px", background:"rgba(34,197,94,0.05)", borderBottom:"1px solid #2e2e2e", display:"flex", gap:"8px", flexWrap:"wrap" }}>
            {Object.entries(filtros).filter(([,v]) => v).map(([k, v]) => (
              <span key={k} style={{ display:"flex", alignItems:"center", gap:"4px", background:"rgba(34,197,94,0.1)", color:"#22c55e", padding:"3px 10px", borderRadius:"20px", fontSize:"12px" }}>
                {v}
                <button onClick={() => setFiltros((f) => ({ ...f, [k]: "" }))} style={{ background:"none", border:"none", cursor:"pointer", color:"#22c55e", padding:"0", lineHeight:1 }}>×</button>
              </span>
            ))}
          </div>
        )}

        <div style={{ overflowX:"auto" }}>
          <table style={{ minWidth:"1000px" }}>
            <thead>
              <tr>
                <th><input type="checkbox" style={{ width:"14px",height:"14px" }}/></th>
                <th onClick={() => handleSort("status")} style={thStyle}>
                  <span style={thContentStyle}>STATUS <SortIcon col="status" sortKey={sortKey} sortDir={sortDir}/></span>
                </th>
                <th></th>
                <th onClick={() => handleSort("nome")} style={thStyle}>
                  <span style={thContentStyle}>NOME <SortIcon col="nome" sortKey={sortKey} sortDir={sortDir}/></span>
                </th>
                <th onClick={() => handleSort("servico")} style={thStyle}>
                  <span style={thContentStyle}>CATEGORIA <SortIcon col="servico" sortKey={sortKey} sortDir={sortDir}/></span>
                </th>
                <th onClick={() => handleSort("frequencia")} style={thStyle}>
                  <span style={thContentStyle}>FREQUÊNCIA <SortIcon col="frequencia" sortKey={sortKey} sortDir={sortDir}/></span>
                </th>
                <th onClick={() => handleSort("valor_oportunidade")} style={thStyle}>
                  <span style={thContentStyle}>TICKET <SortIcon col="valor_oportunidade" sortKey={sortKey} sortDir={sortDir}/></span>
                </th>
                <th onClick={() => handleSort("cidade")} style={thStyle}>
                  <span style={thContentStyle}>CIDADE <SortIcon col="cidade" sortKey={sortKey} sortDir={sortDir}/></span>
                </th>
                <th onClick={() => handleSort("estado")} style={thStyle}>
                  <span style={thContentStyle}>ESTADO <SortIcon col="estado" sortKey={sortKey} sortDir={sortDir}/></span>
                </th>
                <th onClick={() => handleSort("created_at")} style={thStyle}>
                  <span style={thContentStyle}>CRIADO EM <SortIcon col="created_at" sortKey={sortKey} sortDir={sortDir}/></span>
                </th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} style={{ textAlign:"center",color:"#606060",padding:"40px" }}>Carregando...</td></tr>
              ) : !filtrados.length ? (
                <tr><td colSpan={11} style={{ textAlign:"center",color:"#606060",padding:"40px" }}>Nenhum cliente encontrado.</td></tr>
              ) : filtrados.map((c) => (
                <tr key={c.id}>
                  <td><input type="checkbox" style={{ width:"14px",height:"14px" }}/></td>
                  <td><StatusBadge cliente={c}/></td>
                  <td>
                    <div style={{ width:"32px",height:"32px",borderRadius:"50%",background:"#22c55e20",color:"#22c55e",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"12px",fontWeight:"600" }}>
                      {c.nome.charAt(0).toUpperCase()}
                    </div>
                  </td>
                  <td style={{ fontWeight:"500" }}>{c.nome}</td>
                  <td>
                    {c.servico ? (
                      <span className={`badge ${c.servico==="assessoria"?"badge-green":"badge-gray"}`} style={{ textTransform:"capitalize" }}>
                        {c.servico}
                      </span>
                    ) : <span style={{color:"#606060"}}>—</span>}
                  </td>
                  <td>
                    {c.servico === "assessoria" && c.frequencia ? (
                      <span className="badge badge-gray" style={{ textTransform:"capitalize" }}>{c.frequencia}</span>
                    ) : <span style={{color:"#606060"}}>—</span>}
                  </td>
                  <td style={{ color:"#22c55e", fontWeight:"600" }}>
                    {c.valor_oportunidade ? formatCurrency(c.valor_oportunidade) : "—"}
                  </td>
                  <td style={{ color:"#a0a0a0", fontSize:"12px" }}>{c.cidade || "—"}</td>
                  <td style={{ color:"#a0a0a0", fontSize:"12px" }}>{c.estado || "—"}</td>
                  <td style={{ color:"#a0a0a0" }}>{new Date(c.created_at).toLocaleDateString("pt-BR")}</td>
                  <td>
                    <div style={{ display:"flex",gap:"6px" }}>
                      <button className="btn-ghost" style={{ padding:"5px 8px" }} title="Sincronizar"><RefreshCw size={13}/></button>
                      <button className="btn-secondary" style={{ padding:"5px 10px",fontSize:"12px" }} onClick={() => setEditando(c)}>
                        <Edit2 size={12}/> Editar
                      </button>
                      <button className="btn-danger" style={{ padding:"5px 10px",fontSize:"12px" }} onClick={async()=>{ if(confirm("Remover?")){ await removerCliente(c.id); refresh(); }}}>
                        <Trash2 size={12}/> Remover
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && <CadastrarClienteModal onClose={() => setShowModal(false)} onSave={handleSalvar}/>}
      {editando && <EditarClienteModal cliente={editando} onClose={() => setEditando(null)} onSave={refresh}/>}
    </div>
  );
}
