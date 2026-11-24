"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { MessageCircle, Kanban, CalendarDays, Route, Link2 } from "lucide-react";
import { supabase, getAgenciaId } from "@/lib/supabase";
import PeriodSelector from "@/components/ui/PeriodSelector";
import { Saudacao, Hero, Painel, BarraLinha, Vazio, Atalhos, Carregando, LinkSutil } from "./ui";

const ic = { size: 14, strokeWidth: 1.8 } as const;
const CORES = ["#1C6CA6", "#0A1826", "#8CC6EC", "#144E73", "#E8915A", "#8B6FD6"];

interface Conversa { origem: string | null; created_at: string; primeira_mensagem_at: string | null; etapa_jornada: string | null }

// Data que conta para o período: a primeira mensagem da conversa (não o dia em que ela entrou no sistema).
// Assim, o histórico importado ao conectar o WhatsApp cai nos meses certos.
const dataRef = (c: Conversa) => {
  const iso = c.primeira_mensagem_at || c.created_at;
  return iso ? new Date(iso).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }) : "";
};

// Busca todas as conversas (o Supabase devolve no máximo 1000 por vez)
async function todasConversas(agId: string): Promise<Conversa[]> {
  const out: Conversa[] = [];
  for (let de = 0; de < 50000; de += 1000) {
    const { data } = await supabase.from("conversas").select("origem, created_at, primeira_mensagem_at, etapa_jornada")
      .eq("agencia_id", agId).order("created_at", { ascending: false }).range(de, de + 999);
    out.push(...((data as Conversa[]) || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export default function InicioFilha() {
  const hoje = new Date();
  const [from, setFrom] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split("T")[0]);
  const [to, setTo] = useState(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split("T")[0]);
  const [agNome, setAgNome] = useState("");
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    (async () => {
      const agId = await getAgenciaId();
      if (!agId) { setCarregado(true); return; }
      const [{ data: ag }, convs] = await Promise.all([
        supabase.from("agencias").select("nome").eq("id", agId).single(),
        todasConversas(agId),
      ]);
      if (ag) setAgNome((ag as any).nome || "");
      setConversas(convs);
      setCarregado(true);
    })();
  }, []);

  if (!carregado) return <Carregando />;

  const doPeriodo = conversas.filter((c) => {
    const d = dataRef(c);
    return d >= from && d <= to;
  });
  const naoRastreada = (c: Conversa) => !c.origem || c.origem === "Não Rastreada";
  const total = doPeriodo.length;
  const rastreadas = doPeriodo.filter((c) => !naoRastreada(c)).length;
  const pct = total ? Math.round((rastreadas / total) * 100) : 0;

  const contar = (chave: (c: Conversa) => string) => {
    const m: Record<string, number> = {};
    doPeriodo.forEach((c) => { const k = chave(c); m[k] = (m[k] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  };
  const origens = contar((c) => c.origem || "Não Rastreada");
  const etapas = contar((c) => c.etapa_jornada || "Sem etapa");
  const maxOrigem = origens[0]?.[1] || 0;
  const maxEtapa = etapas[0]?.[1] || 0;

  const porDia: Record<string, number> = {};
  doPeriodo.forEach((c) => { const d = dataRef(c); porDia[d] = (porDia[d] || 0) + 1; });
  const grafico = Object.keys(porDia).sort().map((d) => ({
    dia: new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
    conversas: porDia[d],
  }));

  return (
    <div className="ui-page">
      <Saudacao
        nome={agNome}
        destaque="Seus resultados"
        direita={<PeriodSelector onChange={(_p, f, t) => { setFrom(f); setTo(t); }} />}
      />

      <Hero
        kicker="Conversas no período"
        titulo={`${total.toLocaleString("pt-BR")} conversas novas, ${pct}% rastreadas`}
        acao={{ label: "Abrir inbox", href: "/inbox" }}
        metricas={[
          { label: "Conversas novas", valor: total.toLocaleString("pt-BR") },
          { label: "Rastreadas", valor: rastreadas.toLocaleString("pt-BR"), detalhe: `${pct}% do total` },
          { label: "Não rastreadas", valor: (total - rastreadas).toLocaleString("pt-BR"), detalhe: `${100 - pct}% do total` },
          { label: "Origens diferentes", valor: String(origens.length) },
        ]}
      />

      <div className="ui-grid-2">
        <Painel titulo="De onde vêm as conversas" delay={0.12}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {origens.length === 0 && <Vazio>Nenhuma conversa no período.</Vazio>}
            {origens.slice(0, 7).map(([o, n], i) => (
              <BarraLinha key={o} label={o} valor={n} max={maxOrigem} cor={o === "Não Rastreada" ? "#CBD5DF" : CORES[i % CORES.length]}
                direita={`${n} (${total ? Math.round((n / total) * 100) : 0}%)`} delay={0.15 + i * 0.05} />
            ))}
          </div>
        </Painel>

        <Painel titulo="Jornada dos leads" extra={<LinkSutil href="/crm">Abrir CRM</LinkSutil>} delay={0.18}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {etapas.length === 0 && <Vazio>Nenhuma conversa no período.</Vazio>}
            {etapas.slice(0, 7).map(([e, n], i) => (
              <BarraLinha key={e} label={e} valor={n} max={maxEtapa} cor={e === "Sem etapa" ? "#CBD5DF" : "var(--brand-deep)"} delay={0.2 + i * 0.05} />
            ))}
          </div>
        </Painel>
      </div>

      <Painel titulo="Conversas por dia" delay={0.24} lift={false}>
        {grafico.length === 0 ? <Vazio>Nenhuma conversa no período.</Vazio> : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={grafico} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <XAxis dataKey="dia" tick={{ fontSize: 11, fill: "#4A5B6C" }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#4A5B6C" }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: "#EEF1F4" }} contentStyle={{ background: "#FFFFFF", border: "1px solid #E6EBF0", borderRadius: 12, fontSize: 12 }} />
              <Bar dataKey="conversas" name="Conversas" fill="#1C6CA6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Painel>

      <Painel titulo="Atalhos" delay={0.3} lift={false}>
        <Atalhos grupos={[{ titulo: "Atendimento", itens: [
          { label: "Inbox", href: "/inbox", icone: <MessageCircle {...ic} /> },
          { label: "CRM", href: "/crm", icone: <Kanban {...ic} /> },
          { label: "Jornada", href: "/jornada", icone: <Route {...ic} /> },
          { label: "Reuniões de vendas", href: "/reunioes-vendas", icone: <CalendarDays {...ic} /> },
          { label: "Links de campanha", href: "/ferramentas/gerador-links", icone: <Link2 {...ic} /> },
        ] }]} />
      </Painel>
    </div>
  );
}
