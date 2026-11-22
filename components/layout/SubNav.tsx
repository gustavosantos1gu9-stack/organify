"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Abas em pílula das áreas com mais de uma tela (padrão do canvas).
// O menu lateral mostra uma entrada por área; aqui ficam as telas da área.
export const SECOES: { area: string; itens: { label: string; href: string; tambem?: string[] }[] }[] = [
  { area: "Carteira", itens: [
    { label: "Todas as clientes", href: "/controle-clientes" },
    { label: "Escala Carol", href: "/escala-ester" },
    { label: "Escala Nicolas", href: "/escala-nicolas" },
    { label: "Escala Lavínia", href: "/escala-lavinia" },
  ] },
  { area: "CRM e Jornada", itens: [
    { label: "CRM", href: "/crm" },
    { label: "Painel do CRM", href: "/crm/dashboard" },
    { label: "Jornada", href: "/jornada" },
    { label: "Funis", href: "/funis" },
  ] },
  { area: "Inbox", itens: [
    { label: "Conversas", href: "/inbox" },
    { label: "Painel", href: "/inbox/dashboard" },
  ] },
  { area: "Relatórios Meta", itens: [
    { label: "Relatórios", href: "/relatorios-meta" },
    { label: "Alertas", href: "/relatorios-meta/alertas" },
    { label: "Conexões", href: "/relatorios-meta/conexoes" },
  ] },
  { area: "Links e formulários", itens: [
    { label: "Mensagens rastreáveis", href: "/mensagens-rastreaveis" },
    { label: "Formulários", href: "/formularios" },
    { label: "Links de campanha", href: "/ferramentas/gerador-links" },
    { label: "Configurar campanha", href: "/ferramentas/campanhas" },
  ] },
  { area: "Pixel e webhooks", itens: [
    { label: "Disparos de Pixel", href: "/disparos-pixel" },
    { label: "Disparos de Webhook", href: "/disparos-webhook" },
  ] },
  { area: "Financeiro", itens: [
    { label: "Visão geral", href: "/financeiro", tambem: ["/inicio"] },
    { label: "Movimentações", href: "/financeiro/movimentacoes" },
    { label: "Lançamentos futuros", href: "/financeiro/lancamentos-futuros" },
    { label: "Recorrências", href: "/financeiro/recorrencias" },
    { label: "DRE", href: "/dre" },
    { label: "Clientes", href: "/clientes" },
  ] },
  { area: "Ferramentas", itens: [
    { label: "Clientes", href: "/ferramentas/clientes" },
    { label: "Landing pages", href: "/ferramentas/lp" },
    { label: "Configurações", href: "/ferramentas/configuracoes" },
  ] },
  { area: "Configurações", itens: [
    { label: "Integrações", href: "/configuracoes/integracoes" },
    { label: "Contas de WhatsApp", href: "/configuracoes/whatsapp-contas" },
    { label: "Status do WhatsApp", href: "/configuracoes/whatsapp-status" },
    { label: "Times", href: "/configuracoes/times" },
    { label: "Usuários", href: "/configuracoes/usuarios" },
    { label: "Agência", href: "/configuracoes/agencia" },
    { label: "Cadastros auxiliares", href: "/configuracoes/cadastros-auxiliares", tambem: ["/configuracoes/fornecedores", "/configuracoes/financeiro", "/configuracoes/clientes"] },
  ] },
];

function ativo(pathname: string, href: string) {
  const item = SECOES.flatMap((x) => x.itens).find((i) => i.href === href);
  if (item?.tambem?.some((t) => pathname === t || pathname.startsWith(t + "/"))) return true;
  if (href === "/financeiro") return pathname === "/financeiro";
  return pathname === href || (href !== "/" && pathname.startsWith(href + "/") && !SECOES.some((s) => s.itens.some((i) => i.href !== href && i.href.startsWith(href + "/") && pathname.startsWith(i.href))));
}

export function secaoDaRota(pathname: string) {
  return SECOES.find((s) => s.itens.some((i) => ativo(pathname, i.href)));
}

export default function SubNav() {
  const pathname = usePathname() || "";
  const secao = secaoDaRota(pathname);
  if (!secao) return null;
  return (
    <nav aria-label={`Seções de ${secao.area}`} className="subnav">
      {secao.itens.map((i) => (
        <Link key={i.href} href={i.href} className={ativo(pathname, i.href) ? "subnav-item on" : "subnav-item"}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
