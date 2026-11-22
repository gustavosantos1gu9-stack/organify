"use client";

import { Faixa } from "@/components/ui/Canvas";

import { useState, useEffect } from "react";
import { Search, RefreshCw } from "lucide-react";
import { supabase, getAgenciaId } from "@/lib/hooks";

interface ClienteChurn {
  id: string; nome: string; instagram: string;
  data_entrada: string; data_churn: string;
  consultor: string; gestor: string; squad: string;
  investimento_mensal: number; motivo_churn: string;
  feedback: string; grupo: string;
}

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

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
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [historico, setHistorico] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroMes, setFiltroMes] = useState(`${["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][new Date().getMonth()]}/${new Date().getFullYear()}`);
  const [sort, setSort] = useState("data_churn");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("desc");
  const [metaChurn, setMetaChurn] = useState<string>("");
  const [editandoMeta, setEditandoMeta] = useState(false);
  const [agId, setAgId] = useState("");

  const carregar = async () => {
    const id = await getAgenciaId();
    setAgId(id||"");
    const { data } = await supabase.from("controle_clientes")
      .select("*").eq("agencia_id",id!).eq("status","saiu").order("nome");
    setClientes(data||[]);
    const res = await fetch(`/api/snapshots?agencia_id=${id}`);
    const json = await res.json();
    setSnapshots(json.data||[]);
    // Calcular automaticamente (API atualiza períodos ao vivo e fechados)
    fetch(`/api/churn/calcular?agencia_id=${id}`).catch(()=>{});
    
    // Buscar histórico de churn rate
    const { data: hist } = await supabase.from("historico_churn_rate")
      .select("*").eq("agencia_id", id!).order("data_calculo", { ascending: true });
    setHistorico(hist||[]);
    const { data: ag } = await supabase.from("agencias").select("meta_churn").eq("id",id!).single();
    if (ag?.meta_churn) setMetaChurn(String(ag.meta_churn));
    setLoading(false);
  };

  const salvarMeta = async (valor: string) => {
    setMetaChurn(valor);
    setEditandoMeta(false);
    await supabase.from("agencias").update({ meta_churn: Number(valor)||0 }).eq("id",agId);
  };

  useEffect(() => { carregar(); }, []);

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

  // KPI calculations baseados no filtro selecionado
  const hoje = new Date();
  const mesAtual = `${MESES[hoje.getMonth()]}/${hoje.getFullYear()}`;
  const mesFiltroKPI = filtroMes !== "Todos" ? filtroMes : mesAtual;
  const [mesFiltroNome, anoFiltroStr] = mesFiltroKPI.split("/");
  const mesFiltroIdx = MESES.indexOf(mesFiltroNome);
  const anoFiltro = parseInt(anoFiltroStr);
  const mesBaseIdx = mesFiltroIdx===0?11:mesFiltroIdx-1;
  const anoBase = mesFiltroIdx===0?anoFiltro-1:anoFiltro;
  const mesBaseAno = `${MESES[mesBaseIdx]}/${anoBase}`;
  const snapBase = snapshots.find(s => s.mes_ano === mesBaseAno);
  const baseMes = snapBase?.clientes_ativos || 40;
  const churnTotal = filtrados.length;
  const churnRate = baseMes>0 ? ((churnTotal/baseMes)*100).toFixed(1) : "0";

  return (
    <div className="animate-in">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"20px" }}>
        <div>
          <div className="breadcrumb"><a href="/">Início</a><span>›</span><span className="current">Churn</span></div>
          <h1 style={{ fontSize:"22px", fontWeight:"600" }}>Churn de Clientes</h1>
          <p style={{ fontSize:"13px", color:"#4A5B6C", marginTop:"4px" }}>{clientes.length} clientes no histórico</p>
        </div>
        <div style={{ display:"flex", gap:"8px" }}>
          <div style={{ position:"relative" }}>
            <Search size={13} style={{ position:"absolute", left:"10px", top:"50%", transform:"translateY(-50%)", color:"#4A5B6C" }}/>
            <input className="search-input" placeholder="Buscar..." value={busca} onChange={e=>setBusca(e.target.value)} style={{ paddingLeft:"32px", width:"200px" }}/>
          </div>
          <select value={sort} onChange={e=>setSort(e.target.value)} style={{ background:"#FFFFFF", border:"1px solid #E6EBF0", borderRadius:"8px", padding:"7px 10px", color:"#0A1826", fontSize:"12px", cursor:"pointer" }}>
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

      {/* Resumo (faixa escura do canvas) */}
      <Faixa
        contexto={`${filtroMes!=="Todos" ? filtroMes : "Todo o histórico"} · base de ${mesBaseAno}: ${baseMes} clientes`}
        titulo={`${churnRate}% de churn,`}
        destaque={`${churnTotal} saída${churnTotal!==1?"s":""}`}
        numeros={[
          { label: "Saídas", valor: churnTotal, detalhe: `${clientes.length} no histórico` },
          { label: "Tempo médio da cliente", valor: historico.length > 0 ? `${String(historico[historico.length-1]?.tempo_medio_meses || "—").replace(".", ",")} meses` : "—", detalhe: "antes de sair" },
          { label: "Taxa de churn", valor: `${String(churnRate).replace(".", ",")}%`, detalhe: `${churnTotal} ÷ ${baseMes} da base` },
          { label: "Meta de churn mensal", valor: (
            <span onClick={()=>!editandoMeta&&setEditandoMeta(true)} style={{ display:"block" }}>
              {editandoMeta ? (
            <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
              <input autoFocus type="number" defaultValue={metaChurn}
                onBlur={e=>salvarMeta(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter")salvarMeta((e.target as HTMLInputElement).value);}}
                style={{ background:"rgba(255,255,255,.1)", border:"1px solid #8CC6EC", borderRadius:"10px", padding:"4px 10px", color:"#FFFFFF", fontSize:"22px", fontWeight:"600", width:"90px", height:"40px" }}/>
              <span style={{ fontSize:"12px", color:"#9FB3C6" }}>clientes</span>
            </div>
          ) : (
            <>
              <p style={{ fontSize:"28px", fontWeight:600, letterSpacing:"-.02em", color:"#FFFFFF", margin:0, cursor:"pointer" }} title="Clique para mudar a meta">
                {metaChurn||"—"}
              </p>
              <p style={{ fontSize:"13px", color:metaChurn&&churnTotal<=Number(metaChurn)?"#7BD3A6":"#F6B38C", margin:"4px 0 0" }}>
                {metaChurn?(churnTotal<=Number(metaChurn)?"Dentro da meta":`${churnTotal-Number(metaChurn)} acima da meta`):"Clique para definir a meta"}
              </p>
            </>
          )}
            </span>
          ) },
        ]}
      />

      {/* Histórico de Cálculos */}
      {historico.length > 0 && (
        <div className="cartao">
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"14px" }}>
            <h2 className="cartao-title">Histórico de cálculos <span style={{ fontSize:"13px", fontWeight:400, color:"#4A5B6C" }}>a cada 4 meses</span></h2>
            <button onClick={async () => {
              const id = await getAgenciaId();
              await fetch(`/api/churn/calcular`, {
                method:"POST", headers:{"Content-Type":"application/json"},
                body: JSON.stringify({ agencia_id: id, forcar: true })
              });
              carregar();
            }} className="btn-secondary" style={{ fontSize:"13px", cursor:"pointer", padding:"8px 14px" }}>
              Recalcular
            </button>
          </div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"12px" }}>
              <thead>
                <tr style={{ borderBottom:"1px solid #1C6CA630" }}>
                  {["Período","Data Cálculo","Base","Total Churn","Churn Rate","Tempo Médio"].map(h=>(
                    <th key={h} style={{ padding:"8px 12px", textAlign:"left", fontSize:"11px", color:"#4A5B6C", fontWeight:"600" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historico.map((h:any, idx:number) => (
                  <tr key={h.id} style={{ borderBottom:"1px solid #FFFFFF", background:"transparent" }}>
                    <td style={{ padding:"8px 12px", fontWeight:"600", color:"#1C6CA6" }}>{h.periodo}</td>
                    <td style={{ padding:"8px 12px", color:"#4A5B6C" }}>
                      {h.data_calculo ? new Date(h.data_calculo).toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td style={{ padding:"8px 12px", color:"#0A1826" }}>{h.base_clientes||"—"}</td>
                    <td style={{ padding:"8px 12px", color:"#B42318" }}>{h.total_churn||"—"}</td>
                    <td style={{ padding:"8px 12px" }}>
                      {h.churn_rate ? <span style={{ color:"#B42318", fontWeight:"600" }}>{h.churn_rate}%</span> : "—"}
                    </td>
                    <td style={{ padding:"8px 12px", color:"#1C6CA6" }}>
                      {h.tempo_medio_meses ? `${h.tempo_medio_meses} meses` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Filtro por Mês/Ano */}
      <div className="churn-meses" style={{ overflowX:"auto", paddingBottom:"8px", marginBottom:"16px" }}>
        <div style={{ display:"flex", gap:"6px", minWidth:"max-content" }}>
          <button onClick={()=>setFiltroMes("Todos")} style={{
            padding:"4px 12px", borderRadius:"20px", border:"1px solid", cursor:"pointer", fontSize:"12px",
            borderColor:filtroMes==="Todos"?"#B42318":"#E6EBF0",
            background:filtroMes==="Todos"?"rgba(180,35,24,0.1)":"transparent",
            color:filtroMes==="Todos"?"#B42318":"#4A5B6C",
          }}>Todos ({clientes.length})</button>
          {MESES_FIXOS.map(m => {
            const count = clientes.filter(c=>c.data_churn===m).length;
            const temDados = count>0;
            // Data base = último dia do mês anterior
            const [mNome, mAno] = m.split("/");
            const mIdx = MESES.indexOf(mNome);
            const mBaseIdx = mIdx===0?11:mIdx-1;
            const mBaseAno = mIdx===0?parseInt(mAno)-1:parseInt(mAno);
            const snap = snapshots.find(s=>s.mes_ano===`${MESES[mBaseIdx]}/${mBaseAno}`);
            return (
              <button key={m} onClick={()=>setFiltroMes(m)} style={{
                padding:"4px 12px", borderRadius:"20px", border:"1px solid", cursor:"pointer", fontSize:"12px", whiteSpace:"nowrap",
                borderColor:filtroMes===m?"#B42318":temDados?"#E6EBF0":"#FFFFFF",
                background:filtroMes===m?"rgba(180,35,24,0.1)":"transparent",
                color:filtroMes===m?"#B42318":temDados?"#4A5B6C":"#E6EBF0",
                opacity:temDados?1:0.4,
              }}>
                {m}{temDados?` (${count})`:""}
                {snap&&temDados?<span style={{ fontSize:"10px", color:"#4A5B6C", marginLeft:"4px" }}>/{snap.clientes_ativos}</span>:null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tabela */}
      <div className="table-wrapper churn-tabela">
        <table>
          <thead>
            <tr style={{ borderBottom:"1px solid #1C6CA630" }}>
              {["Cliente","Entrada","Saída","Consultor","Gestor","Squad","Investimento","Motivo","Feedback"].map((h,i,arr)=>(
                <th key={h} style={{ }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading?(
              <tr><td colSpan={9} style={{ textAlign:"center", color:"#4A5B6C", padding:"48px" }}>Carregando...</td></tr>
            ):!filtrados.length?(
              <tr><td colSpan={9} style={{ textAlign:"center", color:"#4A5B6C", padding:"48px" }}>Nenhum registro encontrado.</td></tr>
            ):filtrados.map((c,idx)=>(
              <tr key={c.id} style={{ borderBottom:"1px solid #1C6CA615", background:"transparent" }}>
                <td style={{ whiteSpace:"nowrap" }}><span style={{ display:"inline-flex", alignItems:"center", gap:"10px" }}><span className="cc-avatar" style={{ ["--st" as any]: "#B42318" }}>{(c.nome||"?").trim().split(/\s+/).slice(0,2).map((x:string)=>x[0]).join("").toUpperCase()}</span><span style={{ fontWeight:600, color:"#0A1826", fontSize:"14px" }}>{c.nome}</span></span></td>
                <td style={{ color:"#4A5B6C", fontSize:"12px", whiteSpace:"nowrap" }}>{formatarData(c.data_entrada)}</td>
                <td style={{ whiteSpace:"nowrap" }}>
                  <span style={{ fontSize:"12px", padding:"2px 8px", borderRadius:"10px", background:"rgba(180,35,24,0.1)", color:"#B42318" }}>{c.data_churn||"—"}</span>
                </td>
                <td style={{ color:"#4A5B6C", fontSize:"12px", whiteSpace:"nowrap" }}>{c.consultor||"—"}</td>
                <td style={{ color:"#4A5B6C", fontSize:"12px", whiteSpace:"nowrap" }}>{c.gestor||"—"}</td>
                <td style={{ color:"#4A5B6C", fontSize:"12px", whiteSpace:"nowrap" }}>{c.squad||"—"}</td>
                <td style={{ color:"#0A1826", fontSize:"12px", whiteSpace:"nowrap" }}>{c.investimento_mensal?`R$ ${Number(c.investimento_mensal).toLocaleString("pt-BR")}`:"—"}</td>
                <td style={{ color:"#4A5B6C", fontSize:"12px", maxWidth:"180px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.motivo_churn||"—"}</td>
                <td style={{ color:"#4A5B6C", fontSize:"12px", maxWidth:"180px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.feedback||"—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtrados.length>0&&(
          <div style={{ padding:"10px 16px", borderTop:"1px solid #E6EBF0", fontSize:"12px", color:"#4A5B6C" }}>
            {filtrados.length} registro{filtrados.length!==1?"s":""}
          </div>
        )}
      </div>
    </div>
  );
}
