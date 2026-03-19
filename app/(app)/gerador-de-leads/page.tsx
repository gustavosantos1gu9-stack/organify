"use client";

import { useState, useEffect } from "react";
import { Search, RefreshCw, ArrowUpDown } from "lucide-react";
import KPICard from "@/components/ui/KPICard";
import { UserMinus, DollarSign, TrendingDown, Users } from "lucide-react";
import { supabase, getAgenciaId } from "@/lib/hooks";

interface ClienteChurn {
  id: string; nome: string; instagram: string;
  data_entrada: string; data_churn: string;
  consultor: string; gestor: string; squad: string;
  investimento_mensal: number; motivo_churn: string;
  feedback: string; grupo: string;
}

// Todos os meses possíveis até dez/2026
const MESES_FIXOS = [
  "Jan/2025","Fev/2025","Mar/2025","Abr/2025","Mai/2025","Jun/2025",
  "Jul/2025","Ago/2025","Set/2025","Out/2025","Nov/2025","Dez/2025",
  "Jan/2026","Fev/2026","Mar/2026","Abr/2026","Mai/2026","Jun/2026",
  "Jul/2026","Ago/2026","Set/2026","Out/2026","Nov/2026","Dez/2026",
];

function formatarData(d: string) {
  if (!d) return "—";
  const limpo = d.trim().split(" ")[0].split("T")[0];
  if (limpo.includes("/")) {
    const p = limpo.split("/");
    if (p.length===3) return `${p[0].padStart(2,"0")}/${p[1].padStart(2,"0")}/${p[2]}`;
    return limpo;
  }
  if (limpo.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [y,m,dia] = limpo.split("-");
    return `${dia}/${m}/${y}`;
  }
  return limpo;
}

