"use client";

import { useState, useEffect } from "react";
import { ArrowDownToLine, ArrowUpFromLine, TrendingUp, DollarSign, Clock } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from "recharts";
import KPICard from "@/components/ui/KPICard";
import PeriodSelector from "@/components/ui/PeriodSelector";
import { useMovimentacoes, useLancamentosFuturos, useClientes, supabase, getAgenciaId } from "@/lib/hooks";
import { formatCurrency } from "@/lib/utils";

const tooltipStyle = { background:"#1e1e1e",border:"1px solid #2e2e2e",borderRadius:"8px",fontSize:"12px",color:"#f0f0f0" };

export default function DREPage() {
  const hoje = new Date();
  const [from, setFrom] = useState(new Date(hoje.getFullYear(),hoje.getMonth(),1).toISOString().split("T")[0]);
  const [to, setTo] = useState(new Date(hoje.getFullYear(),hoje.getMonth()+1,0).toISOString().split("T")[0]);

  const { data: movs } = useMovimentacoes("", from, to);
  const { data: lancsAll } = useLancamentosFuturos();
  const { data: clientes } = useClientes();

  // Dados mensais pra tabela comparativa
  const [dadosMensais, setDadosMensais] = useState<{mes:string;entradas:number;saidas:number;lucro:number;margem:number;novosClientes:number;novasVendas:number}[]>([]);
  useEffect(() => {
    async function carregarHistorico() {
      const agId = await getAgenciaId();
      if (!agId) return;
      // Buscar movimentações do ano inteiro
      const anoAtual = new Date().getFullYear();
      const { data: todasMovs } = await supabase.from("movimentacoes")
        .select("tipo, valor, data")
        .eq("agencia_id", agId)
        .gte("data", `${anoAtual}-01-01`)
        .lte("data", `${anoAtual}-12-31`);
      const { data: todosClientes } = await supabase.from("clientes")
        .select("id, created_at, valor_oportunidade, frequencia")
        .eq("agencia_id", agId)
        .eq("status", "ativo");

      const MESES_NOMES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
      const mesAtual = new Date().getMonth();
      const resultado = [];

      for (let m = 0; m <= mesAtual; m++) {
        const mesStr = `${anoAtual}-${String(m + 1).padStart(2, "0")}`;
        const movsDoMes = (todasMovs || []).filter(mv => mv.data?.startsWith(mesStr));
        const ent = movsDoMes.filter(mv => mv.tipo === "entrada").reduce((a, b) => a + (b.valor || 0), 0);
        const sai = movsDoMes.filter(mv => mv.tipo === "saida").reduce((a, b) => a + (b.valor || 0), 0);
        const luc = ent - sai;

        const clientesNoMes = (todosClientes || []).filter(c => c.created_at?.startsWith(mesStr));
        const novasVendas = clientesNoMes.reduce((acc, c) => {
          const v = c.valor_oportunidade || 0;
          if (c.frequencia === "trimestral") return acc + v * 3;
          return acc + v;
        }, 0);

        resultado.push({
          mes: MESES_NOMES[m],
          entradas: ent,
          saidas: sai,
          lucro: luc,
          margem: ent > 0 ? Math.round((luc / ent) * 100) : 0,
          novosClientes: clientesNoMes.length,
          novasVendas,
        });
      }
      setDadosMensais(resultado);
    }
    carregarHistorico();
  }, []);

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

  // Novas vendas: clientes que entraram no período selecionado
  // Trimestral soma valor * 3 (os 3 meses pagos de uma vez)
  const clientesNovos = (clientes ?? [])
    .filter(c => c.created_at && c.created_at.split("T")[0] >= from && c.created_at.split("T")[0] <= to);
  const clientesNovosIds = new Set(clientesNovos.map(c => c.id));
  const entradasNovasVendas = clientesNovos.reduce((acc, c) => {
    const v = c.valor_oportunidade || 0;
    if (c.frequencia === "trimestral") return acc + v * 3;
    return acc + v;
  }, 0);
  const entradasRecorrentes = entradas - entradasNovasVendas;

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
        <KPICard label="Margem" value={entradas > 0 ? `${Math.round((lucro / entradas) * 100)}%` : "0%"} change={0} icon={<TrendingUp size={16}/>} iconBg={lucro>=0?"green":"red"}/>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"16px",marginBottom:"16px" }}>
        <KPICard label="Novas vendas" value={formatCurrency(entradasNovasVendas)} change={0} icon={<TrendingUp size={16}/>} iconBg="blue" subtitle={`${clientesNovosIds.size} cliente${clientesNovosIds.size !== 1 ? "s" : ""} novo${clientesNovosIds.size !== 1 ? "s" : ""}`}/>
        <KPICard label="Receita recorrente" value={formatCurrency(entradasRecorrentes)} change={0} icon={<DollarSign size={16}/>} iconBg="green"/>
        <KPICard label="Entradas previstas" value={formatCurrency(entradasPrev)} change={0} icon={<ArrowDownToLine size={16}/>} iconBg="green"/>
        <KPICard label="Saídas previstas" value={formatCurrency(saidasPrev)} change={0} icon={<ArrowUpFromLine size={16}/>} iconBg="red"/>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"16px",marginBottom:"28px" }}>
        <KPICard label="Tempo médio (meses)" value="—" change={0} icon={<Clock size={16}/>} iconBg="blue"/>
        <KPICard label="Receita média/cliente" value={formatCurrency(receitaMedia)} change={0} icon={<DollarSign size={16}/>} iconBg="green"/>
        <KPICard label="Clientes ativos" value={String(clientesAtivos)} change={0} icon={<DollarSign size={16}/>} iconBg="green"/>
        <KPICard label="% Novas vendas" value={entradas > 0 ? `${Math.round((entradasNovasVendas / entradas) * 100)}%` : "0%"} change={0} icon={<TrendingUp size={16}/>} iconBg="blue"/>
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

      {/* Tabela Comparativa Mensal */}
      {dadosMensais.length > 0 && (
        <div className="card" style={{ marginTop:"24px", padding:"16px 20px" }}>
          <h3 style={{ fontSize:"14px",fontWeight:"600",color:"#f0f0f0",marginBottom:"16px" }}>Comparativo Mensal — {new Date().getFullYear()}</h3>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%",borderCollapse:"collapse",fontSize:"12px" }}>
              <thead>
                <tr style={{ borderBottom:"1px solid #29ABE230" }}>
                  {["Mês","Entradas","Saídas","Lucro","Margem","Novas Vendas","Novos Clientes"].map(h=>(
                    <th key={h} style={{ padding:"10px 14px",textAlign:"right",fontSize:"11px",color:"#606060",fontWeight:"600",borderRight:"1px solid #29ABE215" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dadosMensais.map((d,i)=>(
                  <tr key={d.mes} style={{ borderBottom:"1px solid #1e1e1e",background:i%2===0?"transparent":"#0a0a0a" }}>
                    <td style={{ padding:"10px 14px",fontWeight:"600",color:"#f0f0f0",textAlign:"right",borderRight:"1px solid #29ABE215" }}>{d.mes}</td>
                    <td style={{ padding:"10px 14px",color:"#22c55e",textAlign:"right",borderRight:"1px solid #29ABE215" }}>{formatCurrency(d.entradas)}</td>
                    <td style={{ padding:"10px 14px",color:"#ef4444",textAlign:"right",borderRight:"1px solid #29ABE215" }}>{formatCurrency(d.saidas)}</td>
                    <td style={{ padding:"10px 14px",color:d.lucro>=0?"#22c55e":"#ef4444",fontWeight:"600",textAlign:"right",borderRight:"1px solid #29ABE215" }}>{formatCurrency(d.lucro)}</td>
                    <td style={{ padding:"10px 14px",color:d.margem>=0?"#22c55e":"#ef4444",textAlign:"right",borderRight:"1px solid #29ABE215" }}>{d.margem}%</td>
                    <td style={{ padding:"10px 14px",color:"#29ABE2",textAlign:"right",borderRight:"1px solid #29ABE215" }}>{formatCurrency(d.novasVendas)}</td>
                    <td style={{ padding:"10px 14px",color:"#a0a0a0",textAlign:"right" }}>{d.novosClientes}</td>
                  </tr>
                ))}
                {/* Linha de totais */}
                <tr style={{ borderTop:"2px solid #29ABE240",background:"rgba(41,171,226,0.05)" }}>
                  <td style={{ padding:"10px 14px",fontWeight:"700",color:"#29ABE2",textAlign:"right",borderRight:"1px solid #29ABE215" }}>TOTAL</td>
                  <td style={{ padding:"10px 14px",color:"#22c55e",fontWeight:"700",textAlign:"right",borderRight:"1px solid #29ABE215" }}>{formatCurrency(dadosMensais.reduce((a,d)=>a+d.entradas,0))}</td>
                  <td style={{ padding:"10px 14px",color:"#ef4444",fontWeight:"700",textAlign:"right",borderRight:"1px solid #29ABE215" }}>{formatCurrency(dadosMensais.reduce((a,d)=>a+d.saidas,0))}</td>
                  <td style={{ padding:"10px 14px",color:dadosMensais.reduce((a,d)=>a+d.lucro,0)>=0?"#22c55e":"#ef4444",fontWeight:"700",textAlign:"right",borderRight:"1px solid #29ABE215" }}>{formatCurrency(dadosMensais.reduce((a,d)=>a+d.lucro,0))}</td>
                  <td style={{ padding:"10px 14px",color:"#a0a0a0",textAlign:"right",borderRight:"1px solid #29ABE215" }}>
                    {(()=>{ const te=dadosMensais.reduce((a,d)=>a+d.entradas,0); const tl=dadosMensais.reduce((a,d)=>a+d.lucro,0); return te>0?`${Math.round((tl/te)*100)}%`:"0%"; })()}
                  </td>
                  <td style={{ padding:"10px 14px",color:"#29ABE2",fontWeight:"700",textAlign:"right",borderRight:"1px solid #29ABE215" }}>{formatCurrency(dadosMensais.reduce((a,d)=>a+d.novasVendas,0))}</td>
                  <td style={{ padding:"10px 14px",color:"#a0a0a0",fontWeight:"700",textAlign:"right" }}>{dadosMensais.reduce((a,d)=>a+d.novosClientes,0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
