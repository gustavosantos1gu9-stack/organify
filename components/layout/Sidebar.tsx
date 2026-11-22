"use client";

import { useState, useEffect, useRef, useLayoutEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  LayoutDashboard,
  Users,
  Users2,
  ClipboardList,
  AlertTriangle,
  MessageCircle,
  Kanban,
  CalendarDays,
  Bot,
  TrendingUp,
  BarChart3,
  Link2,
  FileText,
  Target,
  DollarSign,
  Building2,
  Settings,
  Plug,
  Smartphone,
  UserCheck,
  ChevronDown,
  LogOut,
  Wifi,
  WifiOff,
  Menu,
  X,
  Wallet,
  Briefcase,
  BarChart2,
  Wrench,
  UserMinus,
} from "lucide-react";

interface NavItem {
  href?: string;
  label: string;
  icon: React.ReactNode;
  children?: NavChild[];
  group?: string;
}

interface NavChild {
  href?: string;
  label: string;
  children?: { href: string; label: string }[];
}

// ─── Map href → module key for permission filtering ───────────
const hrefToModuloKey: Record<string, string> = {
  "/": "inicio",
  "/clientes": "clientes",
  "/inbox": "inbox",
  "/crm": "crm",
  "/secretaria-ia": "secretaria_ia",
  "/funis": "funis",
  "/relatorios-meta": "relatorios_meta",
  "/relatorios-meta/conexoes": "relatorios_conexoes",
  "/relatorios-meta/alertas": "relatorios_alertas",
  "/controle-clientes": "controle_clientes",
  "/cadastros": "cadastros",
  "/reunioes": "reunioes",
  "/reunioes-vendas": "reunioes_vendas",
  "/escala-ester": "escala_ester",
  "/escala-nicolas": "escala_nicolas",
  "/escala-lavinia": "escala_lavinia",
  "/gerador-de-leads": "churn",
  "/churn": "churn",
  "/ferramentas/gerador-links": "links_campanhas",
  "/ferramentas/campanhas": "configurar_campanha",
  "/jornada": "jornada",
  "/dre": "dre",
  "/financeiro/lancamentos-futuros": "lancamentos",
  "/financeiro/movimentacoes": "movimentacoes",
  "/financeiro/recorrencias": "recorrencias",
  "/clientes-saas": "clientes_saas",
  "/mensagens-rastreaveis": "mensagens_rastreaveis",
  "/disparos-pixel": "disparos_pixel",
  "/disparos-webhook": "disparos_webhook",
};

const groupChildKeys: Record<string, string[]> = {
  Financeiro: ["clientes", "dre", "lancamentos", "movimentacoes", "recorrencias"],
  SDR: ["inbox", "crm", "reunioes_vendas"],
  "Relatórios Meta": ["relatorios_meta", "relatorios_conexoes", "relatorios_alertas"],
  Operacional: ["controle_clientes", "cadastros", "reunioes", "escala_ester", "escala_nicolas", "escala_lavinia", "churn"],
  Rastreamento: ["links_campanhas", "configurar_campanha", "jornada"],
  Escalas: ["escala_ester", "escala_nicolas", "escala_lavinia"],
  Carteira: ["controle_clientes", "escala_ester", "escala_nicolas", "escala_lavinia"],
  "CRM e Jornada": ["crm", "jornada", "funis"],
  Reuniões: ["reunioes", "reunioes_vendas"],
  "Pixel e webhooks": ["disparos_pixel", "disparos_webhook"],
};

// ─── Menu MASTER — com grupos ─────────────────────────────────
interface NavGroup {
  group: string;
  items: NavItem[];
}

