"use client";

import { useState } from "react";
import {
  Users, UserX, TrendingUp, RotateCcw,
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
import { useKPIsDashboard, useDadosGraficos, useConversaoPorPublico, useLeads, useLancamentosFuturos, useRecorrencias } from "@/lib/hooks";
import { formatCurrency } from "@/lib/utils";

const tooltipStyle = { background: "#1e1e1e", border: "1px solid #2e2e2e", borderRadius: "8px", fontSize: "12px", color: "#f0f0f0" };

function fmt(n: number) { return formatCurrency(n); }

export default function DashboardPage() {
  const hoje = new Date();
  const [from, setFrom] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split("T")[0]);
  const [to, setTo] = useState(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split("T")[0]);

  const { data: kpis, loading } = useKPIsDashboard(from, to);
  const { data: graficos } = useDadosGraficos(6);
  const { data: conversao } = useConversaoPorPublico();
  const { data: leads } = useLeads();
  const { data: lancamentos } = useLancamentosFuturos();
  const { data: recorrencias } = useRecorrencias();

  // KPIs dos lançamentos futuros
  const entradasPrev = lancamentos?.filter(l=>l.tipo==="entrada"&&!l.pago).reduce((a,b)=>a+b.valor,0) ?? 0;
  const saidasPrev = lancamentos?.filter(l=>l.tipo==="saida"&&!l.pago).reduce((a,b)=>a+b.valor,0) ?? 0;

  // Receita recorrente = recorrências ativas de entrada
  const receitaRecorrente = recorrencias?.filter(r=>r.ativo&&r.tipo==="entrada").reduce((a,b)=>a+b.valor,0) ?? 0;

  // Custo fixo = recorrências ativas de saída mensal
  const custoFixo = recorrencias?.filter(r=>r.ativo&&r.tipo==="saida"&&r.periodicidade==="mensal").reduce((a,b)=>a+b.valor,0) ?? 0;

  // Custo variável = lançamentos futuros de saída não pagos marcados como despesa
  const custoVariavel = lancamentos?.filter(l=>l.tipo==="saida"&&!l.pago&&(l as any).despesa).reduce((a,b)=>a+b.valor,0) ?? 0;

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
  const pieData = [
    { name: "Recorrentes", value: recorrentes },
    { name: "Cancelados", value: cancelados },
  ];

  return (
    <div className="animate-in">
      <h1 style={{ fontSize: "22px", fontWeight: "600", marginBottom: "24px" }}>Bem-vindo(a)!</h1>
      <PeriodSelector onChange={(_, f, t) => { setFrom(f); setTo(t); }} />

      {loading && <p style={{ color: "#606060", fontSize: "13px", marginBottom: "16px" }}>Carregando dados...</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "16px", marginBottom: "16px" }}>
        <KPICard label="Clientes recorrentes" value={kpis?.clientes_recorrentes ?? 0} change={0} icon={<Users size={16}/>} iconBg="green"/>
        <KPICard label="Clientes inadimplentes" value={kpis?.clientes_inadimplentes ?? 0} change={0} icon={<UserX size={16}/>} iconBg="red"/>
        <KPICard label="Lucro" value={fmt(kpis?.lucro ?? 0)} change={0} icon={<TrendingUp size={16}/>} iconBg="green"/>
        <KPICard label="Churn rate" value="0%" change={0} icon={<RotateCcw size={16}/>} iconBg="red"/>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "16px", marginBottom: "16px" }}>
        <KPICard label="Entradas previstas" value={fmt(entradasPrev)} change={0} icon={<ArrowDownToLine size={16}/>} iconBg="green"/>
        <KPICard label="Saídas previstas" value={fmt(saidasPrev)} change={0} icon={<ArrowUpFromLine size={16}/>} iconBg="red"/>
        <KPICard label="Receita recorrente" value={fmt(receitaRecorrente)} change={0} icon={<DollarSign size={16}/>} iconBg="green"/>
        <KPICard label="Receita média por cliente" value={fmt(recorrentes > 0 ? (kpis?.total_entradas ?? 0) / recorrentes : 0)} change={0} icon={<UserCheck size={16}/>} iconBg="green"/>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "16px", marginBottom: "16px" }}>
        <KPICard label="CAC" value="R$ 0,00" change={0} icon={<ShoppingBag size={16}/>} iconBg="green"/>
        <KPICard label="Projeção de vendas" value="R$ 0,00" change={0} icon={<TrendingUp size={16}/>} iconBg="amber"/>
        <KPICard label="Taxa de conversão" value={`${leads && leads.length > 0 ? Math.round(leads.filter(l=>l.etapa==="ganho").length/leads.length*100) : 0}%`} change={0} icon={<Percent size={16}/>} iconBg="amber"/>
        <KPICard label="Tempo médio do cliente (meses)" value="0" change={0} icon={<Clock size={16}/>} iconBg="blue"/>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "16px", marginBottom: "32px" }}>
        <KPICard label="Custo fixo" value={fmt(custoFixo)} change={0} icon={<MinusCircle size={16}/>} iconBg="red"/>
        <KPICard label="Custo variável" value={fmt(custoVariavel)} change={0} icon={<AlertCircle size={16}/>} iconBg="red"/>
        <KPICard label="Inadimplência" value={fmt(kpis?.clientes_inadimplentes ?? 0)} change={0} icon={<PlusCircle size={16}/>} iconBg="red"/>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
        <div className="card">
          <h3 style={{ fontSize: "14px", fontWeight: "500", marginBottom: "20px" }}>Entrada x Saída</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={graficos ?? []}>
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#606060" }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 11, fill: "#606060" }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v}`}/>
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)}/>
              <Line type="monotone" dataKey="entrada" stroke="#22c55e" strokeWidth={2} dot={false} name="Entrada"/>
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
                <Cell fill="#22c55e"/><Cell fill="#ef4444"/>
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
              <Bar dataKey="valor" fill="#22c55e" radius={[4,4,0,0]} name="Leads"/>
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
              <Bar dataKey="valor" fill="#22c55e" radius={[4,4,0,0]} name="Leads"/>
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
                  <div style={{ width: `${c.taxa}%`, height: "100%", background: "#22c55e", borderRadius: "3px", transition: "width 0.5s" }}/>
                </div>
                <span style={{ fontSize: "12px", color: "#22c55e", minWidth: "48px", textAlign: "right", fontWeight: "600" }}>{c.taxa}%</span>
                <span style={{ fontSize: "11px", color: "#606060", minWidth: "80px" }}>{c.total_convertidos}/{c.total_leads} leads</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
