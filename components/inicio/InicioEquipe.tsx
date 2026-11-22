"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAgenciaId } from "@/lib/supabase";
import {
  Users, ClipboardList, AlertTriangle, MessageCircle, Kanban, CalendarDays, BarChart3, FileText, Bot, Link2,
} from "lucide-react";
import {
  Saudacao, Hero, Painel, BarraFases, ItemAtencao, Vazio, Atalhos, Carregando, LinkSutil,
  FASE_BADGE, normaliza, Atalho,
} from "./ui";
import { carregarCarteira, contarFases, ClienteCarteira } from "./dados";

const ic = { size: 14, strokeWidth: 1.8 } as const;

// Atalhos possíveis, com a chave de módulo usada nas permissões do time
const ATALHOS: { grupo: string; modulo: string; a: Atalho }[] = [
  { grupo: "Clientes", modulo: "controle_clientes", a: { label: "Carteira", href: "/controle-clientes", icone: <Users {...ic} /> } },
  { grupo: "Clientes", modulo: "escala_ester", a: { label: "Escala Carol", href: "/escala-ester", icone: <ClipboardList {...ic} /> } },
  { grupo: "Clientes", modulo: "escala_nicolas", a: { label: "Escala Nicolas", href: "/escala-nicolas", icone: <ClipboardList {...ic} /> } },
  { grupo: "Clientes", modulo: "escala_lavinia", a: { label: "Escala Lavínia", href: "/escala-lavinia", icone: <ClipboardList {...ic} /> } },
  { grupo: "Clientes", modulo: "cadastros", a: { label: "Cadastros", href: "/cadastros", icone: <FileText {...ic} /> } },
  { grupo: "Atendimento", modulo: "inbox", a: { label: "Inbox", href: "/inbox", icone: <MessageCircle {...ic} /> } },
  { grupo: "Atendimento", modulo: "crm", a: { label: "CRM", href: "/crm", icone: <Kanban {...ic} /> } },
  { grupo: "Atendimento", modulo: "reunioes", a: { label: "Reuniões", href: "/reunioes", icone: <CalendarDays {...ic} /> } },
  { grupo: "Atendimento", modulo: "reunioes_vendas", a: { label: "Reuniões de vendas", href: "/reunioes-vendas", icone: <CalendarDays {...ic} /> } },
  { grupo: "Atendimento", modulo: "secretaria_ia", a: { label: "Secretária IA", href: "/secretaria-ia", icone: <Bot {...ic} /> } },
  { grupo: "Tráfego", modulo: "relatorios_meta", a: { label: "Relatórios Meta", href: "/relatorios-meta", icone: <BarChart3 {...ic} /> } },
  { grupo: "Tráfego", modulo: "links_campanhas", a: { label: "Links de campanha", href: "/ferramentas/gerador-links", icone: <Link2 {...ic} /> } },
];

const MODULOS_CARTEIRA = ["controle_clientes", "escala_ester", "escala_nicolas", "escala_lavinia"];

