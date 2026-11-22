"use client";

import { useEffect, useState } from "react";
import { supabase, getAgenciaId } from "@/lib/supabase";
import {
  Users, ClipboardList, AlertTriangle, MessageCircle, Kanban, CalendarDays, BarChart3,
  DollarSign, Settings, Bot, FileText, Building2,
} from "lucide-react";
import {
  Saudacao, Hero, Painel, BarraFases, ItemAtencao, Vazio, BarraLinha, Atalhos, Carregando,
  LinkSutil, FASE_BADGE, brl,
} from "./ui";
import { carregarCarteira, contarFases, contarConversas, inicioDoMes, ClienteCarteira } from "./dados";

const ic = { size: 14, strokeWidth: 1.8 } as const;

export default function InicioDono({ nome }: { nome: string }) {
  const [carregado, setCarregado] = useState(false);
  const [carteira, setCarteira] = useState<ClienteCarteira[]>([]);
  const [receita, setReceita] = useState({ total: 0, ativos: 0 });
  const [conv, setConv] = useState({ total: 0, rastreadas: 0, naoRastreadas: 0 });

  useEffect(() => {
    (async () => {
      const agId = await getAgenciaId();
      if (!agId) { setCarregado(true); return; }
      const desde = inicioDoMes();
      const [cart, { data: cli }, c] = await Promise.all([
        carregarCarteira(agId),
        supabase.from("clientes").select("status, valor_oportunidade").eq("agencia_id", agId),
        contarConversas(agId, desde),
      ]);
      const ativos = ((cli as any[]) || []).filter((x) => x.status === "ativo");
      setReceita({ total: ativos.reduce((s, x) => s + (Number(x.valor_oportunidade) || 0), 0), ativos: ativos.length });
      setCarteira(cart);
      setConv(c);
      setCarregado(true);
    })();
  }, []);

  if (!carregado) return <Carregando />;

  const desde = inicioDoMes();
  const naCarteira = carteira.filter((c) => c.status !== "saiu");
  const ativos = carteira.filter((c) => c.status === "ativo");
  const novos = carteira.filter((c) => c.data_entrada && c.data_entrada >= desde);
  const churnMes = carteira.filter((c) => c.status === "saiu" && c.data_churn && c.data_churn >= desde);
  const churnPct = naCarteira.length + churnMes.length > 0 ? (churnMes.length / (naCarteira.length + churnMes.length)) * 100 : 0;
  const { contagem, semFase } = contarFases(naCarteira);

  const uti = naCarteira.filter((c) => c.uti);
  const oscilando = naCarteira.filter((c) => c.escala_jornada === "resultado_oscilando");
  const fase0 = naCarteira.filter((c) => c.escala_jornada === "etapa0" && !c.uti);
  const pausados = naCarteira.filter((c) => c.status === "pausado");

  // Equipe: clientes por gestor
  const porGestor: Record<string, { total: number; escala: number; uti: number }> = {};
  naCarteira.forEach((c) => {
    const g = (c.gestor || "").trim() || "Sem gestor";
    porGestor[g] ||= { total: 0, escala: 0, uti: 0 };
    porGestor[g].total++;
    if (c.escala_jornada === "etapa3" || c.escala_jornada === "etapa4") porGestor[g].escala++;
    if (c.uti) porGestor[g].uti++;
  });
  const gestores = Object.entries(porGestor).sort((a, b) => b[1].total - a[1].total);
  const maxGestor = gestores[0]?.[1].total || 0;

  const mes = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const pctRastreio = conv.total ? Math.round((conv.rastreadas / conv.total) * 100) : 0;
  const ticket = receita.ativos ? receita.total / receita.ativos : 0;

  const atencao = [
    ...uti.slice(0, 4).map((c) => ({ tag: "UTI", tom: "alerta" as const, titulo: c.nome, detalhe: FASE_BADGE[c.escala_jornada || ""]?.label || "Sem fase", direita: c.gestor || "", href: "/uti" })),
    ...oscilando.slice(0, 3).map((c) => ({ tag: "Oscilando", tom: "oscilando" as const, titulo: c.nome, detalhe: "Resultado oscilando", direita: c.gestor || "", href: "/controle-clientes" })),
    ...fase0.slice(0, 2).map((c) => ({ tag: "Fase 0", tom: "aviso" as const, titulo: c.nome, detalhe: "Ainda sem resultado", direita: c.gestor || "", href: "/controle-clientes" })),
  ];

  return (
    <div className="ui-page">
      <Saudacao nome={nome} destaque="Veja como a agência está hoje e o que pede atenção." />

      <Hero
        kicker="Resumo da agência"
        titulo={`${ativos.length} clientes ativos em ${mes.split(" ")[0]}`}
        acao={{ label: "Ver financeiro", href: "/dre" }}
        metricas={[
          { label: "Receita recorrente", valor: brl(receita.total), detalhe: `Ticket médio ${brl(ticket)}` },
          { label: "Clientes na carteira", valor: String(naCarteira.length), detalhe: `${pausados.length} pausados` },
          { label: "Novos no mês", valor: String(novos.length) },
          { label: "Churn do mês", valor: `${churnPct.toFixed(1).replace(".", ",")}%`, detalhe: `${churnMes.length} saíram` },
        ]}
      />

      <div className="ui-grid-2">
        <Painel titulo="Fases da carteira" extra={<LinkSutil href="/escala-nicolas">Abrir escalas</LinkSutil>} delay={0.12}>
          <BarraFases contagem={contagem} semFase={semFase} />
        </Painel>

        <Painel
          titulo="Precisa de atenção hoje"
          extra={<span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{uti.length} na UTI, {oscilando.length} oscilando</span>}
          delay={0.18}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {atencao.length === 0 && <Vazio>Nenhum cliente em alerta agora.</Vazio>}
            {atencao.map((a) => <ItemAtencao key={a.tag + a.titulo} {...a} />)}
            {semFase > 0 && (
              <ItemAtencao tag="Cadastro" tom="neutro" titulo={`${semFase} clientes sem fase definida`} detalhe="Definir a fase nas escalas" direita="Resolver" href="/controle-clientes" />
            )}
          </div>
        </Painel>
      </div>

      <div className="ui-grid-2">
        <Painel titulo="Equipe" extra={<span style={{ fontSize: 13, color: "var(--ink-3)" }}>Clientes por gestor</span>} delay={0.24}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {gestores.length === 0 && <Vazio>Nenhum cliente na carteira.</Vazio>}
            {gestores.slice(0, 6).map(([g, v], i) => (
              <BarraLinha
                key={g}
                label={g}
                valor={v.total}
                max={maxGestor}
                cor={i === 0 ? "var(--navy)" : "var(--brand)"}
                direita={`${v.total} clientes, ${v.escala} em escala${v.uti ? `, ${v.uti} na UTI` : ""}`}
                delay={0.25 + i * 0.05}
              />
            ))}
          </div>
        </Painel>

        <Painel titulo="Atendimento no mês" extra={<LinkSutil href="/inbox">Abrir inbox</LinkSutil>} delay={0.3}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
            {[
              { l: "Conversas novas", v: conv.total, c: "var(--navy)" },
              { l: "Rastreadas", v: conv.rastreadas, c: "var(--success)" },
              { l: "Não rastreadas", v: conv.naoRastreadas, c: "var(--alert-text)" },
            ].map((x) => (
              <div key={x.l} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{x.l}</span>
                <span className="font-title" style={{ fontSize: 28, fontWeight: 600, color: x.c }}>{x.v.toLocaleString("pt-BR")}</span>
              </div>
            ))}
          </div>
          <BarraLinha label="Rastreio das conversas" valor={pctRastreio} max={100} cor="var(--success)" direita={`${pctRastreio}%`} delay={0.35} />
        </Painel>
      </div>

      <Painel titulo="Atalhos" delay={0.36} lift={false}>
        <Atalhos grupos={[
          { titulo: "Clientes", itens: [
            { label: "Carteira", href: "/controle-clientes", icone: <Users {...ic} /> },
            { label: "UTI", href: "/uti", icone: <AlertTriangle {...ic} /> },
            { label: "Cadastros", href: "/cadastros", icone: <FileText {...ic} /> },
            { label: "Escalas", href: "/escala-nicolas", icone: <ClipboardList {...ic} /> },
          ] },
          { titulo: "Atendimento", itens: [
            { label: "Inbox", href: "/inbox", icone: <MessageCircle {...ic} /> },
            { label: "CRM", href: "/crm", icone: <Kanban {...ic} /> },
            { label: "Reuniões de vendas", href: "/reunioes-vendas", icone: <CalendarDays {...ic} /> },
            { label: "Secretária IA", href: "/secretaria-ia", icone: <Bot {...ic} /> },
          ] },
          { titulo: "Tráfego e gestão", itens: [
            { label: "Performance", href: "/performance", icone: <BarChart3 {...ic} /> },
            { label: "Relatórios Meta", href: "/relatorios-meta", icone: <BarChart3 {...ic} /> },
            { label: "Financeiro", href: "/dre", icone: <DollarSign {...ic} /> },
            { label: "Base mensal", href: "/inicio", icone: <CalendarDays {...ic} /> },
            { label: "Clientes SaaS", href: "/clientes-saas", icone: <Building2 {...ic} /> },
            { label: "Configurações", href: "/configuracoes/integracoes", icone: <Settings {...ic} /> },
          ] },
        ]} />
      </Painel>
    </div>
  );
}
