"use client";

import { useState, useEffect } from "react";
import { Search, RefreshCw, TrendingDown } from "lucide-react";
import { supabase, getAgenciaId } from "@/lib/hooks";

interface ClienteChurn {
  id: string; nome: string; instagram: string;
  data_entrada: string; data_churn: string;
  consultor: string; gestor: string; squad: string;
  investimento_mensal: number; motivo_churn: string;
  feedback: string; grupo: string;
}

const GRUPOS_CHURN = [
  "Todos",
  "CHURN JANEIRO", "CHURN FEVEREIRO", "CHURN MARÇO",
  "CHURN OUTUBRO", "CHURN NOVEMBRO", "CHURN DEZEMBRO",
  "CLIENTES INADIMPLENTES OUTUBRO", "CLIENTES INADIMPLENTES NOVEMBRO",
];

export default function ChurnPage() {
  const [clientes, setClientes] = useState<ClienteChurn[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [grupoFiltro, setGrupoFiltro] = useState("Todos");

  const carregar = async () => {
    const agId = await getAgenciaId();
    const { data } = await supabase.from("controle_clientes")
      .select("*").eq("agencia_id", agId!).eq("status", "saiu")
      .order("grupo").order("nome");
    setClientes(data || []);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const filtrados = clientes.filter(c => {
    const matchBusca = c.nome?.toLowerCase().includes(busca.toLowerCase());
    const matchGrupo = grupoFiltro === "Todos" || c.grupo === grupoFiltro;
    return matchBusca && matchGrupo;
  });

  const totalInvestimento = filtrados.reduce((s, c) => s + (Number(c.investimento_mensal) || 0), 0);

  const grupos = clientes.reduce((acc: Record<string, number>, c) => {
    acc[c.grupo] = (acc[c.grupo] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="animate-in">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"20px" }}>
        <div>
          <div className="breadcrumb"><a href="/">Início</a><span>›</span><span className="current">Churn</span></div>
          <h1 style={{ fontSize:"22px", fontWeight:"600" }}>Churn de Clientes</h1>
          <p style={{ fontSize:"13px", color:"#606060", marginTop:"4px" }}>{clientes.length} clientes no histórico de churn</p>
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
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"12px", marginBottom:"20px" }}>
        {[
          { label:"Total Churn", value:clientes.length, cor:"#ef4444" },
          { label:"Filtrados", value:filtrados.length, cor:"#f59e0b" },
          { label:"Investimento Perdido", value:`R$ ${totalInvestimento.toLocaleString("pt-BR")}`, cor:"#ef4444" },
          { label:"Grupos", value:Object.keys(grupos).length, cor:"#606060" },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding:"12px 16px" }}>
            <p style={{ fontSize:"11px", color:"#606060", margin:0 }}>{k.label}</p>
            <p style={{ fontSize:"20px", fontWeight:"700", color:k.cor, margin:0 }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filtro por grupo */}
      <div style={{ display:"flex", gap:"8px", marginBottom:"16px", flexWrap:"wrap" }}>
        {["Todos", ...Object.keys(grupos)].map(g => (
          <button key={g} onClick={() => setGrupoFiltro(g)} style={{
            padding:"4px 12px", borderRadius:"20px", border:"1px solid",
            borderColor: grupoFiltro === g ? "#ef4444" : "#2e2e2e",
            background: grupoFiltro === g ? "rgba(239,68,68,0.1)" : "transparent",
            color: grupoFiltro === g ? "#ef4444" : "#606060",
            cursor:"pointer", fontSize:"12px", whiteSpace:"nowrap",
          }}>
            {g === "Todos" ? `Todos (${clientes.length})` : `${g} (${grupos[g]})`}
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
              <th>GRUPO</th>
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
              <tr><td colSpan={10} style={{ textAlign:"center", color:"#606060", padding:"48px" }}>Carregando...</td></tr>
            ) : !filtrados.length ? (
              <tr><td colSpan={10} style={{ textAlign:"center", color:"#606060", padding:"48px" }}>Nenhum registro encontrado.</td></tr>
            ) : filtrados.map(c => (
              <tr key={c.id}>
                <td style={{ fontWeight:"600", color:"#f0f0f0" }}>{c.nome}</td>
                <td style={{ color:"#a0a0a0", fontSize:"12px" }}>{c.data_entrada || "—"}</td>
                <td>
                  <span style={{ fontSize:"12px", padding:"2px 8px", borderRadius:"10px", background:"rgba(239,68,68,0.1)", color:"#ef4444" }}>
                    {c.data_churn || "—"}
                  </span>
                </td>
                <td style={{ color:"#606060", fontSize:"12px" }}>{c.grupo || "—"}</td>
                <td style={{ color:"#a0a0a0", fontSize:"12px" }}>{c.consultor || "—"}</td>
                <td style={{ color:"#a0a0a0", fontSize:"12px" }}>{c.gestor || "—"}</td>
                <td style={{ color:"#a0a0a0", fontSize:"12px" }}>{c.squad || "—"}</td>
                <td style={{ color:"#f0f0f0", fontSize:"12px" }}>
                  {c.investimento_mensal ? `R$ ${Number(c.investimento_mensal).toLocaleString("pt-BR")}` : "—"}
                </td>
                <td style={{ color:"#a0a0a0", fontSize:"12px", maxWidth:"200px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {c.motivo_churn || "—"}
                </td>
                <td style={{ color:"#a0a0a0", fontSize:"12px", maxWidth:"200px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
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
