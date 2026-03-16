"use client";

import { useState } from "react";
import { Search, Plus, ArrowDownToLine, ArrowUpFromLine, TrendingUp, Trash2, X, Check } from "lucide-react";
import KPICard from "@/components/ui/KPICard";
import Filtros from "@/components/ui/Filtros";
import { useMovimentacoes, criarMovimentacao, removerMovimentacao, useClientes } from "@/lib/hooks";
import InputValor from "@/components/ui/InputValor";
import { formatCurrency } from "@/lib/utils";

const FILTROS_GRUPOS = [
  { label:"Tipo", key:"tipo", opcoes:[{ label:"Entradas", value:"entrada" },{ label:"Saídas", value:"saida" }] },
  { label:"Data", key:"data", tipo:"date-range" as const, opcoes:[] },
];

function NovaMovModal({ tipo, onClose, onSave, clientes }: { tipo:"entrada"|"saida"; onClose:()=>void; onSave:(d:Record<string,unknown>)=>void; clientes:{id:string;nome:string}[] }) {
  const [form, setForm] = useState({ descricao:"", valor:"", data:new Date().toISOString().split("T")[0], cliente_id:"", observacoes:"" });
  const set = (k:string,v:string)=>setForm((f)=>({...f,[k]:v}));
  return (
    <div className="modal-overlay" onClick={(e)=>e.target===e.currentTarget&&onClose()}>
      <div className="modal animate-in">
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"24px" }}>
          <h2 style={{ fontSize:"17px",fontWeight:"600" }}>Nova {tipo==="entrada"?"entrada":"saída"}</h2>
          <button onClick={onClose} className="btn-ghost" style={{ padding:"6px" }}><X size={16}/></button>
        </div>
        <div style={{ display:"flex",flexDirection:"column",gap:"14px" }}>
          <div className="form-group">
            <label className="form-label">Descrição *</label>
            <input className="form-input" placeholder="Descrição" value={form.descricao} onChange={(e)=>set("descricao",e.target.value)}/>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px" }}>
            <div className="form-group">
              <label className="form-label">Valor *</label>
              <InputValor value={form.valor} onChange={(v)=>set("valor",v)}/>
            </div>
            <div className="form-group">
              <label className="form-label">Data *</label>
              <input type="date" className="form-input" value={form.data} onChange={(e)=>set("data",e.target.value)}/>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Vincular a cliente (opcional)</label>
            <select className="form-input" value={form.cliente_id} onChange={(e)=>set("cliente_id",e.target.value)}>
              <option value="">Selecione um cliente</option>
              {clientes.map((c)=><option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Observações</label>
            <textarea className="form-input" placeholder="Observações..." value={form.observacoes} onChange={(e)=>set("observacoes",e.target.value)} rows={3} style={{ resize:"vertical" }}/>
          </div>
        </div>
        <div style={{ display:"flex",justifyContent:"flex-end",gap:"8px",marginTop:"24px" }}>
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={()=>{ if(!form.descricao||!form.valor){alert("Preencha descrição e valor");return;} onSave({tipo,...form}); onClose(); }}>
            <Check size={14}/> Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MovimentacoesPage() {
  const [showModal, setShowModal] = useState<"entrada"|"saida"|null>(null);
  const [busca, setBusca] = useState("");
  const [filtros, setFiltros] = useState<Record<string,string>>({});
  const { data: movs, loading, refresh } = useMovimentacoes(busca, filtros.data_de||"", filtros.data_ate||"");
  const { data: clientes } = useClientes();

  const filtrados = (movs??[]).filter((m)=>{
    if (filtros.tipo && m.tipo !== filtros.tipo) return false;
    return true;
  });

  const total = (tipo:string) => filtrados.filter((m)=>m.tipo===tipo).reduce((a,b)=>a+b.valor,0);
  const lucro = total("entrada") - total("saida");

  const handleSalvar = async (data: Record<string,unknown>) => {
    try {
      await criarMovimentacao({
        tipo: data.tipo as "entrada"|"saida",
        descricao: data.descricao as string,
        valor: parseFloat((data.valor as string).replace(/[R$\s.]/g,"").replace(",",".")),
        data: data.data as string,
        cliente_id: data.cliente_id as string || undefined,
        observacoes: data.observacoes as string || undefined,
      });
      refresh();
    } catch(e){ console.error(e); alert("Erro ao salvar"); }
  };

  return (
    <div className="animate-in">
      <div className="breadcrumb"><a href="/">Início</a><span>›</span><span style={{ color:"#a0a0a0" }}>Financeiro</span><span>›</span><span className="current">Movimentações</span></div>
      <h1 style={{ fontSize:"22px",fontWeight:"600",marginBottom:"24px" }}>Movimentações</h1>

      <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"16px",marginBottom:"28px" }}>
        <KPICard label="Entradas" value={formatCurrency(total("entrada"))} change={0} icon={<ArrowDownToLine size={16}/>} iconBg="green"/>
        <KPICard label="Saídas" value={formatCurrency(total("saida"))} change={0} icon={<ArrowUpFromLine size={16}/>} iconBg="red"/>
        <KPICard label="Lucro" value={formatCurrency(lucro)} change={0} icon={<TrendingUp size={16}/>} iconBg={lucro>=0?"green":"red"}/>
      </div>

      <div className="table-wrapper">
        <div style={{ padding:"16px",display:"flex",gap:"12px",borderBottom:"1px solid #2e2e2e",flexWrap:"wrap" }}>
          <div style={{ position:"relative",flex:1,minWidth:"200px" }}>
            <Search size={14} style={{ position:"absolute",left:"12px",top:"50%",transform:"translateY(-50%)",color:"#606060" }}/>
            <input className="search-input" placeholder="Buscar movimentações..." value={busca} onChange={(e)=>setBusca(e.target.value)}/>
          </div>
          <Filtros grupos={FILTROS_GRUPOS} valores={filtros} onChange={(k,v)=>setFiltros((f)=>({...f,[k]:v}))} onLimpar={()=>setFiltros({})}/>
          <button className="btn-primary" onClick={()=>setShowModal("entrada")}><Plus size={14}/> Nova entrada</button>
          <button onClick={()=>setShowModal("saida")} style={{ background:"rgba(239,68,68,0.12)",color:"#ef4444",border:"1px solid rgba(239,68,68,0.2)",padding:"8px 16px",borderRadius:"8px",fontSize:"13px",cursor:"pointer",display:"flex",alignItems:"center",gap:"6px" }}>
            <Plus size={14}/> Nova saída
          </button>
        </div>
        <table>
          <thead>
            <tr><th><input type="checkbox" style={{ width:"14px",height:"14px" }}/></th><th>TIPO</th><th>DESCRIÇÃO</th><th>CLIENTE</th><th>DATA</th><th>VALOR</th><th></th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign:"center",color:"#606060",padding:"40px" }}>Carregando...</td></tr>
            ) : !filtrados.length ? (
              <tr><td colSpan={7} style={{ textAlign:"center",color:"#606060",padding:"48px" }}>Nenhuma movimentação encontrada.</td></tr>
            ) : filtrados.map((m)=>(
              <tr key={m.id}>
                <td><input type="checkbox" style={{ width:"14px",height:"14px" }}/></td>
                <td><span className={`badge ${m.tipo==="entrada"?"badge-green":"badge-red"}`}>{m.tipo==="entrada"?"Entrada":"Saída"}</span></td>
                <td style={{ fontWeight:"500" }}>{m.descricao}</td>
                <td style={{ color:"#a0a0a0",fontSize:"12px" }}>{m.clientes?.nome||"—"}</td>
                <td style={{ color:"#a0a0a0" }}>{new Date(m.data).toLocaleDateString("pt-BR")}</td>
                <td style={{ color:m.tipo==="entrada"?"#22c55e":"#ef4444",fontWeight:"600" }}>
                  {m.tipo==="saida"?"- ":""}{formatCurrency(m.valor)}
                </td>
                <td>
                  <button className="btn-danger" style={{ padding:"5px 10px",fontSize:"12px" }}
                    onClick={async()=>{if(confirm("Remover?")){ await removerMovimentacao(m.id); refresh();}}}>
                    <Trash2 size={12}/> Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showModal && <NovaMovModal tipo={showModal} onClose={()=>setShowModal(null)} onSave={handleSalvar} clientes={clientes?.map((c)=>({id:c.id,nome:c.nome}))||[]}/>}
    </div>
  );
}