const masterGroups: NavGroup[] = [
  {
    group: "",
    items: [
      { href: "/", label: "Início", icon: <LayoutDashboard size={16} strokeWidth={1.8} /> },
    ],
  },
  {
    group: "CLIENTES",
    items: [
      {
        // Carteira e escalas por gestor ficam juntas; as escalas viram abas da Carteira
        label: "Carteira", icon: <Users size={16} strokeWidth={1.8} />,
        children: [
          { href: "/controle-clientes", label: "Todas as clientes" },
          { href: "/escala-ester", label: "Escala Carol" },
          { href: "/escala-nicolas", label: "Escala Nicolas" },
          { href: "/escala-lavinia", label: "Escala Lavínia" },
        ],
      },
      { href: "/reunioes", label: "Reuniões agendadas", icon: <CalendarDays size={16} strokeWidth={1.8} /> },
      { href: "/uti", label: "UTI", icon: <AlertTriangle size={16} strokeWidth={1.8} /> },
      { href: "/cadastros", label: "Cadastros", icon: <FileText size={16} strokeWidth={1.8} /> },
      { href: "/churn", label: "Churn", icon: <UserMinus size={16} strokeWidth={1.8} /> },
    ],
  },
  {
    group: "ATENDIMENTO",
    items: [
      { href: "/inbox", label: "Inbox", icon: <MessageCircle size={16} strokeWidth={1.8} /> },
      {
        label: "CRM e Jornada", icon: <Kanban size={16} strokeWidth={1.8} />,
        children: [
          { href: "/crm", label: "CRM" },
          { href: "/jornada", label: "Jornada" },
          { href: "/funis", label: "Funis" },
        ],
      },
      { href: "/reunioes-vendas", label: "Reuniões de vendas", icon: <BarChart2 size={16} strokeWidth={1.8} /> },
      { href: "/secretaria-ia", label: "Secretária IA", icon: <Bot size={16} strokeWidth={1.8} /> },
    ],
  },
  {
    group: "TRÁFEGO",
    items: [
      {
        label: "Relatórios Meta", icon: <BarChart3 size={16} strokeWidth={1.8} />,
        children: [
          { href: "/relatorios-meta", label: "Relatórios" },
          { href: "/relatorios-meta/dashboard", label: "Dashboard" },
          { href: "/relatorios-meta/alertas", label: "Alertas" },
          { href: "/relatorios-meta/conexoes", label: "Conexões WhatsApp" },
        ],
      },
      {
        label: "Links e formulários", icon: <Link2 size={16} strokeWidth={1.8} />,
        children: [
          { href: "/mensagens-rastreaveis", label: "Mensagens rastreáveis" },
          { href: "/formularios", label: "Formulários" },
        ],
      },
      {
        label: "Pixel e webhooks", icon: <Target size={16} strokeWidth={1.8} />,
        children: [
          { href: "/disparos-pixel", label: "Disparos Pixel" },
          { href: "/disparos-webhook", label: "Disparos Webhook" },
        ],
      },
    ],
  },
  {
    group: "GESTÃO",
    items: [
      {
        label: "Financeiro", icon: <DollarSign size={16} strokeWidth={1.8} />,
        children: [
          { href: "/financeiro", label: "Visão geral" },
          { href: "/financeiro/movimentacoes", label: "Movimentações" },
          { href: "/financeiro/lancamentos-futuros", label: "Lançamentos" },
          { href: "/financeiro/recorrencias", label: "Recorrências" },
          { href: "/dre", label: "DRE" },
          { href: "/clientes", label: "Clientes" },
        ],
      },
      { href: "/financas", label: "Finanças", icon: <Wallet size={16} strokeWidth={1.8} /> },
      {
        label: "Ferramentas", icon: <Wrench size={16} strokeWidth={1.8} />,
        children: [
          { href: "/ferramentas/clientes", label: "Clientes" },
          { href: "/ferramentas/lp", label: "Landing Pages" },
          { href: "/ferramentas/configuracoes", label: "Configurações" },
        ],
      },
      { href: "/clientes-saas", label: "Clientes SaaS", icon: <Building2 size={16} strokeWidth={1.8} /> },
    ],
  },
  {
    group: "",
    items: [
      {
        label: "Configurações", icon: <Settings size={16} strokeWidth={1.8} />,
        children: [
          { href: "/configuracoes/integracoes", label: "Integrações" },
          { href: "/configuracoes/whatsapp-contas", label: "WhatsApp" },
          { href: "/configuracoes/times", label: "Times" },
          { href: "/configuracoes/agencia", label: "Agência" },
          { href: "/configuracoes/usuarios", label: "Usuários" },
          { href: "/configuracoes/cadastros-auxiliares", label: "Cadastros auxiliares" },
        ],
      },
    ],
  },
];

