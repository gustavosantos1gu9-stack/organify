"use client";

import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import PeriodSelector from "@/components/ui/PeriodSelector";
import KPICard from "@/components/ui/KPICard";
import { useLeads, calcularTempoMedioDecisao, supabase } from "@/lib/hooks";
import { formatCurrency } from "@/lib/utils";
import { Flame, Percent, DollarSign, Clock, Plus, Users, Star, TrendingUp } from "lucide-react";

const tooltipStyle = { background:"#1e1e1e", border:"1px solid #2e2e2e", borderRadius:"8px", fontSize:"12px", color:"#f0f0f0" };
const ORIGENS = ["Facebook","Google","Instagram","LinkedIn","Outro"];
const ETAPAS_KEYS = ["novo","em_contato","qualificado","reuniao_agendada","nao_compareceu","proposta_enviada","ganho","perdido"];
const ETAPAS_LABELS = ["Novo","Em contato","Qualificado","Reunião ag.","No-show","Proposta","Ganho","Perdido"];

export default function CRMDashboardPage() {
  const hoje = new Date();
  const [from, setFrom] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split("T")[0]);
  const [to, setTo] = useState(new Date(hoje.getFullYear(), hoje.getMonth()+1, 0).toISOString().split("T")[0]);
  const { data: leads } = useLeads();
  const [tempoMedio, setTempoMedio] = useState<number>(0);

  // Filtrar leads pelo período selecionado
  const lf = (leads ?? []).filter((l) => {
    const data = l.created_at.split("T")[0];
    if (from && data < from) return false;
    if (to && data > to) return false;
    return true;
  });

  useEffect(() => {
    async function calcular() {
      // Leads que chegaram a agendar (reuniao_agendada ou além)
      const leadsAgendaram = lf.filter((l) => ["reuniao_agendada","nao_compareceu","proposta_enviada","ganho","perdido"].includes(l.etapa));
      if (!leadsAgendaram.length) { setTempoMedio(0); return; }

      const ids = leadsAgendaram.map((l) => l.id);

      const { data: historico } = await supabase
        .from("leads_historico")
        .select("lead_id, etapa_nova, created_at")
        .in("lead_id", ids)
        .in("etapa_nova", ["em_contato", "reuniao_agendada"])
        .order("created_at", { ascending: true });

      if (!historico?.length) { setTempoMedio(0); return; }

      const porLead: Record<string, { inicio?: string; fim?: string }> = {};
      for (const h of historico) {
        if (!porLead[h.lead_id]) porLead[h.lead_id] = {};
        if (h.etapa_nova === "em_contato" && !porLead[h.lead_id].inicio) {
          porLead[h.lead_id].inicio = h.created_at;
        }
        if (h.etapa_nova === "reuniao_agendada" && !porLead[h.lead_id].fim) {
          porLead[h.lead_id].fim = h.created_at;
        }
      }

      const tempos: number[] = [];
      for (const lead of Object.values(porLead)) {
        if (lead.inicio && lead.fim) {
          const dias = Math.round(
            (new Date(lead.fim).getTime() - new Date(lead.inicio).getTime()) /
            (1000 * 60 * 60 * 24)
          );
          if (dias >= 0) tempos.push(dias);
        }
      }

      setTempoMedio(tempos.length > 0
        ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length)
        : 0);
    }
    calcular();
  }, [from, to, leads]);

  const total = lf.length;
  const agendados = lf.filter((l) => ["reuniao_agendada","nao_compareceu","proposta_enviada","ganho"].includes(l.etapa)).length;
  const noShows = lf.filter((l) => l.etapa === "nao_compareceu").length;
  const realizados = lf.filter((l) => ["proposta_enviada","ganho"].includes(l.etapa)).length;
  const fechados = lf.filter((l) => l.etapa === "ganho").length;

  const pctLeadsAgend = total > 0 ? ((agendados/total)*100).toFixed(1) : "0.0";
  const pctAgendReal = agendados > 0 ? ((realizados/agendados)*100).toFixed(1) : "0.0";
  const pctRealVenda = realizados > 0 ? ((fechados/realizados)*100).toFixed(1) : "0.0";

  const quentes = lf.filter((l) => ["proposta_enviada","ganho"].includes(l.etapa)).length;
  const foramReuniao = lf.filter((l) => ["proposta_enviada","ganho"].includes(l.etapa)).length;
  const taxaConversao = foramReuniao > 0 ? ((fechados/foramReuniao)*100).toFixed(2) : "0.00";
  const pipeline = lf.reduce((a,b)=>a+(b.valor||0),0);
  const perdidos = lf.filter((l)=>l.etapa==="perdido").length;
  const etapasQualificadas = ["qualificado", "reuniao_agendada", "proposta_enviada", "ganho"];
  const mqls = lf.filter((l) =>
    etapasQualificadas.includes(l.etapa) &&
    (l.utm_source?.toLowerCase().includes("facebook") ||
     l.utm_source?.toLowerCase().includes("instagram") ||
     l.utm_medium?.toLowerCase().includes("facebook") ||
     l.utm_medium?.toLowerCase().includes("instagram") ||
     l.origens?.nome?.toLowerCase().includes("facebook") ||
     l.origens?.nome?.toLowerCase().includes("instagram"))
  ).length;
  const reunioesAgendadas = lf.filter((l)=>l.etapa==="reuniao_agendada").length;
  const vendas = lf.filter((l)=>l.etapa==="ganho").reduce((a,b)=>a+(b.valor||0),0);

  const barEtapas = ETAPAS_KEYS.map((k,i) => ({
    etapa: ETAPAS_LABELS[i],
    valor: lf.filter((l)=>l.etapa===k).length,
  }));

  const barOrigem = ORIGENS.map((o) => ({
    origem: o,
    valor: lf.filter((l)=>l.origens?.nome===o).length,
  }));

  const tabelaOrigem = ORIGENS.map((o) => ({
    origem: o,
    etapas: ETAPAS_KEYS.map((k) => lf.filter((l)=>l.origens?.nome===o && l.etapa===k).length),
  }));

  return (
    <div className="animate-in">
      <div className="breadcrumb">
        <a href="/">Início</a><span>›</span>
        <a href="/crm">CRM</a><span>›</span>
        <span className="current">Dashboard</span>
      </div>
      <h1 style={{ fontSize:"22px", fontWeight:"600", marginBottom:"24px" }}>Dashboard</h1>

      <PeriodSelector onChange={(_,f,t)=>{ setFrom(f); setTo(t); }}/>

      {/* Funil de Conversão */}
      <div className="card" style={{ marginBottom:"20px" }}>
        <h2 style={{ fontSize:"15px", fontWeight:"600", marginBottom:"20px" }}>Funil de Conversão</h2>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"0", marginBottom:"20px", borderBottom:"1px solid #2e2e2e", paddingBottom:"16px" }}>
          {[
            { label:"Leads → Agendamentos", value:`${pctLeadsAgend}%` },
            { label:"Agendados → Compareceram", value:`${pctAgendReal}%` },
            { label:"Compareceram → Vendas", value:`${pctRealVenda}%` },
          ].map((item, i) => (
            <div key={i} style={{ textAlign:"center", padding:"0 16px", borderRight: i < 2 ? "1px solid #2e2e2e" : "none" }}>
              <p style={{ fontSize:"12px", color:"#606060", marginBottom:"6px" }}>{item.label}</p>
              <p style={{ fontSize:"22px", fontWeight:"700", color: item.value === "0.0%" ? "#404040" : "#22c55e" }}>{item.value}</p>
            </div>
          ))}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"12px" }}>
          {[
            { label:"Total Leads", value:total },
            { label:"Agendados", value:agendados },
            { label:"Realizadas", value:realizados },
            { label:"Fechadas", value:fechados },
          ].map((item) => (
            <div key={item.label} style={{ background:"#1a1a1a", borderRadius:"8px", padding:"14px 16px" }}>
              <p style={{ fontSize:"12px", color:"#606060", marginBottom:"6px" }}>{item.label}</p>
              <p style={{ fontSize:"20px", fontWeight:"700", color: item.value > 0 ? "#f0f0f0" : "#404040" }}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"16px", marginBottom:"16px" }}>
        <KPICard label="Leads quentes" value={quentes} change={0} icon={<Flame size={16}/>} iconBg="red"/>
        <KPICard label="Taxa de conversão" value={`${taxaConversao}%`} change={0} icon={<Percent size={16}/>} iconBg="amber"/>
        <KPICard label="Tempo médio de decisão (dias)" value={tempoMedio > 0 ? `${tempoMedio} dias` : "0"} change={0} icon={<Clock size={16}/>} iconBg="blue"/>
        <KPICard label="CAC" value="R$ 0,00" change={0} icon={<DollarSign size={16}/>} iconBg="green"/>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"16px", marginBottom:"16px" }}>
        <KPICard label="Pipeline total" value={formatCurrency(pipeline)} change={0} icon={<DollarSign size={16}/>} iconBg="green"/>
        <KPICard label="Novos leads" value={lf.filter((l)=>l.etapa==="novo").length} change={0} icon={<Plus size={16}/>} iconBg="green"/>
        <KPICard label="MQLs" value={mqls} change={0} icon={<Users size={16}/>} iconBg="blue"/>
        <KPICard label="Leads perdidos" value={perdidos} change={0} icon={<Users size={16}/>} iconBg="red"/>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"16px", marginBottom:"28px" }}>
        <KPICard label="Reuniões agendadas" value={reunioesAgendadas} change={0} icon={<Star size={16}/>} iconBg="green"/>
        <KPICard label="No-shows" value={noShows} change={0} icon={<Users size={16}/>} iconBg="red"/>
        <KPICard label="Reuniões realizadas" value={realizados} change={0} icon={<Star size={16}/>} iconBg="amber"/>
        <KPICard label="Taxa no-show" value={`${agendados > 0 ? ((noShows/agendados)*100).toFixed(1) : "0.0"}%`} change={0} icon={<Percent size={16}/>} iconBg="red"/>
      </div>

      {/* Sem dados */}
      {total === 0 && (
        <div style={{ background:"#1a1a1a", border:"1px solid #2e2e2e", borderRadius:"12px", padding:"32px", textAlign:"center", marginBottom:"20px" }}>
          <p style={{ color:"#606060", fontSize:"14px" }}>Nenhum lead encontrado no período selecionado.</p>
        </div>
      )}

      {/* Gráficos */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px", marginBottom:"20px" }}>
        <div className="card">
          <h3 style={{ fontSize:"14px", fontWeight:"500", marginBottom:"20px" }}>Leads por etapa — Período atual</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barEtapas}>
              <XAxis dataKey="etapa" tick={{ fontSize:10, fill:"#606060" }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize:11, fill:"#606060" }} axisLine={false} tickLine={false} allowDecimals={false}/>
              <Tooltip contentStyle={tooltipStyle}/>
              <Bar dataKey="valor" fill="#22c55e" radius={[4,4,0,0]} name="Leads"/>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3 style={{ fontSize:"14px", fontWeight:"500", marginBottom:"20px" }}>Leads por origem — Período atual</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barOrigem}>
              <XAxis dataKey="origem" tick={{ fontSize:11, fill:"#606060" }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize:11, fill:"#606060" }} axisLine={false} tickLine={false} allowDecimals={false}/>
              <Tooltip contentStyle={tooltipStyle}/>
              <Bar dataKey="valor" fill="#22c55e" radius={[4,4,0,0]} name="Leads"/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabela leads por origem */}
      <div className="card">
        <h3 style={{ fontSize:"14px", fontWeight:"500", marginBottom:"16px" }}>Leads por origem</h3>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr>
                <th style={{ padding:"10px 14px", textAlign:"left", fontSize:"11px", color:"#606060", fontWeight:"600", textTransform:"uppercase", borderBottom:"1px solid #2e2e2e" }}>ORIGEM</th>
                {ETAPAS_LABELS.map((l) => (
                  <th key={l} style={{ padding:"10px", textAlign:"center", fontSize:"11px", color:"#606060", fontWeight:"600", textTransform:"uppercase", borderBottom:"1px solid #2e2e2e" }}>{l.toUpperCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tabelaOrigem.map((row) => (
                <tr key={row.origem} style={{ borderBottom:"1px solid #2e2e2e" }}>
                  <td style={{ padding:"10px 14px", fontSize:"13px", fontWeight:"500" }}>{row.origem}</td>
                  {row.etapas.map((v, i) => (
                    <td key={i} style={{ padding:"10px", textAlign:"center", fontSize:"13px", color: v > 0 ? "#22c55e" : "#404040" }}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
