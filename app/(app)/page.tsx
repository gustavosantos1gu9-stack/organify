"use client";

import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import PeriodSelector from "@/components/ui/PeriodSelector";

// DashboardMaster está em /components/DashboardMaster.tsx (acessível via /inicio)

const tooltipStyle = { background: "#1e1e1e", border: "1px solid #2e2e2e", borderRadius: "8px", fontSize: "12px", color: "#f0f0f0" };


// ─── Dashboard Cliente (agência filha) ───────────────────────
function DashboardCliente() {
  const hoje = new Date();
  const [from, setFrom] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split("T")[0]);
  const [to, setTo] = useState(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split("T")[0]);
  const [agNome, setAgNome] = useState("");
  const [conversas, setConversas] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const { getAgenciaId } = await import("@/lib/supabase");
      const { supabase } = await import("@/lib/supabase");
      const agId = await getAgenciaId();
      if (!agId) return;
      const [{ data: ag }, { data: convs }] = await Promise.all([
        supabase.from("agencias").select("nome").eq("id", agId).single(),
        supabase.from("conversas").select("*").eq("agencia_id", agId).order("created_at", { ascending: false }),
      ]);
      if (ag) setAgNome(ag.nome);
      setConversas(convs || []);
    }
    load();
  }, []);

  // Filtrar por período
  const convsNoPeriodo = conversas.filter((c: any) => {
    const d = c.created_at?.split("T")[0];
    return d >= from && d <= to;
  });

  const totalConversas = convsNoPeriodo.length;
  const rastreadas = convsNoPeriodo.filter((c: any) => c.origem && c.origem !== "Não Rastreada");
  const naoRastreadas = convsNoPeriodo.filter((c: any) => !c.origem || c.origem === "Não Rastreada");
  const pctRastreadas = totalConversas > 0 ? ((rastreadas.length / totalConversas) * 100).toFixed(1) : "0";
  const pctNaoRastreadas = totalConversas > 0 ? ((naoRastreadas.length / totalConversas) * 100).toFixed(1) : "0";

  // Origem das conversas
  const origemMap: Record<string, number> = {};
  convsNoPeriodo.forEach((c: any) => {
    const origem = c.origem || "Não Rastreada";
    origemMap[origem] = (origemMap[origem] || 0) + 1;
  });
  const origemData = Object.entries(origemMap).map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total);

  // Gráfico por dia
  const porDia: Record<string, Record<string, number>> = {};
  convsNoPeriodo.forEach((c: any) => {
    const dia = c.created_at?.split("T")[0] || "";
    const origem = c.origem || "Não Rastreada";
    if (!porDia[dia]) porDia[dia] = {};
    porDia[dia][origem] = (porDia[dia][origem] || 0) + 1;
  });
  const diasOrdenados = Object.keys(porDia).sort();
  const todasOrigens = Array.from(new Set(convsNoPeriodo.map((c: any) => c.origem || "Não Rastreada")));
  const CORES_ORIGEM = ["#3b82f6", "#f59e0b", "#22c55e", "#ef4444", "#8b5cf6", "#ec4899"];

  const graficoDia = diasOrdenados.map(dia => {
    const entry: any = { dia: new Date(dia + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) };
    todasOrigens.forEach(o => { entry[o] = porDia[dia][o] || 0; });
    return entry;
  });

  // Jornada / funil — usar etapa_jornada das conversas
  const etapasJornada = convsNoPeriodo.reduce((acc: Record<string, number>, c: any) => {
    const etapa = c.etapa_jornada || "Sem etapa";
    acc[etapa] = (acc[etapa] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const funilData = Object.entries(etapasJornada)
    .map(([etapa, total]) => ({ etapa, total }))
    .sort((a, b) => b.total - a.total)
    .filter(f => f.total > 0);

  return (
    <div className="animate-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "600" }}>Dashboard do cliente {agNome}</h1>
          <p style={{ fontSize: "13px", color: "#606060" }}>Início › Dashboard</p>
        </div>
        <PeriodSelector onChange={(_period, f, t) => { setFrom(f); setTo(t); }} />
      </div>

      {/* Visão Geral */}
      <h2 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "16px" }}>Visão Geral das Conversas</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "32px" }}>
        {/* Donut + métricas */}
        <div className="card" style={{ padding: "24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
            <div>
              <p style={{ fontSize: "12px", color: "#606060" }}>Total de Conversas Novas</p>
              <p style={{ fontSize: "28px", fontWeight: "700", color: "#f0f0f0" }}>{totalConversas}</p>
            </div>
            <div>
              <p style={{ fontSize: "12px", color: "#606060" }}>Conversas Rastreadas</p>
              <p style={{ fontSize: "20px", fontWeight: "600", color: "#22c55e" }}>{rastreadas.length} <span style={{ fontSize: "13px", color: "#606060" }}>{pctRastreadas}%</span></p>
              <p style={{ fontSize: "12px", color: "#606060", marginTop: "8px" }}>Conversas não rastreadas</p>
              <p style={{ fontSize: "20px", fontWeight: "600", color: "#ef4444" }}>{naoRastreadas.length} <span style={{ fontSize: "13px", color: "#606060" }}>{pctNaoRastreadas}%</span></p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={[
                { name: "Rastreadas", value: rastreadas.length },
                { name: "Não rastreadas", value: naoRastreadas.length },
              ]} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, percent }) => `${(percent * 100).toFixed(0)}% ${name}`}>
                <Cell fill="#22c55e" />
                <Cell fill="#f59e0b" />
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Origem das conversas */}
        <div className="card" style={{ padding: "24px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "16px" }}>Origem das Conversas</h3>
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "16px" }}>
            {origemData.map((o, i) => (
              <div key={o.nome} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: CORES_ORIGEM[i % CORES_ORIGEM.length] }} />
                <span style={{ fontSize: "13px", color: "#f0f0f0", fontWeight: "600" }}>{o.nome}</span>
                <span style={{ fontSize: "18px", fontWeight: "700", color: "#f0f0f0" }}>{o.total}</span>
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={graficoDia}>
              <XAxis dataKey="dia" tick={{ fontSize: 11, fill: "#606060" }} />
              <YAxis tick={{ fontSize: 11, fill: "#606060" }} />
              <Tooltip contentStyle={tooltipStyle} />
              {todasOrigens.map((o, i) => (
                <Bar key={o} dataKey={o} stackId="a" fill={CORES_ORIGEM[i % CORES_ORIGEM.length]} radius={i === todasOrigens.length - 1 ? [4, 4, 0, 0] : undefined} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Funil */}
      <h2 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "16px" }}>Funil da Jornada de Compra</h2>
      <div className="card" style={{ padding: "24px", marginBottom: "32px" }}>
        {funilData.length === 0 ? (
          <p style={{ color: "#606060", textAlign: "center", padding: "24px" }}>Nenhum lead no período.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {funilData.map((f, i) => {
              const maxTotal = funilData[0]?.total || 1;
              const pct = totalConversas > 0 ? ((f.total / totalConversas) * 100).toFixed(1) : "0";
              return (
                <div key={f.etapa} style={{
                  background: `linear-gradient(90deg, rgba(41,171,226,${0.3 - i * 0.04}) 0%, rgba(41,171,226,${0.1 - i * 0.01}) 100%)`,
                  borderRadius: "8px",
                  padding: "14px 20px",
                  width: `${Math.max((f.total / maxTotal) * 100, 30)}%`,
                  transition: "width 0.5s",
                }}>
                  <span style={{ fontSize: "13px", fontWeight: "600", color: "#f0f0f0" }}>{f.etapa}</span>
                  <span style={{ fontSize: "13px", color: "#a0a0a0", marginLeft: "8px" }}>{pct}% ({f.total})</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Hub Master ──────────────────────────────────────────────
const HUB_CATEGORIAS = [
  {
    key: "financeiro",
    titulo: "Financeiro",
    descricao: "Dashboard, DRE, movimentações, clientes e cadastros",
    cor: "#22c55e",
    icone: "💰",
    links: [
      { label: "Dashboard (Início)", href: "/inicio" },
      { label: "DRE", href: "/dre" },
      { label: "Movimentações", href: "/financeiro/movimentacoes" },
      { label: "Lançamentos Futuros", href: "/financeiro/lancamentos-futuros" },
      { label: "Recorrências", href: "/financeiro/recorrencias" },
      { label: "Clientes", href: "/clientes" },
    ],
  },
  {
    key: "sdr",
    titulo: "SDR",
    descricao: "Secretaria IA, funis, jornada, CRM e rastreamento",
    cor: "#29ABE2",
    icone: "🤖",
    links: [
      { label: "Secretaria IA", href: "/secretaria-ia" },
      { label: "Inbox", href: "/inbox" },
      { label: "Jornada", href: "/jornada" },
      { label: "CRM", href: "/crm" },
      { label: "Reuniões de Vendas", href: "/reunioes-vendas" },
      { label: "Funis", href: "/funis" },
      { label: "Formulários", href: "/formularios" },
      { label: "Gerador de Leads", href: "/gerador-de-leads" },
      { label: "Mensagens rastreáveis", href: "/mensagens-rastreaveis" },
      { label: "Disparos Pixel", href: "/disparos-pixel" },
      { label: "Disparos Webhook", href: "/disparos-webhook" },
    ],
  },
  {
    key: "operacional",
    titulo: "Operacional",
    descricao: "Relatórios Meta, escalas, reuniões e configurações",
    cor: "#f59e0b",
    icone: "📊",
    links: [
      { label: "Controle de Clientes", href: "/controle-clientes" },
      { label: "Cadastros", href: "/cadastros" },
      { label: "Churn", href: "/gerador-de-leads" },
      { label: "Relatórios Meta", href: "/relatorios-meta" },
      { label: "Dashboard Meta", href: "/relatorios-meta/dashboard" },
      { label: "Alertas", href: "/relatorios-meta/alertas" },
      { label: "Escala Ester", href: "/escala-ester" },
      { label: "Escala Nicolas", href: "/escala-nicolas" },
      { label: "Reuniões", href: "/reunioes" },
      { label: "Configurações", href: "/configuracoes/integracoes" },
    ],
  },
];

function HubMaster() {
  // Todos os cards abertos por padrão
  const [abertos, setAbertos] = useState<Record<string, boolean>>({ financeiro: true, sdr: true, operacional: true });

  const toggle = (key: string) => setAbertos(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div style={{ padding: "48px 32px" }}>
      <div style={{ marginBottom: "40px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <img src="/logo.png" alt="SALX" style={{ height: "80px", marginBottom: "24px", objectFit: "contain" }} />
        <h1 style={{ fontSize: "26px", fontWeight: "700", color: "#f0f0f0", marginBottom: "6px" }}>Bem-vindo ao SALX Convert</h1>
        <p style={{ fontSize: "13px", color: "#606060" }}>Selecione uma área para começar</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px", maxWidth: "1000px", margin: "0 auto" }}>
        {HUB_CATEGORIAS.map((cat) => {
          const isAberto = abertos[cat.key];
          return (
            <div
              key={cat.key}
              style={{
                background: "#141414",
                border: `1.5px solid ${isAberto ? cat.cor : "#2a2a2a"}`,
                borderRadius: "16px",
                padding: "24px",
                transition: "all 0.2s",
                boxShadow: isAberto ? `0 0 24px ${cat.cor}18` : "none",
              }}
            >
              {/* Header clicável */}
              <div
                onClick={() => toggle(cat.key)}
                style={{ display: "flex", alignItems: "center", gap: "14px", cursor: "pointer", marginBottom: isAberto ? "20px" : "0" }}
              >
                <div style={{
                  width: "44px", height: "44px", borderRadius: "12px",
                  background: `${cat.cor}18`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "20px", flexShrink: 0,
                }}>
                  {cat.icone}
                </div>
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: "16px", fontWeight: "700", color: "#f0f0f0", margin: 0 }}>{cat.titulo}</h2>
                  <p style={{ fontSize: "11px", color: "#505050", margin: 0, marginTop: "2px", lineHeight: "1.4" }}>{cat.descricao}</p>
                </div>
                <span style={{ color: cat.cor, fontSize: "16px", transform: isAberto ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }}>›</span>
              </div>

              {/* Links */}
              {isAberto && (
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  {cat.links.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "8px 10px", borderRadius: "8px",
                        background: "#1c1c1c", color: "#c0c0c0",
                        fontSize: "13px", fontWeight: "500",
                        textDecoration: "none",
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = `${cat.cor}15`; e.currentTarget.style.color = "#f0f0f0"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "#1c1c1c"; e.currentTarget.style.color = "#c0c0c0"; }}
                    >
                      {link.label}
                      <span style={{ color: cat.cor, fontSize: "14px" }}>→</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* Atalhos rápidos */}
      <div style={{ display: "flex", gap: "12px", maxWidth: "1000px", margin: "16px auto 0" }}>
        {[
          { label: "⚙️ Configurações", href: "/configuracoes/integracoes", cor: "#8b5cf6" },
          { label: "🏢 Clientes SaaS", href: "/clientes-saas", cor: "#ec4899" },
        ].map((item) => (
          <a
            key={item.href}
            href={item.href}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              padding: "12px 20px", borderRadius: "12px",
              background: "#141414", border: `1.5px solid #2a2a2a`,
              color: "#a0a0a0", fontSize: "13px", fontWeight: "600",
              textDecoration: "none", transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = item.cor; e.currentTarget.style.color = "#f0f0f0"; e.currentTarget.style.background = `${item.cor}12`; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#2a2a2a"; e.currentTarget.style.color = "#a0a0a0"; e.currentTarget.style.background = "#141414"; }}
          >
            {item.label}
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── Wrapper: escolhe qual dashboard mostrar ─────────────────
import { supabase as sb, getAgenciaId as getAgId } from "@/lib/supabase";

export default function DashboardPage() {
  const [isFilha, setIsFilha] = useState<boolean | null>(null);

  useEffect(() => {
    async function check() {
      const agId = await getAgId();
      if (!agId) { setIsFilha(false); return; }
      const { data } = await sb.from("agencias").select("parent_id").eq("id", agId).single();
      setIsFilha(!!data?.parent_id);
    }
    check();
  }, []);

  if (isFilha === null) return (
    <div style={{ display: "flex", justifyContent: "center", padding: "60px" }}>
      <div style={{ width: "32px", height: "32px", borderRadius: "50%", border: "3px solid #2e2e2e", borderTop: "3px solid #29ABE2", animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return isFilha ? <DashboardCliente /> : <HubMaster />;
}
