"use client";

import { useState } from "react";
import { Search, Filter, Plus, ArrowDownToLine, ArrowUpFromLine, TrendingUp, Edit2, Trash2 } from "lucide-react";
import KPICard from "@/components/ui/KPICard";
import NovaMovimentacaoModal from "@/components/financeiro/NovaMovimentacaoModal";
import { useMovimentacoes, criarMovimentacao, removerMovimentacao } from "@/lib/hooks";
import { formatCurrency } from "@/lib/utils";

export default function MovimentacoesPage() {
  const [showModal, setShowModal] = useState<"entrada"|"saida"|null>(null);
  const [busca, setBusca] = useState("");
  const { data: movs, loading, refresh } = useMovimentacoes(busca);

  const total = (tipo: string) => movs?.filter((m) => m.tipo === tipo).reduce((a,b) => a + b.valor, 0) ?? 0;
  const lucro = total("entrada") - total("saida");

  const handleSalvar = async (data: Record<string, unknown>) => {
    try {
      await criarMovimentacao({
        tipo: data.tipo as "entrada"|"saida",
        descricao: data.descricao as string,
        valor: parseFloat((data.valor as string).replace(/[^0-9,]/g,"").replace(",",".")) || 0,
        data: data.data as string,
        categoria_id: data.categoria as string || undefined,
        observacoes: data.observacoes as string,
      });
      refresh();
    } catch (e) { console.error(e); alert("Erro ao salvar"); }
  };

  return (
    <div className="animate-in">
      <div className="breadcrumb">
        <a href="/">Início</a><span>›</span><a href="#">Financeiro</a><span>›</span>
        <span className="current">Movimentações</span>
      </div>
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
            <input className="search-input" placeholder="Buscar movimentações..." value={busca} onChange={(e) => setBusca(e.target.value)}/>
          </div>
          <button className="btn-secondary"><Filter size={14}/> Filtros</button>
          <button className="btn-primary" onClick={() => setShowModal("entrada")}><Plus size={14}/> Nova entrada</button>
          <button onClick={() => setShowModal("saida")} style={{ background:"rgba(239,68,68,0.12)",color:"#ef4444",border:"1px solid rgba(239,68,68,0.2)",padding:"8px 16px",borderRadius:"8px",fontSize:"13px",cursor:"pointer",display:"flex",alignItems:"center",gap:"6px" }}>
            <Plus size={14}/> Nova saída
          </button>
        </div>
        <table>
          <thead>
            <tr><th><input type="checkbox" style={{ width:"14px",height:"14px" }}/></th><th>TIPO</th><th>DESCRIÇÃO</th><th>CATEGORIA</th><th>CLIENTE</th><th>DATA</th><th>VALOR</th><th></th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign:"center",color:"#606060",padding:"40px" }}>Carregando...</td></tr>
            ) : !movs?.length ? (
              <tr><td colSpan={8} style={{ textAlign:"center",color:"#606060",padding:"48px" }}>Nenhuma movimentação encontrada.</td></tr>
            ) : movs.map((m) => (
              <tr key={m.id}>
                <td><input type="checkbox" style={{ width:"14px",height:"14px" }}/></td>
                <td><span className={`badge ${m.tipo==="entrada"?"badge-green":"badge-red"}`}>{m.tipo==="entrada"?"Entrada":"Saída"}</span></td>
                <td style={{ fontWeight:"500" }}>{m.descricao}</td>
                <td style={{ color:"#a0a0a0" }}>{m.categorias_financeiras?.nome ?? "—"}</td>
                <td style={{ color:"#a0a0a0" }}>{m.clientes?.nome ?? "—"}</td>
                <td style={{ color:"#a0a0a0" }}>{new Date(m.data).toLocaleDateString("pt-BR")}</td>
                <td style={{ color:m.tipo==="entrada"?"#22c55e":"#ef4444",fontWeight:"600" }}>
                  {m.tipo==="saida"?"- ":""}{formatCurrency(m.valor)}
                </td>
                <td>
                  <div style={{ display:"flex",gap:"6px" }}>
                    <button className="btn-secondary" style={{ padding:"5px 10px",fontSize:"12px" }}><Edit2 size={12}/> Editar</button>
                    <button className="btn-danger" style={{ padding:"5px 10px",fontSize:"12px" }} onClick={async () => { if(confirm("Remover?")){ await removerMovimentacao(m.id); refresh(); } }}>
                      <Trash2 size={12}/> Remover
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && <NovaMovimentacaoModal tipo={showModal} onClose={() => setShowModal(null)} onSave={handleSalvar}/>}
    </div>
  );
}
