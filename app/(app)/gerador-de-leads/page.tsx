"use client";

import { useState, useMemo } from "react";
import { Search, UserMinus, Users, TrendingDown, DollarSign, AlertCircle } from "lucide-react";
import KPICard from "@/components/ui/KPICard";
import Filtros from "@/components/ui/Filtros";
import PeriodSelector from "@/components/ui/PeriodSelector";
import { useClientes } from "@/lib/hooks";
import { formatCurrency } from "@/lib/utils";

const FILTROS_GRUPOS = [
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
];

export default function ChurnPage() {
  const hoje = new Date();
  const [from, setFrom] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split("T")[0]);
  const [to, setTo] = useState(new Date(hoje.getFullYear(), hoje.getMonth()+1, 0).toISOString().split("T")[0]);
  const [busca, setBusca] = useState("");
  const [filtros, setFiltros] = useState<Record<string, string>>({});
  const { data: clientes } = useClientes();

  const churnados = useMemo(() => {
    return (clientes ?? []).filter(c => {
      const isSaiu = c.status_recorrencia === "saiu" || c.status === "cancelado";
      if (!isSaiu) return false;
      if (filtros.servico && c.servico !== filtros.servico) return false;
      if (filtros.frequencia && c.frequencia !== filtros.frequencia) return false;
      if (filtros.origem && c.origens?.nome !== filtros.origem) return false;
      if (busca && !c.nome.toLowerCase().includes(busca.toLowerCase())) return false;
      return true;
    });
  }, [clientes, filtros, busca]);

  const ativosNoPeriodo = useMemo(() => {
    return (clientes ?? []).filter(c => {
      const data = c.created_at.split("T")[0];
      return (c.status === "ativo" || c.status_recorrencia === "ativo") && data <= to;
    });
  }, [clientes, to]);

  const totalChurn = churnados.length;
  const totalAtivos = ativosNoPeriodo.length;
  const baseCalculo = totalAtivos + totalChurn;
  const churnRate = baseCalculo > 0 ? ((totalChurn / baseCalculo) * 100).toFixed(1) : "0.0";
  const receitaPerdida = churnados.reduce((a, b) => a + (b.valor_oportunidade || 0), 0);
  const mrrPerdido = churnados.filter(c => c.servico === "assessoria").reduce((a, b) => {
    const v = b.valor_oportunidade || 0;
    if (b.frequencia === "quinzenal") return a + v;
    if (b.frequencia === "trimestral") return a + (v * 3) / 3;
    return a + v;
  }, 0);
  const tempoMedioMeses = churnados.length > 0
    ? Math.round(churnados.reduce((a, b) => {
        return a + Math.round((new Date().getTime() - new Date(b.created_at).getTime()) / (1000*60*60*24*30));
      }, 0) / churnados.length)
    : 0;

  return (
    <div className="animate-in">
      <div className="breadcrumb">
        <a href="/">Início</a><span>›</span><span className="current">Churn</span>
      </div>
      <h1 style={{ fontSize:"22px", fontWeight:"600", marginBottom:"8px" }}>Churn</h1>
      <p style={{ fontSize:"13px", color:"#606060", marginBottom:"24px" }}>
        Clientes que encerraram o contrato. Base: clientes ativos + saídas no período.
      </p>

      <PeriodSelector onChange={(_, f, t) => { setFrom(f); setTo(t); }}/>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"16px", marginBottom:"16px" }}>
        <KPICard label="Churn rate" value={`${churnRate}%`} change={0} icon={<TrendingDown size={16}/>} iconBg="red"/>
        <KPICard label="Clientes que saíram" value={totalChurn} change={0} icon={<UserMinus size={16}/>} iconBg="red"/>
        <KPICard label="Base do período" value={baseCalculo} change={0} icon={<Users size={16}/>} iconBg="green"/>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"16px", marginBottom:"24px" }}>
        <KPICard label="Receita perdida" value={formatCurrency(receitaPerdida)} change={0} icon={<DollarSign size={16}/>} iconBg="red"/>
        <KPICard label="MRR perdido" value={formatCurrency(mrrPerdido)} change={0} icon={<AlertCircle size={16}/>} iconBg="red"/>
        <KPICard label="Tempo médio como cliente" value={`${tempoMedioMeses} meses`} change={0} icon={<Users size={16}/>} iconBg="amber"/>
      </div>

      <div style={{ background:"rgba(239,68,68,0.06)", border:"1px solid rgba(239,68,68,0.15)", borderRadius:"10px", padding:"14px 18px", marginBottom:"24px", fontSize:"13px", color:"#a0a0a0" }}>
        <strong style={{ color:"#ef4444" }}>Fórmula:</strong> Churn Rate = (Saídas ÷ Base do período) × 100
        &nbsp;→&nbsp;
        <strong style={{ color:"#f0f0f0" }}>{totalChurn} ÷ {baseCalculo} × 100 = {churnRate}%</strong>
      </div>

      <div className="table-wrapper">
        <div style={{ padding:"16px", display:"flex", gap:"12px", borderBottom:"1px solid #2e2e2e", flexWrap:"wrap" }}>
          <div style={{ position:"relative", flex:1, minWidth:"200px" }}>
            <Search size={14} style={{ position:"absolute", left:"12px", top:"50%", transform:"translateY(-50%)", color:"#606060" }}/>
            <input className="search-input" placeholder="Buscar clientes..." value={busca} onChange={e => setBusca(e.target.value)}/>
          </div>
          <Filtros grupos={FILTROS_GRUPOS} valores={filtros}
            onChange={(k, v) => setFiltros(f => ({ ...f, [k]: v }))}
            onLimpar={() => setFiltros({})}/>
        </div>

        <div className="table-scroll">
          <table style={{ minWidth:"800px" }}>
            <thead>
              <tr>
                <th>NOME</th>
                <th>SERVIÇO</th>
                <th>FREQUÊNCIA</th>
                <th>TICKET</th>
                <th>ORIGEM</th>
                <th>TEMPO COMO CLIENTE</th>
                <th>CIDADE</th>
                <th>ESTADO</th>
              </tr>
            </thead>
            <tbody>
              {churnados.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign:"center", color:"#606060", padding:"48px" }}>
                    {(clientes ?? []).filter(c => c.status_recorrencia === "saiu" || c.status === "cancelado").length === 0
                      ? "Nenhum cliente com churn. 🎉"
                      : "Nenhum resultado para os filtros."}
                  </td>
                </tr>
              ) : churnados.map(c => {
                const meses = Math.round((new Date().getTime() - new Date(c.created_at).getTime()) / (1000*60*60*24*30));
                return (
                  <tr key={c.id}>
                    <td>
                      <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                        <div style={{ width:"30px", height:"30px", borderRadius:"50%", background:"rgba(239,68,68,0.15)", color:"#ef4444", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"12px", fontWeight:"600", flexShrink:0 }}>
                          {c.nome.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontWeight:"500" }}>{c.nome}</span>
                      </div>
                    </td>
                    <td>
                      {c.servico
                        ? <span className={`badge ${c.servico==="assessoria"?"badge-green":"badge-gray"}`} style={{ textTransform:"capitalize" }}>{c.servico}</span>
                        : <span style={{ color:"#606060" }}>—</span>}
                    </td>
                    <td>
                      {c.frequencia
                        ? <span className="badge badge-gray" style={{ textTransform:"capitalize" }}>{c.frequencia}</span>
                        : <span style={{ color:"#606060" }}>—</span>}
                    </td>
                    <td style={{ color:"#ef4444", fontWeight:"600" }}>
                      {c.valor_oportunidade ? formatCurrency(c.valor_oportunidade) : "—"}
                    </td>
                    <td><span className="badge badge-gray">{c.origens?.nome ?? "—"}</span></td>
                    <td style={{ color:"#a0a0a0" }}>{meses > 0 ? `${meses} meses` : "< 1 mês"}</td>
                    <td style={{ color:"#a0a0a0", fontSize:"12px" }}>{c.cidade || "—"}</td>
                    <td style={{ color:"#a0a0a0", fontSize:"12px" }}>{c.estado || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