// ─── Menu CLIENTE (agência filha) ─────────────────────────────
const navItemsCliente: NavItem[] = [
  { href: "/", label: "Dashboard", icon: <LayoutDashboard size={16} strokeWidth={1.8} /> },
  { href: "/inbox", label: "Conversas", icon: <MessageCircle size={16} strokeWidth={1.8} /> },
  { href: "/crm", label: "CRM", icon: <Kanban size={16} strokeWidth={1.8} /> },
  { href: "/secretaria-ia", label: "Secretária IA", icon: <Bot size={16} strokeWidth={1.8} /> },
  { href: "/funis", label: "Funis", icon: <BarChart2 size={16} strokeWidth={1.8} /> },
  { href: "/ferramentas/gerador-links", label: "Links Rastreáveis", icon: <Link2 size={16} strokeWidth={1.8} /> },
  { href: "/ferramentas/campanhas", label: "Configurar Campanha", icon: <Target size={16} strokeWidth={1.8} /> },
  { href: "/jornada", label: "Jornada de Compra", icon: <Kanban size={16} strokeWidth={1.8} /> },
  { href: "/mensagens-rastreaveis", label: "Mensagens Rastreáveis", icon: <MessageCircle size={16} strokeWidth={1.8} /> },
  { href: "/disparos-pixel", label: "Disparos de Pixel", icon: <Target size={16} strokeWidth={1.8} /> },
  { href: "/disparos-webhook", label: "Disparos de Webhook", icon: <Briefcase size={16} strokeWidth={1.8} /> },
  { href: "/performance", label: "Performance", icon: <TrendingUp size={16} strokeWidth={1.8} /> },
  { href: "/configuracoes/integracoes", label: "Integrações", icon: <Plug size={16} strokeWidth={1.8} /> },
  { href: "/configuracoes/usuarios", label: "Acessos", icon: <UserCheck size={16} strokeWidth={1.8} /> },
  { href: "/configuracoes/agencia", label: "Informações", icon: <Settings size={16} strokeWidth={1.8} /> },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const [openMenus, setOpenMenus] = useState<string[]>([]);
  const [allowedModulos, setAllowedModulos] = useState<Set<string> | null>(null);
  const [modulosAgencia, setModulosAgencia] = useState<Set<string> | null>(null);
  const [permLoaded, setPermLoaded] = useState(false);
  const [agenciaInfo, setAgenciaInfo] = useState<{ nome: string; isFilha: boolean } | null>(null);
  const [perfil, setPerfil] = useState<{ nome: string; papel: string } | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const [pill, setPill] = useState<{ top: number; height: number; on: boolean }>({ top: 0, height: 38, on: false });

  useEffect(() => {
    async function loadPermissions() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) { setPermLoaded(true); return; }

        const agenciaId = typeof window !== "undefined" ? sessionStorage.getItem("agencia_selecionada") : null;
        const url = agenciaId ? `/api/permissoes?agencia_id=${agenciaId}` : "/api/permissoes";
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const { permissoes, modulos_agencia } = await res.json();
        if (permissoes) setAllowedModulos(new Set<string>(permissoes));
        if (modulos_agencia) setModulosAgencia(new Set<string>(modulos_agencia));

        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: usuarios } = await supabase
              .from("usuarios")
              .select("agencia_id, nome")
              .eq("auth_user_id", user.id)
              .limit(1);
            let nomeUsuario: string = (usuarios as any[] | null)?.[0]?.nome || "";
            if (!nomeUsuario && user.email) {
              const { data: porEmail } = await supabase.from("usuarios").select("nome").eq("email", user.email).limit(1);
              nomeUsuario = (porEmail as any[] | null)?.[0]?.nome || "";
            }
            if (/\d/.test(nomeUsuario)) nomeUsuario = "";
            setPerfil({ nome: nomeUsuario || (user.email || "").split("@")[0], papel: permissoes ? "Equipe" : "Administrador" });
            const agId = agenciaId || usuarios?.[0]?.agencia_id;
            if (agId) {
              const { data: ag } = await supabase
                .from("agencias")
                .select("nome, parent_id")
                .eq("id", agId)
                .single();
              if (ag) setAgenciaInfo({ nome: ag.nome, isFilha: !!ag.parent_id });
            }
          }
        } catch {}
      } catch {
        // on error, show all items
      } finally {
        setPermLoaded(true);
      }
    }
    loadPermissions();
  }, []);

  const toggleMenu = (label: string) => {
    setOpenMenus((prev) =>
      prev.includes(label) ? prev.filter((m) => m !== label) : [...prev, label]
    );
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    // endereço exato ou subpágina — "/reunioes" não pode marcar "/reunioes-vendas"
    return pathname === href || pathname.startsWith(href + "/");
  };

  const isFilha = agenciaInfo?.isFilha ?? false;

  // Destaque que desliza até o item ativo
  useLayoutEffect(() => {
    const medir = () => {
      const nav = navRef.current;
      const el = nav?.querySelector<HTMLElement>(".nav-item.is-active");
      if (!nav || !el) { setPill(p => ({ ...p, on: false })); return; }
      // posição real na tela (offsetTop erra enquanto os grupos animam a entrada)
      const top = el.getBoundingClientRect().top - nav.getBoundingClientRect().top + nav.scrollTop;
      setPill({ top, height: el.offsetHeight, on: true });
    };
    medir();
    const t = setTimeout(medir, 700);
    const nav = navRef.current;
    nav?.addEventListener("animationend", medir);
    window.addEventListener("resize", medir);
    return () => {
      clearTimeout(t);
      nav?.removeEventListener("animationend", medir);
      window.removeEventListener("resize", medir);
    };
  }, [pathname, permLoaded, allowedModulos, modulosAgencia, isFilha]);

  const isModuloAllowed = (key: string) => {
    if (allowedModulos && !allowedModulos.has(key)) return false;
    if (modulosAgencia && !modulosAgencia.has(key)) return false;
    return true;
  };

  const handleSair = async () => {
    sessionStorage.removeItem("agencia_selecionada");
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  // ─── Render flat item (cliente menu) ─────────────────────────
  const itemLink = (key: string, href: string, active: boolean, icon: React.ReactNode, label: string) => (
    <Link
      key={key}
      href={href}
      onClick={onMobileClose}
      className={`nav-item${active ? " is-active" : ""}`}
      aria-current={active ? "page" : undefined}
    >
      <span className="nav-ic">{icon}</span>
      <span className="nav-tx">{label}</span>
    </Link>
  );

  const renderFlatItem = (item: NavItem) =>
    itemLink(item.href!, item.href!, isActive(item.href!), item.icon, item.label);

  // ─── Área com várias telas: uma entrada só; as telas viram abas (SubNav) ───
  const renderExpandableItem = (item: NavItem) => {
    const filhos = item.children!.filter((child) => {
      if ((!allowedModulos && !modulosAgencia) || !child.href) return true;
      const moduloKey = hrefToModuloKey[child.href];
      if (!moduloKey) return true;
      return isModuloAllowed(moduloKey);
    });
    const destino = filhos.find((c) => c.href)?.href || item.children!.find((c) => c.href)?.href || "/";
    const active = !!item.children?.some((c) =>
      c.href ? isActive(c.href) : c.children?.some(sc => isActive(sc.href))
    ) || (item.label === "Configurações" && pathname.startsWith("/configuracoes"));
    return itemLink(item.label, destino, active, item.icon, item.label);
  };

  // ─── Render master item (href or expandable) ─────────────────
  const renderMasterItem = (item: NavItem) => {
    if (item.children) return renderExpandableItem(item);
    return itemLink(item.href!, item.href!, isActive(item.href!), item.icon, item.label);
  };

  // ─── Filter master groups ────────────────────────────────────
  const filterMasterGroups = (groups: NavGroup[]): NavGroup[] => {
    return groups.map(group => ({
      ...group,
      items: group.items.filter((item) => {
        if (item.href === "/") {
          return allowedModulos === null && modulosAgencia === null;
        }
        if (item.label === "Clientes SaaS" || item.label === "Finanças") {
          return !modulosAgencia && !allowedModulos;
        }
        if (!allowedModulos && !modulosAgencia) return true;
        if (item.label === "Configurações" || item.href?.startsWith("/configuracoes")) {
          return isModuloAllowed("configuracoes");
        }
        const childKeys = groupChildKeys[item.label];
        if (childKeys) return childKeys.some((k) => isModuloAllowed(k));
        const href = item.href;
        if (!href) return true;
        const moduloKey = hrefToModuloKey[href];
        if (!moduloKey) return true;
        return isModuloAllowed(moduloKey);
      }),
    })).filter(g => g.items.length > 0);
  };

  const iniciais = (perfil?.nome || "S").trim().split(/\s+/).slice(0, 2).map(p => p[0]).join("").toUpperCase();

  const sidebarContent = (
    <>
      {/* Marca */}
      <div className="sb-brand">
        <img
          src="/logo-salx.png"
          alt=""
          className="sb-logo"
          onError={e => { (e.target as HTMLImageElement).src = "/logo.png"; }}
        />
        <div className="sb-brand-tx">
          <span className="sb-brand-nome">SALX Convert</span>
          <span className="sb-brand-sub">{agenciaInfo?.isFilha ? agenciaInfo.nome : "Acelerador de vendas"}</span>
        </div>
      </div>

      {/* Navegação */}
      <nav ref={navRef} className="sb-nav">
        <span
          className="sb-pill"
          aria-hidden
          style={{ transform: `translateY(${pill.top}px)`, height: pill.height, opacity: pill.on ? 1 : 0 }}
        />
        {!permLoaded ? null : isFilha ? (
          <div className="sb-grupo">{navItemsCliente.map(renderFlatItem)}</div>
        ) : (
          filterMasterGroups(masterGroups).map(group => (
            <div key={group.group || "_standalone"} className="sb-grupo">
              {group.group && <div className="sb-grupo-nome">{group.group}</div>}
              {group.items.map(renderMasterItem)}
            </div>
          ))
        )}
      </nav>

      {/* Rodapé: quem está logado */}
      <div className="sb-rodape">
        <div className="sb-avatar" aria-hidden>{iniciais}</div>
        <div className="sb-user">
          <span className="sb-user-nome">{perfil?.nome || "\u00A0"}</span>
          <span className="sb-user-papel">{perfil?.papel || "\u00A0"}</span>
        </div>
        <button onClick={handleSair} className="sb-sair" title="Sair" aria-label="Sair">
          <LogOut size={16} strokeWidth={1.8} />
        </button>
      </div>
    </>
  );

  const sidebarStyle: React.CSSProperties = {
    width: "248px",
    minWidth: "248px",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="sb"
        style={{
          position: "fixed",
          left: "20px",
          top: "20px",
          bottom: "20px",
          zIndex: 50,
          ...sidebarStyle,
        }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="sb-veu"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "rgba(10,24,38,0.5)",
            display: "flex",
          }}
          onClick={onMobileClose}
        >
          <aside
            className="sb sb-drawer"
            style={{
              ...sidebarStyle,
              position: "relative",
              borderRadius: "0 24px 24px 0",
              height: "100%",
            }}
            onClick={e => e.stopPropagation()}
          >
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
