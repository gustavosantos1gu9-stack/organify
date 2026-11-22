"use client";

import { Faixa, Cartao } from "@/components/ui/Canvas";

import { useState, useEffect } from "react";
import {
  Users, UserX, UserPlus, TrendingUp, RotateCcw,
  ArrowDownToLine, ArrowUpFromLine, DollarSign,
  UserCheck, ShoppingBag, Percent, Clock,
  MinusCircle, AlertCircle, PlusCircle, Calendar
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";
import KPICard from "@/components/ui/KPICard";
import PeriodSelector from "@/components/ui/PeriodSelector";
import { useKPIsDashboard, useDadosGraficos, useConversaoPorPublico, useLeads, useLancamentosFuturos, useRecorrencias, useClientes, useMovimentacoes } from "@/lib/hooks";
import { formatCurrency } from "@/lib/utils";

const tooltipStyle = { background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px", color: "var(--navy)" };
function fmt(n: number) { return formatCurrency(n); }

function Stat({ label, valor, tom }: { label: string; valor: React.ReactNode; tom?: "ok" | "alerta" }) {
  return (
    <div className="fin-stat">
      <span className="fin-stat-l">{label}</span>
      <span className={`fin-stat-v${tom ? " " + tom : ""}`}>{valor}</span>
    </div>
  );
}

export default function DashboardMaster() {
  const [verTodosPublicos, setVerTodosPublicos] = useState(false);
  const hoje = new Date();
  const [from, setFrom] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split("T")[0]);
  const [to, setTo] = useState(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split("T")[0]);

  const { data: kpis, loading } = useKPIsDashboard(from, to);

  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [controleClientes, setControleClientes] = useState<any[]>([]);
  const [todosChurns, setTodosChurns] = useState<any[]>([]);
  const [tempoMedioChurn, setTempoMedioChurn] = useState<string>("—");

  useEffect(() => {
    async function carregarDados() {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const sb = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const agId = "32cdce6e-4664-4ac6-979d-6d68a1a68745";

        const [ccRes, churnsRes, churnHistRes, snapRes] = await Promise.all([
          sb.from("controle_clientes").select("status, data_churn, data_entrada").eq("agencia_id", agId),
          sb.from("controle_clientes").select("data_churn").eq("agencia_id", agId).eq("status", "saiu"),
          sb.from("historico_churn_rate").select("tempo_medio_meses").eq("agencia_id", agId)
            .order("data_calculo", { ascending: true }).order("created_at", { ascending: true }),
          fetch(`/api/snapshots?agencia_id=${agId}`).then(r => r.json()),
        ]);

        setControleClientes(ccRes.data || []);
        setTodosChurns(churnsRes.data || []);
        if (churnHistRes.data?.length) {
          const ultimo = churnHistRes.data[churnHistRes.data.length - 1];
          if (ultimo?.tempo_medio_meses) setTempoMedioChurn(String(ultimo.tempo_medio_meses));
        }
        setSnapshots(snapRes.data || []);

        const hoje = new Date();
        const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
        if (hoje.getDate() === ultimoDia) {
          fetch("/api/snapshots", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ agencia_id: agId }),
          }).catch(() => {});
        }
      } catch (e) { console.error(e); }
    }
    carregarDados();
  }, []);

  const { data: graficos } = useDadosGraficos(6);
  const { data: conversao } = useConversaoPorPublico();
  const { data: leads } = useLeads();
  const { data: lancamentos } = useLancamentosFuturos();
  const { data: recorrencias } = useRecorrencias();
  const { data: clientes } = useClientes();
  const { data: movs } = useMovimentacoes("", from, to);

  const entradasPrev = lancamentos?.filter(l => {
    if (l.tipo !== "entrada" || l.pago) return false;
    const d = l.data_vencimento?.split("T")[0];
    return d >= from && d <= to;
  }).reduce((a, b) => a + b.valor, 0) ?? 0;
  const saidasPrev = lancamentos?.filter(l => {
    if (l.tipo !== "saida" || l.pago) return false;
    const d = l.data_vencimento?.split("T")[0];
    return d >= from && d <= to;
  }).reduce((a, b) => a + b.valor, 0) ?? 0;

  const receitaRecorrente = recorrencias?.filter(r => r.ativo && r.tipo === "entrada").reduce((a, b) => a + b.valor, 0) ?? 0;
  const custoFixo = recorrencias?.filter(r => r.ativo && r.tipo === "saida" && r.periodicidade === "mensal").reduce((a, b) => a + b.valor, 0) ?? 0;
  const custoVariavel = movs?.filter(m => m.tipo === "saida" && (m as any).despesa).reduce((a, b) => a + b.valor, 0) ?? 0;

  const totalCac = movs?.filter(m => m.tipo === "saida" && (
    (m as any).considerar_cac ||
    (m.descricao || "").toLowerCase().includes("meta") ||
    (m.descricao || "").toLowerCase().includes("tráfego") ||
    (m.descricao || "").toLowerCase().includes("ads") ||
    (m.descricao || "").toLowerCase().includes("anuncio") ||
    (m.descricao || "").toLowerCase().includes("marketing")
  )).reduce((a, b) => a + b.valor, 0) ?? 0;

  const novosClientes = controleClientes.filter(c => {
    if (!c.data_entrada) return false;
    const de = c.data_entrada;
    if (de.includes("/")) {
      const partes = de.split("/");
      if (partes.length === 3) {
        const mes = partes[1];
        const ano = partes[2].length === 2 ? "20" + partes[2] : partes[2];
        return mes === from.slice(5, 7) && ano === from.slice(0, 4);
      }
    }
    const data = de.split("T")[0];
    return data >= from && data <= to;
  }).length;
  const cac = novosClientes > 0 ? totalCac / novosClientes : 0;

  const inadimplentes = clientes?.filter(c => c.status === "inadimplente" || c.status_recorrencia === "pendencia") ?? [];
  const valorInadimplencia = inadimplentes.reduce((a, b) => a + (b.valor_oportunidade || 0), 0);
  const leadsPropostas = leads?.filter(l => l.etapa === "proposta_enviada") ?? [];
  const projecaoVendas = leadsPropostas.reduce((a, b) => a + (b.valor || 0), 0);

  const etapas = ["novo", "em_contato", "reuniao_agendada", "nao_compareceu", "proposta_enviada", "ganho", "perdido"];
  const etapasLabels = ["Novo", "Em contato", "Reunião ag.", "No-show", "Proposta", "Ganho", "Perdido"];
  const barDataEtapas = etapas.map((e, i) => ({ etapa: etapasLabels[i], valor: leads?.filter(l => l.etapa === e).length ?? 0 }));

  const origens = ["Facebook", "Google", "Instagram", "LinkedIn", "Outro"];
  const barDataOrigem = origens.map(o => ({ origem: o, valor: leads?.filter(l => l.origens?.nome === o).length ?? 0 }));

  const recorrentes = kpis?.clientes_recorrentes ?? 0;
  const cancelados = kpis?.clientes_cancelados ?? 0;
  const clientesSaiu = clientes?.filter(c => c.status_recorrencia === "saiu" || c.status === "cancelado").length ?? 0;
  const clientesAtivos = clientes?.filter(c => c.status === "ativo" || c.status_recorrencia === "ativo").length ?? 0;

  const hoje2 = new Date();
  const mesesNomes2 = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const mesAtualNome2 = mesesNomes2[hoje2.getMonth()];
  const mesPassadoIdx2 = hoje2.getMonth() === 0 ? 11 : hoje2.getMonth() - 1;
  const anoMesPassado2 = hoje2.getMonth() === 0 ? hoje2.getFullYear() - 1 : hoje2.getFullYear();
  const mesPassadoStr2 = `${mesesNomes2[mesPassadoIdx2]}/${anoMesPassado2}`;
  const mesAtualStr2 = `${mesAtualNome2}/${hoje2.getFullYear()}`;
  const snapMesPassado2 = snapshots.find((s: any) => s.mes_ano === mesPassadoStr2);
  const baseMesPassado2 = snapMesPassado2?.clientes_ativos || 0;
  const churnsDoMes2 = todosChurns.filter((c: any) => c.data_churn === mesAtualStr2).length;
  const churnRateCorreto = baseMesPassado2 > 0 ? ((churnsDoMes2 / baseMesPassado2) * 100).toFixed(1) : "0.0";
  const pieData = [
    { name: "Recorrentes", value: recorrentes },
    { name: "Cancelados", value: cancelados },
  ];

  return (
    <div className="animate-in">
      <PeriodSelector onChange={(_, f, t) => { setFrom(f); setTo(t); }} />

      {loading && <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginBottom: "16px" }}>Carregando dados...</p>}

      {/* Resumo do mês (faixa escura do canvas) */}
      <Faixa
        contexto={`${from.split("-").reverse().join("/")} a ${to.split("-").reverse().join("/")}`}
        titulo={`${fmt(kpis?.lucro ?? 0)} de lucro,`}
        destaque={`${novosClientes ?? 0} clientes novos`}
        link={{ label: "Ver movimentações", href: "/financeiro/movimentacoes" }}
        numeros={[
          { label: "Receita recorrente", valor: fmt(receitaRecorrente) },
          { label: "Clientes recorrentes", valor: kpis?.clientes_recorrentes ?? 0 },
          { label: "Receita média por cliente", valor: fmt(recorrentes > 0 ? (kpis?.total_entradas ?? 0) / recorrentes : 0) },
          { label: "Churn do mês", valor: `${String(churnRateCorreto).replace(".", ",")}%` },
        ]}
      />

      <div className="fin-grid">
        <Cartao titulo="Caixa previsto" extra={<a className="ui-link" href="/financeiro/lancamentos-futuros">Lançamentos</a>}>
          <div className="fin-stats">
            <Stat label="Entradas previstas" valor={fmt(entradasPrev)} tom="ok" />
            <Stat label="Saídas previstas" valor={fmt(saidasPrev)} tom="alerta" />
            <Stat label="Custo fixo" valor={fmt(custoFixo)} />
            <Stat label="Custo variável" valor={fmt(custoVariavel)} />
          </div>
        </Cartao>
        <Cartao titulo="Clientes" extra={<a className="ui-link" href="/clientes">Clientes do financeiro</a>}>
          <div className="fin-stats">
            <Stat label="Inadimplentes" valor={kpis?.clientes_inadimplentes ?? 0} tom={(kpis?.clientes_inadimplentes ?? 0) > 0 ? "alerta" : undefined} />
            <Stat label="Valor em aberto" valor={fmt(valorInadimplencia)} tom={valorInadimplencia > 0 ? "alerta" : undefined} />
            <Stat label="Tempo médio antes de sair" valor={`${tempoMedioChurn} meses`} />
            <Stat label="CAC" valor={fmt(cac)} />
          </div>
        </Cartao>
        <Cartao titulo="Comercial" extra={<a className="ui-link" href="/crm">CRM</a>}>
          <div className="fin-stats">
            <Stat label="Projeção de vendas" valor={fmt(projecaoVendas)} />
            <Stat label="Taxa de conversão" valor={`${(() => { const base = (leads || []).filter(l => l.etapa === "proposta_enviada" || l.etapa === "ganho").length; const g = (leads || []).filter(l => l.etapa === "ganho").length; return base > 0 ? Math.round(g / base * 100) : 0; })()}%`} tom="ok" />
            <Stat label="Taxa de no-show" valor={`${(() => { const ag = (leads || []).filter(l => ["reuniao_agendada", "nao_compareceu", "proposta_enviada", "ganho"].includes(l.etapa)).length; const ns = (leads || []).filter(l => l.etapa === "nao_compareceu").length; return ag > 0 ? Math.round(ns / ag * 100) : 0; })()}%`} tom="alerta" />
          </div>
        </Cartao>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
        <div className="card">
          <h3 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "20px", color: "var(--navy)" }}>Entrada x Saída</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={graficos ?? []}>
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} tickFormatter={v => `R$${v}`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
              <Line type="monotone" dataKey="entrada" stroke="var(--brand)" strokeWidth={2} dot={false} name="Entrada" />
              <Line type="monotone" dataKey="saida" stroke="var(--alert-text)" strokeWidth={2} dot={false} name="Saída" />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "20px", color: "var(--navy)" }}>Distribuição de clientes</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                <Cell fill="var(--brand)" /><Cell fill="var(--alert-text)" />
              </Pie>
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>


      {/* Snapshots mensais */}
      {(() => {
        const hoje = new Date();
        const mesesNomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        const mesAtualNome = mesesNomes[hoje.getMonth()];
        const anoAtualNum = hoje.getFullYear();
        const mesAtualStr = `${mesAtualNome}/${anoAtualNum}`;
        const ultimoDiaMesAtual = new Date(anoAtualNum, hoje.getMonth() + 1, 0).getDate();
        const linhaAtual = {
          id: "atual", mes: mesAtualNome, ano: anoAtualNum, mes_ano: mesAtualStr,
          clientes_ativos: controleClientes.filter((c: any) => c.status === "ativo").length,
          clientes_pausados: controleClientes.filter((c: any) => c.status === "pausado").length,
          clientes_entrada: controleClientes.filter((c: any) => c.status === "entrada").length,
          clientes_total: controleClientes.filter((c: any) => c.status !== "saiu").length,
          isAtual: true,
        };
        const chaveMes = (ma: string) => { const [m, a] = String(ma || "").split("/"); return Number(a || 0) * 12 + mesesNomes.indexOf(m); };
        const todasLinhas = [linhaAtual, ...snapshots.filter(s => s.mes_ano !== mesAtualStr).sort((a: any, b: any) => chaveMes(b.mes_ano) - chaveMes(a.mes_ano))];
        return (
          <div className="card" style={{ marginBottom: "16px", padding: "24px" }}>
            <h3 style={{ fontSize: "17px", fontWeight: "600", color: "var(--navy)", marginBottom: "14px", display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
              Base de clientes por mês
              <span style={{ fontSize: "13px", color: "var(--text-secondary)", fontWeight: "400" }}>Atualiza em tempo real até o último dia de cada mês</span>
            </h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["Mês/Ano", "Data Base", "Ativos", "Pausados", "Em Entrada", "Total", "Churn do Mês", "Churn Rate"].map(h => (
                      <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: "11px", color: "var(--text-secondary)", fontWeight: "600" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {todasLinhas.map((s: any, idx: number) => {
                    const mIdx = mesesNomes.indexOf(s.mes);
                    const mBaseIdx = mIdx === 0 ? 11 : mIdx - 1;
                    const mBaseAno = mIdx === 0 ? s.ano - 1 : s.ano;
                    const snapBase = snapshots.find((x: any) => x.mes_ano === `${mesesNomes[mBaseIdx]}/${mBaseAno}`);
                    const baseAtivos = snapBase?.clientes_ativos;
                    const ultimoDia = s.isAtual ? ultimoDiaMesAtual : new Date(s.ano, mIdx + 1, 0).getDate();
                    const churnDoMes = todosChurns.filter((c: any) => c.data_churn === s.mes_ano).length;
                    const churnRate = baseAtivos > 0 ? `${((churnDoMes / (baseAtivos as number)) * 100).toFixed(1)}%` : "—";
                    return (
                      <tr key={s.id} style={{ borderBottom: "1px solid var(--border)", background: s.isAtual ? "rgba(28,108,166,0.04)" : "transparent" }}>
                        <td style={{ padding: "8px 12px", fontWeight: "600" }}>
                          <span style={{ color: s.isAtual ? "var(--brand)" : "var(--navy)" }}>{s.mes_ano}</span>
                          {s.isAtual && <span style={{ fontSize: "10px", color: "var(--brand)", marginLeft: "6px", background: "rgba(28,108,166,0.1)", padding: "1px 6px", borderRadius: "10px" }}>ao vivo</span>}
                        </td>
                        <td style={{ padding: "8px 12px", color: "var(--text-secondary)", fontSize: "11px" }}>
                          {s.isAtual ? `Até dia ${hoje.getDate()}/${String(hoje.getMonth() + 1).padStart(2, "0")}/${s.ano}` : `Dia ${ultimoDia}/${String(mIdx + 1).padStart(2, "0")}/${s.ano}`}
                        </td>
                        <td style={{ padding: "8px 12px", color: "var(--success)", fontWeight: s.isAtual ? "600" : "400" }}>{s.clientes_ativos}</td>
                        <td style={{ padding: "8px 12px", color: "var(--caution-text)" }}>{s.clientes_pausados}</td>
                        <td style={{ padding: "8px 12px", color: "var(--warning-text)" }}>{s.clientes_entrada}</td>
                        <td style={{ padding: "8px 12px", color: "var(--navy)" }}>{s.clientes_total}</td>
                        <td style={{ padding: "8px 12px", color: "var(--alert-text)" }}>{churnDoMes}</td>
                        <td style={{ padding: "8px 12px", color: "var(--text-secondary)" }}>{churnRate}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