export default function InicioEquipe({ nome, permissoes }: { nome: string; permissoes: Set<string> }) {
  const [carregado, setCarregado] = useState(false);
  const [carteira, setCarteira] = useState<ClienteCarteira[]>([]);
  const veCarteira = MODULOS_CARTEIRA.some((m) => permissoes.has(m));

  useEffect(() => {
    (async () => {
      const agId = await getAgenciaId();
      if (agId && veCarteira) setCarteira(await carregarCarteira(agId));
      setCarregado(true);
    })();
  }, [veCarteira]);

  if (!carregado) return <Carregando />;

  // "Meus clientes": o nome do usuário aparece como gestor, consultor, SDR ou head do squad
  const primeiro = normaliza(nome.split(" ")[0]);
  const meus = carteira.filter((c) =>
    c.status !== "saiu" && primeiro.length >= 3 &&
    [c.gestor, c.consultor, c.sdr, c.head_squad].some((campo) => normaliza(campo).includes(primeiro))
  );
  const { contagem, semFase } = contarFases(meus);
  const emEscala = meus.filter((c) => c.escala_jornada === "etapa3" || c.escala_jornada === "etapa4").length;
  const uti = meus.filter((c) => c.uti);
  const oscilando = meus.filter((c) => c.escala_jornada === "resultado_oscilando");
  const fase0 = meus.filter((c) => c.escala_jornada === "etapa0" && !c.uti);

  const atalhos = ATALHOS.filter((x) => permissoes.has(x.modulo));
  const grupos = ["Clientes", "Atendimento", "Tráfego"].map((g) => ({ titulo: g, itens: atalhos.filter((x) => x.grupo === g).map((x) => x.a) }));

  return (
    <div className="ui-page">
      <Saudacao nome={nome.split(" ")[0]} destaque={veCarteira ? "Seus clientes hoje" : "Bom trabalho hoje"} />

      {veCarteira && (
        <Hero
          kicker="Sua carteira"
          titulo={meus.length ? `${meus.length} clientes com você` : "Nenhum cliente vinculado a você"}
          acao={{ label: "Abrir carteira", href: "/controle-clientes" }}
          metricas={[
            { label: "Em escala (Fase 3 e 4)", valor: String(emEscala) },
            { label: "Na UTI", valor: String(uti.length) },
            { label: "Oscilando", valor: String(oscilando.length) },
            { label: "Sem fase definida", valor: String(semFase) },
          ]}
        />
      )}

      {veCarteira && (
        <div className="ui-grid-2">
          <Painel titulo="Precisa de atenção" delay={0.12}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {uti.length + oscilando.length + fase0.length === 0 && (
                <Vazio>{meus.length ? "Nenhum cliente seu em alerta agora." : "Quando seu nome estiver como gestor ou consultor de um cliente na Carteira, ele aparece aqui."}</Vazio>
              )}
              {uti.map((c) => <ItemAtencao key={c.id} tag="UTI" tom="alerta" titulo={c.nome} detalhe={FASE_BADGE[c.escala_jornada || ""]?.label || "Sem fase"} href="/uti" />)}
              {oscilando.map((c) => <ItemAtencao key={c.id} tag="Oscilando" tom="oscilando" titulo={c.nome} detalhe="Resultado oscilando" href="/controle-clientes" />)}
              {fase0.slice(0, 4).map((c) => <ItemAtencao key={c.id} tag="Fase 0" tom="aviso" titulo={c.nome} detalhe="Ainda sem resultado" href="/controle-clientes" />)}
            </div>
          </Painel>

          <Painel titulo="Suas fases" delay={0.18}>
            <BarraFases contagem={contagem} semFase={semFase} />
          </Painel>
        </div>
      )}

      {veCarteira && meus.length > 0 && (
        <Painel titulo="Sua carteira" extra={<LinkSutil href="/controle-clientes">Ver tudo</LinkSutil>} delay={0.24} lift={false}>
          <div style={{ overflowX: "auto" }}>
            <table className="ui-table">
              <thead>
                <tr><th>Cliente</th><th>Fase</th><th>Status</th><th>Gestor</th><th><span className="sr-only">Abrir</span></th></tr>
              </thead>
              <tbody>
                {meus.map((c) => {
                  const f = FASE_BADGE[c.escala_jornada || ""];
                  return (
                    <tr key={c.id}>
                      <td>
                        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span className="ui-avatar">{c.nome.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase()}</span>
                          <span style={{ fontWeight: 600 }}>{c.nome}</span>
                          {c.uti && <span className="badge badge-alert">UTI</span>}
                        </span>
                      </td>
                      <td>{f ? <span className="badge" style={{ background: f.bg, color: f.fg }}>{f.label}</span> : <span className="badge badge-neutral">Sem fase</span>}</td>
                      <td style={{ color: "var(--text-secondary)", textTransform: "capitalize" }}>{c.status || "—"}</td>
                      <td style={{ color: "var(--text-secondary)" }}>{c.gestor || "—"}</td>
                      <td style={{ textAlign: "right" }}><Link href="/controle-clientes" className="ui-chip">Abrir</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Painel>
      )}

      <Painel titulo="Seus atalhos" delay={0.3} lift={false}>
        {atalhos.length ? <Atalhos grupos={grupos} /> : <Vazio>Use o menu ao lado para navegar.</Vazio>}
      </Painel>
    </div>
  );
}
