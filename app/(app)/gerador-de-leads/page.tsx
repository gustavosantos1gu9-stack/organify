"use client";

import { useState, useEffect } from "react";
import { Search, RefreshCw, TrendingDown, UserMinus, DollarSign, Users } from "lucide-react";
import KPICard from "@/components/ui/KPICard";
import { supabase, getAgenciaId } from "@/lib/hooks";

interface ClienteChurn {
  id: string; nome: string; instagram: string;
  data_entrada: string; data_churn: string;
  consultor: string; gestor: string; squad: string;
  investimento_mensal: number; motivo_churn: string;
  feedback: string; grupo: string;
}

function formatarData(d: string) {
  if (!d) return "—";
  const limpo = d.trim();
  if (limpo.includes("/")) return limpo;
  if (limpo.match(/^\d{4}-\d{2}-\d{2}/)) {
    const [y, m, dia] = limpo.split("T")[0].split("-");
    return `${dia}/${m}/${y}`;
  }
  return limpo;
}

// Extrair mês/ano do campo data_churn para filtro
function getMesAno(d: string) {
  if (!d) return "";
  // Formato Jan/2026, Out/2025 etc
  if (d.includes("/")) return d;
  return d;
}

export default function ChurnPage() {
  const [clientes, setClientes] = useState<ClienteChurn[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroMes, setFiltroMes] = useState("Todos");

  const carregar = async () => {
    const agId = await getAgenciaId();
    const { data } = await supabase.from("controle_clientes")
      .select("*").eq("agencia_id", agId!).eq("status", "saiu")
      .order("nome");
    setClientes(data || []);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  // Meses únicos para filtro
  const meses = ["Todos", ...Array.from(new Set(clientes.map(c => getMesAno(c.data_churn)).filter(Boolean)))];

  const filtrados = clientes.filter(c => {
    const matchBusca = c.nome?.toLowerCase().includes(busca.toLowerCase());
    const matchMes = filtroMes === "Todos" || getMesAno(c.data_churn) === filtroMes;
    return matchBusca && matchMes;
  });

  const totalInvestimento = filtrados.reduce((s, c) => s + (Number(c.investimento_mensal) || 0), 0);
  const mediaInvestimento = filtrados.length > 0 ? totalInvestimento / filtrados.length : 0;

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
            <input className="search-input" placeholder="Buscar..." value={busca}
              onChange={e => setBusca(e.target.value)} style={{ paddingLeft:"32px", width:"200px" }}/>
          </div>
          <button onClick={carregar} className="btn-ghost" style={{ padding:"8px", cursor:"pointer" }}><RefreshCw size={14}/></button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"16px", marginBottom:"20px" }}>
        <KPICard label="Total Churn" value={clientes.length} change={0} icon={<UserMinus size={16}/>} iconBg="red"/>
        <KPICard label="Filtrados" value={filtrados.length} change={0} icon={<Users size={16}/>} iconBg="red"/>
        <KPICard label="Invest. Perdido" value={`R$ ${totalInvestimento.toLocaleString("pt-BR")}`} change={0} icon={<DollarSign size={16}/>} iconBg="red"/>
        <KPICard label="Ticket Médio" value={`R$ ${Math.round(mediaInvestimento).toLocaleString("pt-BR")}`} change={0} icon={<TrendingDown size={16}/>} iconBg="red"/>
      </div>

      {/* Filtro por Mês/Ano */}
      <div style={{ display:"flex", gap:"8px", marginBottom:"16px", flexWrap:"wrap" }}>
        {meses.map(m => (
          <button key={m} onClick={() => setFiltroMes(m)} style={{
            padding:"4px 12px", borderRadius:"20px", border:"1px solid",
            borderColor: filtroMes === m ? "#ef4444" : "#2e2e2e",
            background: filtroMes === m ? "rgba(239,68,68,0.1)" : "transparent",
            color: filtroMes === m ? "#ef4444" : "#606060",
            cursor:"pointer", fontSize:"12px", whiteSpace:"nowrap",
          }}>
            {m === "Todos" ? `Todos (${clientes.length})` : `${m} (${clientes.filter(c => getMesAno(c.data_churn) === m).length})`}
          </button>
        ))}
      </div>

      {/* Tabela */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>NOME</th>
              <th>DATA ENTRADA</th>
              <th>DATA CHURN</th>
              <th>CONSULTOR</th>
              <th>GESTOR</th>
              <th>SQUAD</th>
              <th>INVESTIMENTO</th>
              <th>MOTIVO CHURN</th>
              <th>FEEDBACK</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ textAlign:"center", color:"#606060", padding:"48px" }}>Carregando...</td></tr>
            ) : !filtrados.length ? (
              <tr><td colSpan={9} style={{ textAlign:"center", color:"#606060", padding:"48px" }}>Nenhum registro encontrado.</td></tr>
            ) : filtrados.map(c => (
              <tr key={c.id}>
                <td style={{ fontWeight:"600", color:"#f0f0f0" }}>{c.nome}</td>
                <td style={{ color:"#a0a0a0", fontSize:"12px" }}>{formatarData(c.data_entrada)}</td>
                <td>
                  <span style={{ fontSize:"12px", padding:"2px 8px", borderRadius:"10px", background:"rgba(239,68,68,0.1)", color:"#ef4444" }}>
                    {c.data_churn || "—"}
                  </span>
                </td>
                <td style={{ color:"#a0a0a0", fontSize:"12px" }}>{c.consultor || "—"}</td>
                <td style={{ color:"#a0a0a0", fontSize:"12px" }}>{c.gestor || "—"}</td>
                <td style={{ color:"#a0a0a0", fontSize:"12px" }}>{c.squad || "—"}</td>
                <td style={{ color:"#f0f0f0", fontSize:"12px" }}>
                  {c.investimento_mensal ? `R$ ${Number(c.investimento_mensal).toLocaleString("pt-BR")}` : "—"}
                </td>
                <td style={{ color:"#a0a0a0", fontSize:"12px", maxWidth:"180px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {c.motivo_churn || "—"}
                </td>
                <td style={{ color:"#a0a0a0", fontSize:"12px", maxWidth:"180px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {c.feedback || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtrados.length > 0 && (
          <div style={{ padding:"10px 16px", borderTop:"1px solid #2e2e2e", fontSize:"12px", color:"#606060" }}>
            {filtrados.length} registro{filtrados.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}