export default function ChurnPage() {
  const [clientes, setClientes] = useState<ClienteChurn[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroMes, setFiltroMes] = useState("Todos");
  const [sort, setSort] = useState("data_churn");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("desc");

  const carregar = async () => {
    const agId = await getAgenciaId();
    const { data } = await supabase.from("controle_clientes")
      .select("*").eq("agencia_id",agId!).eq("status","saiu").order("nome");
    setClientes(data||[]);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  // Meses que têm dados
  const mesesComDados = Array.from(new Set(clientes.map(c=>c.data_churn).filter(Boolean)));

  const filtrados = clientes
    .filter(c => {
      const matchBusca = c.nome?.toLowerCase().includes(busca.toLowerCase());
      const matchMes = filtroMes==="Todos" || c.data_churn===filtroMes;
      return matchBusca && matchMes;
    })
    .sort((a,b) => {
      let va=(a as any)[sort]||""; let vb=(b as any)[sort]||"";
      if (sort==="investimento_mensal"){va=Number(va);vb=Number(vb);}
      if (sortDir==="asc") return va>vb?1:-1;
      return va<vb?1:-1;
    });

  const totalInvestimento = filtrados.reduce((s,c)=>s+(Number(c.investimento_mensal)||0),0);
  const mediaInvestimento = filtrados.length>0?totalInvestimento/filtrados.length:0;

  return (
    <div className="animate-in">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"20px" }}>
        <div>
          <div className="breadcrumb"><a href="/">Início</a><span>›</span><span className="current">Churn</span></div>
          <h1 style={{ fontSize:"22px", fontWeight:"600" }}>Churn de Clientes</h1>
          <p style={{ fontSize:"13px", color:"#606060", marginTop:"4px" }}>{clientes.length} clientes no histórico</p>
        </div>
        <div style={{ display:"flex", gap:"8px" }}>
          <div style={{ position:"relative" }}>
            <Search size={13} style={{ position:"absolute", left:"10px", top:"50%", transform:"translateY(-50%)", color:"#606060" }}/>
            <input className="search-input" placeholder="Buscar..." value={busca} onChange={e=>setBusca(e.target.value)} style={{ paddingLeft:"32px", width:"200px" }}/>
          </div>
          <select value={sort} onChange={e=>setSort(e.target.value)} style={{ background:"#1a1a1a", border:"1px solid #2e2e2e", borderRadius:"8px", padding:"7px 10px", color:"#f0f0f0", fontSize:"12px", cursor:"pointer" }}>
            <option value="data_churn">Data Churn</option>
            <option value="data_entrada">Data Entrada</option>
            <option value="nome">Nome</option>
            <option value="investimento_mensal">Investimento</option>
          </select>
          <button onClick={()=>setSortDir(d=>d==="asc"?"desc":"asc")} className="btn-ghost" style={{ padding:"7px 10px", cursor:"pointer", fontSize:"12px" }}>
            {sortDir==="asc"?"↑ Crescente":"↓ Decrescente"}
          </button>
          <button onClick={carregar} className="btn-ghost" style={{ padding:"8px", cursor:"pointer" }}><RefreshCw size={14}/></button>
        </div>
      </div>

      {/* KPIs */}
      {(() => {
        const hoje = new Date();
        const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
        const mesAtual = `${meses[hoje.getMonth()]}/${hoje.getFullYear()}`;
        const mesPassadoIdx = hoje.getMonth() === 0 ? 11 : hoje.getMonth() - 1;
        const anoMesPassado = hoje.getMonth() === 0 ? hoje.getFullYear() - 1 : hoje.getFullYear();
        const mesPassado = `${meses[mesPassadoIdx]}/${anoMesPassado}`;
        const churnMes = clientes.filter(c => c.data_churn === mesAtual).length;
        const churnMesPassado = clientes.filter(c => c.data_churn === mesPassado).length;
        return (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"16px", marginBottom:"20px" }}>
            <KPICard label="Total Churn" value={clientes.length} change={0} icon={<UserMinus size={16}/>} iconBg="red"/>
            <KPICard label={`Churn ${mesAtual}`} value={churnMes} change={0} icon={<TrendingDown size={16}/>} iconBg="red"/>
            <KPICard label={`Churn ${mesPassado}`} value={churnMesPassado} change={0} icon={<TrendingDown size={16}/>} iconBg="red"/>
            <KPICard label="Ticket Médio Perdido" value={`R$ ${Math.round(mediaInvestimento).toLocaleString("pt-BR")}`} change={0} icon={<DollarSign size={16}/>} iconBg="red"/>
          </div>
        );
      })()}

      {/* Tabela resultado do mês */}
      {(() => {
        const hoje = new Date();
        const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
        const mesAtual = `${meses[hoje.getMonth()]}/${hoje.getFullYear()}`;
        const mesPassadoIdx = hoje.getMonth()===0?11:hoje.getMonth()-1;
        const anoMesPassado = hoje.getMonth()===0?hoje.getFullYear()-1:hoje.getFullYear();
        const mesPassado = `${meses[mesPassadoIdx]}/${anoMesPassado}`;
        const churnMes = clientes.filter(c=>c.data_churn===mesAtual).length;
        const churnMesPassado = clientes.filter(c=>c.data_churn===mesPassado).length;
        const diffChurn = churnMes - churnMesPassado;
        const totalAtivos = 49; // base estimada - idealmente viria de controle_clientes
        const churnRate = totalAtivos > 0 ? ((churnMes / totalAtivos) * 100).toFixed(1) : "0";
        const churnRatePass = totalAtivos > 0 ? ((churnMesPassado / totalAtivos) * 100).toFixed(1) : "0";
        
        return (
          <div className="card" style={{ marginBottom:"16px", padding:"16px 20px" }}>
            <h3 style={{ fontSize:"13px", fontWeight:"600", color:"#f0f0f0", marginBottom:"12px" }}>
              📊 Resultado — {mesAtual}
            </h3>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"16px" }}>
              <div>
                <p style={{ fontSize:"11px", color:"#606060", margin:"0 0 4px" }}>Churn este mês vs mês passado</p>
                <p style={{ fontSize:"16px", fontWeight:"700", color:diffChurn>0?"#ef4444":diffChurn<0?"#22c55e":"#f0f0f0", margin:0 }}>
                  {diffChurn>0?`+${diffChurn}`:diffChurn} ({diffChurn>0?"▲":"▼"} {Math.abs(churnMes - churnMesPassado)} clientes)
                </p>
              </div>
              <div>
                <p style={{ fontSize:"11px", color:"#606060", margin:"0 0 4px" }}>Churn Rate este mês</p>
                <p style={{ fontSize:"16px", fontWeight:"700", color:"#ef4444", margin:0 }}>{churnRate}%</p>
              </div>
              <div>
                <p style={{ fontSize:"11px", color:"#606060", margin:"0 0 4px" }}>Churn Rate mês passado</p>
                <p style={{ fontSize:"16px", fontWeight:"700", color:"#a0a0a0", margin:0 }}>{churnRatePass}%</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Filtro por Mês/Ano */}
      <div style={{ overflowX:"auto", paddingBottom:"8px", marginBottom:"16px" }}>
        <div style={{ display:"flex", gap:"6px", minWidth:"max-content" }}>
          <button onClick={()=>setFiltroMes("Todos")} style={{
            padding:"4px 12px", borderRadius:"20px", border:"1px solid", cursor:"pointer", fontSize:"12px", whiteSpace:"nowrap",
            borderColor:filtroMes==="Todos"?"#ef4444":"#2e2e2e",
            background:filtroMes==="Todos"?"rgba(239,68,68,0.1)":"transparent",
            color:filtroMes==="Todos"?"#ef4444":"#606060",
          }}>Todos ({clientes.length})</button>
          {MESES_FIXOS.map(m => {
            const count = clientes.filter(c=>c.data_churn===m).length;
            const temDados = count > 0;
            return (
              <button key={m} onClick={()=>setFiltroMes(m)} style={{
                padding:"4px 12px", borderRadius:"20px", border:"1px solid", cursor:"pointer", fontSize:"12px", whiteSpace:"nowrap",
                borderColor:filtroMes===m?"#ef4444":temDados?"#2e2e2e":"#1a1a1a",
                background:filtroMes===m?"rgba(239,68,68,0.1)":"transparent",
                color:filtroMes===m?"#ef4444":temDados?"#a0a0a0":"#333",
                opacity:temDados?1:0.4,
              }}>
                {m}{temDados?` (${count})`:""}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tabela */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr style={{ borderBottom:"1px solid #29ABE230" }}>
              <th style={{ borderRight:"1px solid #29ABE220" }}>NOME</th>
              <th style={{ borderRight:"1px solid #29ABE220" }}>DATA ENTRADA</th>
              <th style={{ borderRight:"1px solid #29ABE220" }}>DATA CHURN</th>
              <th style={{ borderRight:"1px solid #29ABE220" }}>CONSULTOR</th>
              <th style={{ borderRight:"1px solid #29ABE220" }}>GESTOR</th>
              <th style={{ borderRight:"1px solid #29ABE220" }}>SQUAD</th>
              <th style={{ borderRight:"1px solid #29ABE220" }}>INVESTIMENTO</th>
              <th style={{ borderRight:"1px solid #29ABE220" }}>MOTIVO CHURN</th>
              <th>FEEDBACK</th>
            </tr>
          </thead>
          <tbody>
            {loading?(
              <tr><td colSpan={9} style={{ textAlign:"center", color:"#606060", padding:"48px" }}>Carregando...</td></tr>
            ):!filtrados.length?(
              <tr><td colSpan={9} style={{ textAlign:"center", color:"#606060", padding:"48px" }}>Nenhum registro encontrado.</td></tr>
            ):filtrados.map((c,idx)=>(
              <tr key={c.id} style={{ borderBottom:"1px solid #29ABE215", background:idx%2===0?"transparent":"#0a0a0a" }}>
                <td style={{ fontWeight:"600", color:"#f0f0f0", borderRight:"1px solid #29ABE215", whiteSpace:"nowrap" }}>{c.nome}</td>
                <td style={{ color:"#a0a0a0", fontSize:"12px", borderRight:"1px solid #29ABE215", whiteSpace:"nowrap" }}>{formatarData(c.data_entrada)}</td>
                <td style={{ borderRight:"1px solid #29ABE215", whiteSpace:"nowrap" }}><span style={{ fontSize:"12px", padding:"2px 8px", borderRadius:"10px", background:"rgba(239,68,68,0.1)", color:"#ef4444" }}>{c.data_churn||"—"}</span></td>
                <td style={{ color:"#a0a0a0", fontSize:"12px", borderRight:"1px solid #29ABE215", whiteSpace:"nowrap" }}>{c.consultor||"—"}</td>
                <td style={{ color:"#a0a0a0", fontSize:"12px", borderRight:"1px solid #29ABE215", whiteSpace:"nowrap" }}>{c.gestor||"—"}</td>
                <td style={{ color:"#a0a0a0", fontSize:"12px", borderRight:"1px solid #29ABE215", whiteSpace:"nowrap" }}>{c.squad||"—"}</td>
                <td style={{ color:"#f0f0f0", fontSize:"12px", borderRight:"1px solid #29ABE215", whiteSpace:"nowrap" }}>{c.investimento_mensal?`R$ ${Number(c.investimento_mensal).toLocaleString("pt-BR")}`:"—"}</td>
                <td style={{ color:"#a0a0a0", fontSize:"12px", maxWidth:"180px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", borderRight:"1px solid #29ABE215" }}>{c.motivo_churn||"—"}</td>
                <td style={{ color:"#a0a0a0", fontSize:"12px", maxWidth:"180px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.feedback||"—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtrados.length>0&&(
          <div style={{ padding:"10px 16px", borderTop:"1px solid #2e2e2e", fontSize:"12px", color:"#606060" }}>
            {filtrados.length} registro{filtrados.length!==1?"s":""}
          </div>
        )}
      </div>
    </div>
  );
}
