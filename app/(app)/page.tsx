"use client";

import { useState, useEffect } from "react";
import {
  Users, UserX, UserPlus, TrendingUp, RotateCcw,
  ArrowDownToLine, ArrowUpFromLine, DollarSign,
  UserCheck, ShoppingBag, Percent, Clock,
  MinusCircle, AlertCircle, PlusCircle
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";
import KPICard from "@/components/ui/KPICard";
import PeriodSelector from "@/components/ui/PeriodSelector";
import { useKPIsDashboard, useDadosGraficos, useConversaoPorPublico, useLeads, useLancamentosFuturos, useRecorrencias, useClientes, useMovimentacoes } from "@/lib/hooks";
import { formatCurrency } from "@/lib/utils";

const tooltipStyle = { background: "#1e1e1e", border: "1px solid #2e2e2e", borderRadius: "8px", fontSize: "12px", color: "#f0f0f0" };

function fmt(n: number) { return formatCurrency(n); }

export default function DashboardPage() {
  const hoje = new Date();
  const [from, setFrom] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split("T")[0]);
  const [to, setTo] = useState(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split("T")[0]);

  const { data: kpis, loading } = useKPIsDashboard(from, to);

  // Snapshots mensais
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [loadingSnap, setLoadingSnap] = useState(false);

  const [controleClientes, setControleClientes] = useState<any[]>([]);
  const [todosChurns, setTodosChurns] = useState<any[]>([]);

  useEffect(() => {
    async function carregarSnapshots() {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const sb = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const agId = "32cdce6e-4664-4ac6-979d-6d68a1a68745";

        // Buscar clientes ativos do controle
        const { data: cc } = await sb.from("controle_clientes")
          .select("status, data_churn, data_entrada").eq("agencia_id", agId);
        setControleClientes(cc || []);
        // Buscar churns (status saiu) com data_churn
        const { data: churnsData } = await sb.from("controle_clientes")
          .select("data_churn").eq("agencia_id", agId).eq("status", "saiu");
        setTodosChurns(churnsData || []);

        // Salvar snapshot no último dia do mês
        const hoje = new Date();
        const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth()+1, 0).getDate();
        if (hoje.getDate() === ultimoDia) {
          await fetch("/api/snapshots", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ agencia_id: agId }),
          });
        }
        // Buscar histórico
        const res = await fetch(`/api/snapshots?agencia_id=${agId}`);
        const json = await res.json();
        setSnapshots(json.data || []);
      } catch(e) { console.error(e); }
    }
    carregarSnapshots();
  }, []);
  const { data: graficos } = useDadosGraficos(6);
  const { data: conversao } = useConversaoPorPublico();
  const { data: leads } = useLeads();
  const { data: lancamentos } = useLancamentosFuturos();
  const { data: recorrencias } = useRecorrencias();
  const { data: clientes } = useClientes();
  const { data: movs } = useMovimentacoes("", from, to);

  // KPIs dos lançamentos futuros — filtrar pelo mês atual
  const entradasPrev = lancamentos?.filter(l => {
    if (l.tipo !== "entrada" || l.pago) return false;
    const d = l.data_vencimento?.split("T")[0];
    return d >= from && d <= to;
  }).reduce((a,b)=>a+b.valor,0) ?? 0;
  const saidasPrev = lancamentos?.filter(l => {
    if (l.tipo !== "saida" || l.pago) return false;
    const d = l.data_vencimento?.split("T")[0];
    return d >= from && d <= to;
  }).reduce((a,b)=>a+b.valor,0) ?? 0;

  // Receita recorrente = recorrências ativas de entrada
  const receitaRecorrente = recorrencias?.filter(r=>r.ativo&&r.tipo==="entrada").reduce((a,b)=>a+b.valor,0) ?? 0;

  // Custo fixo = recorrências ativas de saída mensal
  const custoFixo = recorrencias?.filter(r=>r.ativo&&r.tipo==="saida"&&r.periodicidade==="mensal").reduce((a,b)=>a+b.valor,0) ?? 0;

  // Custo variável = movimentações de saída marcadas como despesa
  const custoVariavel = movs?.filter(m=>m.tipo==="saida"&&(m as any).despesa).reduce((a,b)=>a+b.valor,0) ?? 0;

  // CAC = investimento em anúncios (saídas de marketing) ÷ novos clientes no período
  const totalCac = movs?.filter(m => m.tipo === "saida" && (
    (m as any).considerar_cac ||
    (m.descricao || "").toLowerCase().includes("meta") ||
    (m.descricao || "").toLowerCase().includes("tráfego") ||
    (m.descricao || "").toLowerCase().includes("ads") ||
    (m.descricao || "").toLowerCase().includes("anuncio") ||
    (m.descricao || "").toLowerCase().includes("marketing")
  )).reduce((a,b) => a + b.valor, 0) ?? 0;
  const novosClientes = clientes?.filter(c => {
    const data = c.created_at.split("T")[0];
    return data >= from && data <= to;
  }).length ?? 0;
  const cac = novosClientes > 0 ? totalCac / novosClientes : 0;

  // Inadimplência = soma dos tickets dos clientes com pendência
  const inadimplentes = clientes?.filter(c => c.status === "inadimplente" || c.status_recorrencia === "pendencia") ?? [];
  const valorInadimplencia = inadimplentes.reduce((a, b) => a + (b.valor_oportunidade || 0), 0);

  // Projeção = soma dos valores dos leads em proposta_enviada
  const leadsPropostas = leads?.filter(l => l.etapa === "proposta_enviada") ?? [];
  const projecaoVendas = leadsPropostas.reduce((a, b) => a + (b.valor || 0), 0);

  const etapas = ["novo","em_contato","reuniao_agendada","proposta_enviada","ganho","perdido"];
  const etapasLabels = ["Novo","Em contato","Reunião ag.","Proposta","Ganho","Perdido"];
  const barDataEtapas = etapas.map((e, i) => ({
    etapa: etapasLabels[i],
    valor: leads?.filter((l) => l.etapa === e).length ?? 0,
  }));

  const origens = ["Facebook","Google","Instagram","LinkedIn","Outro"];
  const barDataOrigem = origens.map((o) => ({
    origem: o,
    valor: leads?.filter((l) => l.origens?.nome === o).length ?? 0,
  }));

  const recorrentes = kpis?.clientes_recorrentes ?? 0;
  const cancelados = kpis?.clientes_cancelados ?? 0;
  // Churn rate real = saídas / (ativos + saídas) × 100
  const clientesSaiu = clientes?.filter(c => c.status_recorrencia === "saiu" || c.status === "cancelado").length ?? 0;
  const clientesAtivos = clientes?.filter(c => c.status === "ativo" || c.status_recorrencia === "ativo").length ?? 0;
  const baseChurn = clientesAtivos + clientesSaiu;
  const churnRate = baseChurn > 0 ? ((clientesSaiu / baseChurn) * 100).toFixed(1) : "0.0";

  // Churn rate correto: churns do mês atual ÷ base do mês passado (snapshot)
  const hoje2 = new Date();
  const mesesNomes2 = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const mesAtualNome2 = mesesNomes2[hoje2.getMonth()];
  const mesPassadoIdx2 = hoje2.getMonth() === 0 ? 11 : hoje2.getMonth() - 1;
  const anoMesPassado2 = hoje2.getMonth() === 0 ? hoje2.getFullYear() - 1 : hoje2.getFullYear();
  const mesPassadoStr2 = `${mesesNomes2[mesPassadoIdx2]}/${anoMesPassado2}`;
  const mesAtualStr2 = `${mesAtualNome2}/${hoje2.getFullYear()}`;
  const snapMesPassado2 = snapshots.find((s: any) => s.mes_ano === mesPassadoStr2);
  const baseMesPassado2 = snapMesPassado2?.clientes_ativos || 0;
  // Churns do mês atual = registros de clientes que saíram com data_churn = mês atual
  const churnsDoMes2 = todosChurns.filter((c: any) => c.data_churn === mesAtualStr2).length;
  const churnRateCorreto = baseMesPassado2 > 0 ? ((churnsDoMes2 / baseMesPassado2) * 100).toFixed(1) : "0.0";
  const pieData = [
    { name: "Recorrentes", value: recorrentes },
    { name: "Cancelados", value: cancelados },
  ];

  return (
    <div className="animate-in">
      <h1 style={{ fontSize: "22px", fontWeight: "600", marginBottom: "24px" }}>Bem-vindo(a)!</h1>
      <PeriodSelector onChange={(_, f, t) => { setFrom(f); setTo(t); }} />

      {loading && <p style={{ color: "#606060", fontSize: "13px", marginBottom: "16px" }}>Carregando dados...</p>}

      {/* Tabela de Snapshots Mensais */}
      {(() => {
        const hoje = new Date();
        const mesesNomes = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
        const mesAtualNome = mesesNomes[hoje.getMonth()];
        const anoAtualNum = hoje.getFullYear();
        const mesAtualStr = `${mesAtualNome}/${anoAtualNum}`;
        const ultimoDiaMesAtual = new Date(anoAtualNum, hoje.getMonth()+1, 0).getDate();

        // Linha do mês atual em tempo real (não salva ainda)
        const linhaAtual = {
          id: "atual",
          mes: mesAtualNome,
          ano: anoAtualNum,
          mes_ano: mesAtualStr,
          clientes_ativos: controleClientes.filter((c:any) => c.status === "ativo").length,
          clientes_pausados: controleClientes.filter((c:any) => c.status === "pausado").length,
          clientes_entrada: controleClientes.filter((c:any) => c.status === "entrada").length,
          clientes_total: controleClientes.filter((c:any) => c.status !== "saiu").length,
          isAtual: true,
        };

        // Combinar snapshots salvos + mês atual
        const todasLinhas = [linhaAtual, ...snapshots.filter(s => s.mes_ano !== mesAtualStr)];

        return (
          <div className="card" style={{ marginBottom:"20px", padding:"16px 20px" }}>
            <h3 style={{ fontSize:"13px", fontWeight:"600", color:"#f0f0f0", marginBottom:"14px", display:"flex", alignItems:"center", gap:"8px" }}>
              📅 Base de Clientes por Mês
              <span style={{ fontSize:"11px", color:"#606060", fontWeight:"400" }}>Atualiza em tempo real até o último dia de cada mês</span>
            </h3>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"12px" }}>
                <thead>
                  <tr style={{ borderBottom:"1px solid #29ABE230" }}>
                    {["Mês/Ano","Data Base","Ativos","Pausados","Em Entrada","Total","Churn do Mês","Churn Rate"].map(h=>(
                      <th key={h} style={{ padding:"8px 12px", textAlign:"left", fontSize:"11px", color:"#606060", fontWeight:"600", borderRight:"1px solid #29ABE215" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {todasLinhas.map((s:any, idx:number) => {
                    const mIdx = mesesNomes.indexOf(s.mes);
                    const mBaseIdx = mIdx===0?11:mIdx-1;
                    const mBaseAno = mIdx===0?s.ano-1:s.ano;
                    const snapBase = snapshots.find((x:any)=>x.mes_ano===`${mesesNomes[mBaseIdx]}/${mBaseAno}`);
                    const baseAtivos = snapBase?.clientes_ativos;
                    const ultimoDia = s.isAtual ? ultimoDiaMesAtual : new Date(s.ano, mIdx+1, 0).getDate();
                    // Churn do mês = churns com data_churn igual ao mês
                    const churnDoMes = todosChurns.filter((c:any) => c.data_churn === s.mes_ano).length;
                    const churnRate = baseAtivos > 0
                      ? `${((churnDoMes / (baseAtivos as number)) * 100).toFixed(1)}%`
                      : "—";
                    return (
                      <tr key={s.id} style={{ borderBottom:"1px solid #1e1e1e", background: s.isAtual ? "rgba(41,171,226,0.05)" : idx%2===0?"transparent":"#0a0a0a" }}>
                        <td style={{ padding:"8px 12px", fontWeight:"600", borderRight:"1px solid #29ABE215" }}>
                          <span style={{ color: s.isAtual ? "#29ABE2" : "#f0f0f0" }}>{s.mes_ano}</span>
                          {s.isAtual && <span style={{ fontSize:"10px", color:"#29ABE2", marginLeft:"6px", background:"rgba(41,171,226,0.15)", padding:"1px 6px", borderRadius:"10px" }}>ao vivo</span>}
                        </td>
                        <td style={{ padding:"8px 12px", color:"#606060", fontSize:"11px", borderRight:"1px solid #29ABE215" }}>
                          {s.isAtual ? `Até dia ${hoje.getDate()}/${String(hoje.getMonth()+1).padStart(2,"0")}/${s.ano}` : `Dia ${ultimoDia}/${String(mIdx+1).padStart(2,"0")}/${s.ano}`}
                        </td>
                        <td style={{ padding:"8px 12px", color:"#22c55e", fontWeight: s.isAtual?"600":"400", borderRight:"1px solid #29ABE215" }}>{s.clientes_ativos}</td>
                        <td style={{ padding:"8px 12px", color:"#f59e0b", borderRight:"1px solid #29ABE215" }}>{s.clientes_pausados}</td>
                        <td style={{ padding:"8px 12px", color:"#eab308", borderRight:"1px solid #29ABE215" }}>{s.clientes_entrada}</td>
                        <td style={{ padding:"8px 12px", color:"#f0f0f0", borderRight:"1px solid #29ABE215" }}>{s.clientes_total}</td>
                        <td style={{ padding:"8px 12px", color:"#ef4444", borderRight:"1px solid #29ABE215" }}>{churnDoMes}</td>
                        <td style={{ padding:"8px 12px", color:"#a0a0a0" }}>{churnRate}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: "16px", marginBottom: "16px" }}>
        <KPICard label="Clientes novos" value={novosClientes ?? 0} change={0} icon={<UserPlus size={16}/>} iconBg="green"/>
        <KPICard label="Clientes recorrentes" value={kpis?.clientes_recorrentes ?? 0} change={0} icon={<Users size={16}/>} iconBg="green"/>
        <KPICard label="Clientes inadimplentes" value={kpis?.clientes_inadimplentes ?? 0} change={0} icon={<UserX size={16}/>} iconBg="red"/>
        <KPICard label="Lucro" value={fmt(kpis?.lucro ?? 0)} change={0} icon={<TrendingUp size={16}/>} iconBg="green"/>
        <KPICard label="Churn rate" value={`${churnRateCorreto}%`} change={0} icon={<RotateCcw size={16}/>} iconBg="red"/>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "16px", marginBottom: "16px" }}>
        <KPICard label="Entradas previstas" value={fmt(entradasPrev)} change={0} icon={<ArrowDownToLine size={16}/>} iconBg="green"/>
        <KPICard label="Saídas previstas" value={fmt(saidasPrev)} change={0} icon={<ArrowUpFromLine size={16}/>} iconBg="red"/>
        <KPICard label="Receita recorrente" value={fmt(receitaRecorrente)} change={0} icon={<DollarSign size={16}/>} iconBg="green"/>
        <KPICard label="Receita média por cliente" value={fmt(recorrentes > 0 ? (kpis?.total_entradas ?? 0) / recorrentes : 0)} change={0} icon={<UserCheck size={16}/>} iconBg="green"/>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "16px", marginBottom: "16px" }}>
        <KPICard label="CAC" value={fmt(cac)} change={0} icon={<ShoppingBag size={16}/>} iconBg="green"/>
        <KPICard label="Projeção de vendas" value={fmt(projecaoVendas)} change={0} icon={<TrendingUp size={16}/>} iconBg="amber"/>
        <KPICard label="Taxa de conversão" value={`${(() => { const base = (leads||[]).filter(l=>l.etapa==="proposta_enviada"||l.etapa==="ganho").length; const g = (leads||[]).filter(l=>l.etapa==="ganho").length; return base > 0 ? Math.round(g/base*100) : 0; })()}%`} change={0} icon={<Percent size={16}/>} iconBg="amber"/>
        <KPICard label="Tempo médio do cliente (meses)" value={(() => {
          const ativos = controleClientes.filter((c:any) => c.status === "ativo" && c.data_entrada);
          if (!ativos.length) return "—";
          const hoje3 = new Date();
          const media = ativos.reduce((s: number, c: any) => {
            try {
              const d = new Date(c.data_entrada);
              return s + (hoje3.getTime() - d.getTime()) / (1000*60*60*24*30);
            } catch { return s; }
          }, 0) / ativos.length;
          return media.toFixed(1);
        })()} change={0} icon={<Clock size={16}/>} iconBg="blue"/>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "16px", marginBottom: "32px" }}>
        <KPICard label="Custo fixo" value={fmt(custoFixo)} change={0} icon={<MinusCircle size={16}/>} iconBg="red"/>
        <KPICard label="Custo variável" value={fmt(custoVariavel)} change={0} icon={<AlertCircle size={16}/>} iconBg="red"/>
        <KPICard label="Inadimplência" value={fmt(valorInadimplencia)} change={0} icon={<PlusCircle size={16}/>} iconBg="red"/>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
        <div className="card">
          <h3 style={{ fontSize: "14px", fontWeight: "500", marginBottom: "20px" }}>Entrada x Saída</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={graficos ?? []}>
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#606060" }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 11, fill: "#606060" }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v}`}/>
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)}/>
              <Line type="monotone" dataKey="entrada" stroke="#29ABE2" strokeWidth={2} dot={false} name="Entrada"/>
              <Line type="monotone" dataKey="saida" stroke="#ef4444" strokeWidth={2} dot={false} name="Saída"/>
              <Legend wrapperStyle={{ fontSize: "11px" }}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3 style={{ fontSize: "14px", fontWeight: "500", marginBottom: "20px" }}>Distribuição de clientes</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                <Cell fill="#29ABE2"/><Cell fill="#ef4444"/>
              </Pie>
              <Legend wrapperStyle={{ fontSize: "11px" }}/>
              <Tooltip contentStyle={tooltipStyle}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
        <div className="card">
          <h3 style={{ fontSize: "14px", fontWeight: "500", marginBottom: "20px" }}>Leads por etapa — Período atual</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barDataEtapas}>
              <XAxis dataKey="etapa" tick={{ fontSize: 10, fill: "#606060" }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 11, fill: "#606060" }} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={tooltipStyle}/>
              <Bar dataKey="valor" fill="#29ABE2" radius={[4,4,0,0]} name="Leads"/>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3 style={{ fontSize: "14px", fontWeight: "500", marginBottom: "20px" }}>Leads por origem — Período atual</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barDataOrigem}>
              <XAxis dataKey="origem" tick={{ fontSize: 11, fill: "#606060" }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 11, fill: "#606060" }} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={tooltipStyle}/>
              <Bar dataKey="valor" fill="#29ABE2" radius={[4,4,0,0]} name="Leads"/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Conversão por público UTM */}
      <div className="card">
        <h3 style={{ fontSize: "14px", fontWeight: "500", marginBottom: "20px" }}>Conversão por público (UTM)</h3>
        {!conversao || conversao.length === 0 ? (
          <p style={{ fontSize: "13px", color: "#606060" }}>Nenhum dado de UTM ainda. Os dados aparecerão quando os primeiros leads com UTM forem capturados.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {conversao.map((c) => (
              <div key={c.publico} style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <div style={{ minWidth: "200px" }}>
                  <p style={{ fontSize: "13px", fontWeight: "500" }}>{c.publico}</p>
                  <p style={{ fontSize: "11px", color: "#606060" }}>{c.campanha}</p>
                </div>
                <div style={{ flex: 1, height: "6px", background: "#2a2a2a", borderRadius: "3px" }}>
                  <div style={{ width: `${c.taxa}%`, height: "100%", background: "#29ABE2", borderRadius: "3px", transition: "width 0.5s" }}/>
                </div>
                <span style={{ fontSize: "12px", color: "#29ABE2", minWidth: "48px", textAlign: "right", fontWeight: "600" }}>{c.taxa}%</span>
                <span style={{ fontSize: "11px", color: "#606060", minWidth: "80px" }}>{c.total_convertidos}/{c.total_leads} leads</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
