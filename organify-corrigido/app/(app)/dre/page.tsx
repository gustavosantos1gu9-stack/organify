"use client";

import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, TrendingUp, DollarSign, Clock } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from "recharts";
import KPICard from "@/components/ui/KPICard";
import PeriodSelector from "@/components/ui/PeriodSelector";
import { useMovimentacoes, useLancamentosFuturos, useClientes } from "@/lib/hooks";
import { formatCurrency } from "@/lib/utils";

const tooltipStyle = { background:"#1e1e1e",border:"1px solid #2e2e2e",borderRadius:"8px",fontSize:"12px",color:"#f0f0f0" };

export default function DREPage() {
  const hoje = new Date();
  const [from, setFrom] = useState(new Date(hoje.getFullYear(),hoje.getMonth(),1).toISOString().split("T")[0]);
  const [to, setTo] = useState(new Date(hoje.getFullYear(),hoje.getMonth()+1,0).toISOString().split("T")[0]);

  const { data: movs } = useMovimentacoes("", from, to);
  const { data: lancsAll } = useLancamentosFuturos();
  const { data: clientes } = useClientes();

  // Filtrar lançamentos pelo período (data_vencimento dentro do período)
  const lancs = lancsAll?.filter(l => {
    if (from && l.data_vencimento < from) return false;
    if (to && l.data_vencimento > to) return false;
    return true;
  });

  const entradas = movs?.filter((m)=>m.tipo==="entrada").reduce((a,b)=>a+b.valor,0) ?? 0;
  const saidas = movs?.filter((m)=>m.tipo==="saida").reduce((a,b)=>a+b.valor,0) ?? 0;
  const lucro = entradas - saidas;
  const entradasPrev = lancs?.filter((l)=>l.tipo==="entrada"&&!l.pago).reduce((a,b)=>a+b.valor,0) ?? 0;
  const saidasPrev = lancs?.filter((l)=>l.tipo==="saida"&&!l.pago).reduce((a,b)=>a+b.valor,0) ?? 0;
  const clientesAtivos = clientes?.filter((c)=>c.status==="ativo").length ?? 0;
  const receitaMedia = clientesAtivos > 0 ? entradas / clientesAtivos : 0;

  // Agrupar movimentações por mês para o gráfico
  const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const grafMap: Record<string,{entrada:number;saida:number}> = {};
  for (const m of movs ?? []) {
    const d = new Date(m.data);
    const key = MESES[d.getMonth()];
    if (!grafMap[key]) grafMap[key] = { entrada:0,saida:0 };
    grafMap[key][m.tipo as "entrada"|"saida"] += m.valor;
  }
  const grafData = Object.entries(grafMap).map(([mes,v])=>({mes,...v}));

  // Categorias para gráfico de barras
  const catMap: Record<string,number> = {};
  for (const m of movs?.filter((x)=>x.tipo==="entrada") ?? []) {
    const cat = m.categorias_financeiras?.nome || "Sem categoria";
    catMap[cat] = (catMap[cat]||0) + m.valor;
  }
  const catData = Object.entries(catMap).map(([categoria,valor])=>({categoria,valor}));

  return (
    <div className="animate-in">
      <div className="breadcrumb">
        <a href="/">Início</a><span>›</span><span className="current">DRE</span>
      </div>
      <h1 style={{ fontSize:"22px",fontWeight:"600",marginBottom:"24px" }}>DRE</h1>
      <PeriodSelector onChange={(_,f,t)=>{setFrom(f);setTo(t);}}/>

      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"16px",marginBottom:"16px" }}>
        <KPICard label="Entradas" value={formatCurrency(entradas)} change={0} icon={<ArrowDownToLine size={16}/>} iconBg="green"/>
        <KPICard label="Saídas" value={formatCurrency(saidas)} change={0} icon={<ArrowUpFromLine size={16}/>} iconBg="red"/>
        <KPICard label="Lucro" value={formatCurrency(lucro)} change={0} icon={<TrendingUp size={16}/>} iconBg={lucro>=0?"green":"red"}/>
        <KPICard label="Receita média/cliente" value={formatCurrency(receitaMedia)} change={0} icon={<DollarSign size={16}/>} iconBg="green"/>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"16px",marginBottom:"28px" }}>
        <KPICard label="Tempo médio (meses)" value="—" change={0} icon={<Clock size={16}/>} iconBg="blue"/>
        <KPICard label="Entradas previstas" value={formatCurrency(entradasPrev)} change={0} icon={<ArrowDownToLine size={16}/>} iconBg="green"/>
        <KPICard label="Saídas previstas" value={formatCurrency(saidasPrev)} change={0} icon={<ArrowUpFromLine size={16}/>} iconBg="red"/>
        <KPICard label="Receita recorrente" value={formatCurrency(entradas)} change={0} icon={<DollarSign size={16}/>} iconBg="green"/>
      </div>

      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"16px" }}>
        <div className="card">
          <h3 style={{ fontSize:"14px",fontWeight:"500",marginBottom:"20px" }}>Entrada x Saída</h3>
          {grafData.length === 0 ? (
            <p style={{ fontSize:"13px",color:"#606060",textAlign:"center",padding:"40px 0" }}>Nenhuma movimentação no período.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={grafData}>
                <XAxis dataKey="mes" tick={{ fontSize:11,fill:"#606060" }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize:11,fill:"#606060" }} axisLine={false} tickLine={false} tickFormatter={(v)=>`R$${v}`}/>
                <Tooltip contentStyle={tooltipStyle} formatter={(v:number)=>formatCurrency(v)}/>
                <Line type="monotone" dataKey="entrada" stroke="#22c55e" strokeWidth={2} dot={false} name="Entrada"/>
                <Line type="monotone" dataKey="saida" stroke="#ef4444" strokeWidth={2} dot={false} name="Saída"/>
                <Legend wrapperStyle={{ fontSize:"11px" }}/>
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="card">
          <h3 style={{ fontSize:"14px",fontWeight:"500",marginBottom:"20px" }}>Receitas por categoria</h3>
          {catData.length === 0 ? (
            <p style={{ fontSize:"13px",color:"#606060",textAlign:"center",padding:"40px 0" }}>Nenhuma entrada categorizada.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={catData}>
                <XAxis dataKey="categoria" tick={{ fontSize:10,fill:"#606060" }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize:11,fill:"#606060" }} axisLine={false} tickLine={false} tickFormatter={(v)=>`R$${v}`}/>
                <Tooltip contentStyle={tooltipStyle} formatter={(v:number)=>formatCurrency(v)}/>
                <Bar dataKey="valor" fill="#22c55e" radius={[4,4,0,0]} name="Valor"/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
