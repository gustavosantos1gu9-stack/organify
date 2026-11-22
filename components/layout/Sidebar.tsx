"use client";

import { useState, useEffect } from "react";
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
      { href: "/controle-clientes", label: "Carteira", icon: <Users size={16} strokeWidth={1.8} /> },
      {
        label: "Escalas", icon: <ClipboardList size={16} strokeWidth={1.8} />,
        children: [
          { href: "/escala-ester", label: "Carol" },
          { href: "/escala-nicolas", label: "Nicolas" },
          { href: "/escala-lavinia", label: "Lavínia" },
        ],
      },
      { href: "/uti", label: "UTI", icon: <AlertTriangle size={16} strokeWidth={1.8} /> },
      { href: "/cadastros", label: "Cadastros", icon: <FileText size={16} strokeWidth={1.8} /> },
      { href: "/gerador-de-leads", label: "Churn", icon: <UserMinus size={16} strokeWidth={1.8} /> },
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
      {
        label: "Reuniões", icon: <CalendarDays size={16} strokeWidth={1.8} />,
        children: [
          { href: "/reunioes", label: "Agendamentos" },
          { href: "/reunioes-vendas", label: "SDR Dashboard" },
        ],
      },
      { href: "/secretaria-ia", label: "Secretária IA", icon: <Bot size={16} strokeWidth={1.8} /> },
    ],
  },
  {
    group: "TRÁFEGO",
    items: [
      {
        label: "Relatórios Meta", icon: <BarChart3 size={16} strokeWidth={1.8} />,
        children: [
          { href: "/relatorios-meta/dashboard", label: "Dashboard" },
          { href: "/relatorios-meta/alertas", label: "Alertas" },
          { href: "/relatorios-meta", label: "Relatórios" },
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
          { href: "/inicio", label: "Dashboard" },
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
    group: "CONFIGURAÇÕES",
    items: [
      { href: "/configuracoes/integracoes", label: "Integrações", icon: <Plug size={16} strokeWidth={1.8} /> },
      { href: "/configuracoes/whatsapp-contas", label: "WhatsApp", icon: <Smartphone size={16} strokeWidth={1.8} /> },
      { href: "/configuracoes/times", label: "Times", icon: <UserCheck size={16} strokeWidth={1.8} /> },
      { href: "/configuracoes/agencia", label: "Agência", icon: <Building2 size={16} strokeWidth={1.8} /> },
      { href: "/configuracoes/usuarios", label: "Usuários", icon: <Users2 size={16} strokeWidth={1.8} /> },
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
              .select("agencia_id")
              .eq("auth_user_id", user.id)
              .limit(1);
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
    return pathname.startsWith(href);
  };

  const isFilha = agenciaInfo?.isFilha ?? false;

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
  const renderFlatItem = (item: NavItem) => {
    const active = isActive(item.href!);
    return (
      <Link
        key={item.href}
        href={item.href!}
        onClick={onMobileClose}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          height: "36px",
          padding: "0 8px",
          borderRadius: "10px",
          fontSize: "14px",
          fontWeight: active ? "600" : "400",
          color: active ? "var(--navy)" : "#8CC6EC",
          background: active ? "#FFFFFF" : "transparent",
          textDecoration: "none",
          transition: "background 0.15s, color 0.15s",
          cursor: "pointer",
        }}
        onMouseEnter={e => {
          if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.08)";
        }}
        onMouseLeave={e => {
          if (!active) e.currentTarget.style.background = "transparent";
        }}
      >
        <span style={{ flexShrink: 0 }}>{item.icon}</span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
      </Link>
    );
  };

  // ─── Render expandable item (master menu) ────────────────────
  const renderExpandableItem = (item: NavItem) => {
    const isOpen = openMenus.includes(item.label);
    const hasActiveChild = item.children?.some((c) =>
      c.href ? isActive(c.href) : c.children?.some(sc => isActive(sc.href))
    );
    return (
      <div key={item.label}>
        <button
          onClick={() => toggleMenu(item.label)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            height: "36px",
            padding: "0 8px",
            borderRadius: "10px",
            fontSize: "14px",
            fontWeight: hasActiveChild ? "600" : "400",
            color: hasActiveChild ? "#FFFFFF" : "#8CC6EC",
            background: hasActiveChild ? "rgba(255,255,255,0.08)" : "transparent",
            border: "none",
            cursor: "pointer",
            transition: "background 0.15s, color 0.15s",
          }}
          onMouseEnter={e => {
            if (!hasActiveChild) e.currentTarget.style.background = "rgba(255,255,255,0.08)";
          }}
          onMouseLeave={e => {
            if (!hasActiveChild) e.currentTarget.style.background = "transparent";
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ flexShrink: 0 }}>{item.icon}</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
          </div>
          <ChevronDown
            size={12}
            strokeWidth={2}
            style={{
              transform: isOpen ? "rotate(180deg)" : "rotate(0)",
              transition: "transform 0.2s",
              flexShrink: 0,
              color: "#8CC6EC",
            }}
          />
        </button>
        {isOpen && (
          <div style={{ marginLeft: "20px", marginTop: "2px", display: "flex", flexDirection: "column", gap: "1px" }}>
            {item.children!.filter((child) => {
              if ((!allowedModulos && !modulosAgencia) || !child.href) return true;
              const moduloKey = hrefToModuloKey[child.href];
              if (!moduloKey) return true;
              return isModuloAllowed(moduloKey);
            }).map((child) => {
              if (child.children) {
                const subOpen = openMenus.includes(`${item.label}:${child.label}`);
                const hasActiveSub = child.children.some(sc => isActive(sc.href));
                return (
                  <div key={child.label}>
                    <button
                      onClick={() => toggleMenu(`${item.label}:${child.label}`)}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "7px 8px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        cursor: "pointer",
                        background: hasActiveSub ? "rgba(255,255,255,0.08)" : "transparent",
                        border: "none",
                        color: hasActiveSub ? "#FFFFFF" : "#8CC6EC",
                      }}
                    >
                      <span>{child.label}</span>
                      <ChevronDown size={11} style={{ transform: subOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s", color: "#8CC6EC" }} />
                    </button>
                    {subOpen && (
                      <div style={{ marginLeft: "12px", display: "flex", flexDirection: "column", gap: "1px" }}>
                        {child.children.map((sc) => {
                          const scActive = isActive(sc.href);
                          return (
                            <Link key={sc.href} href={sc.href} onClick={onMobileClose} style={{
                              display: "block",
                              padding: "6px 8px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              color: scActive ? "#FFFFFF" : "#8CC6EC",
                              background: scActive ? "rgba(255,255,255,0.1)" : "transparent",
                              textDecoration: "none",
                              borderLeft: scActive ? "2px solid #8CC6EC" : "2px solid transparent",
                            }}>
                              {sc.label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }
              const childActive = isActive(child.href!);
              return (
                <Link key={child.href} href={child.href!} onClick={onMobileClose} style={{
                  display: "block",
                  padding: "7px 8px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: childActive ? "#FFFFFF" : "#8CC6EC",
                  background: childActive ? "rgba(255,255,255,0.1)" : "transparent",
                  textDecoration: "none",
                  borderLeft: childActive ? "2px solid #8CC6EC" : "2px solid transparent",
                  transition: "all 0.15s",
                }}>
                  {child.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ─── Render master item (href or expandable) ─────────────────
  const renderMasterItem = (item: NavItem) => {
    if (item.children) return renderExpandableItem(item);
    const active = isActive(item.href!);
    return (
      <Link
        key={item.href}
        href={item.href!}
        onClick={onMobileClose}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          height: "36px",
          padding: "0 8px",
          borderRadius: "10px",
          fontSize: "14px",
          fontWeight: active ? "600" : "400",
          color: active ? "var(--navy)" : "#8CC6EC",
          background: active ? "#FFFFFF" : "transparent",
          textDecoration: "none",
          transition: "background 0.15s, color 0.15s",
        }}
        onMouseEnter={e => {
          if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.08)";
        }}
        onMouseLeave={e => {
          if (!active) e.currentTarget.style.background = "transparent";
        }}
      >
        <span style={{ flexShrink: 0 }}>{item.icon}</span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
      </Link>
    );
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

  const sidebarContent = (
    <>
      {/* Logo */}
      <div style={{ padding: "20px 20px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img
            src="/logo-salx.png"
            alt="SALX Convert"
            style={{ width: "60px", height: "60px", objectFit: "contain", flexShrink: 0 }}
            onError={e => { (e.target as HTMLImageElement).src = "/logo.png"; }}
          />
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
            <span style={{ fontWeight: "700", fontSize: "15px", color: "#F3F5F7", letterSpacing: "-0.2px" }}>
              SALX Convert
            </span>
            {agenciaInfo?.isFilha ? (
              <span style={{ fontSize: "11px", color: "#8CC6EC", marginTop: "3px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "130px" }}>
                {agenciaInfo.nome}
              </span>
            ) : (
              <span style={{ fontSize: "11px", color: "#8CC6EC", fontWeight: "400", marginTop: "2px" }}>
                Acelerador de vendas
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "0 12px", display: "flex", flexDirection: "column", gap: "2px" }}>
        {!permLoaded ? null : isFilha ? (
          navItemsCliente.map(renderFlatItem)
        ) : (
          filterMasterGroups(masterGroups).map(group => (
            <div key={group.group || "_standalone"}>
              {group.group && (
                <div style={{
                  fontSize: "10px",
                  fontWeight: "600",
                  color: "#8CC6EC",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  padding: "12px 8px 4px",
                }}>
                  {group.group}
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                {group.items.map(renderMasterItem)}
              </div>
            </div>
          ))
        )}
      </nav>

      {/* Footer */}
      <div style={{ padding: "12px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <button
          onClick={handleSair}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            width: "100%",
            height: "36px",
            padding: "0 8px",
            borderRadius: "10px",
            fontSize: "14px",
            color: "#8CC6EC",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            transition: "background 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
        >
          <LogOut size={16} strokeWidth={1.8} style={{ flexShrink: 0 }} />
          <span>Sair</span>
        </button>
      </div>
    </>
  );

  const sidebarStyle: React.CSSProperties = {
    width: "240px",
    minWidth: "240px",
    background: "#0A1826",
    borderRadius: "24px",
    boxShadow: "0 8px 32px rgba(10,24,38,0.18)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside
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
            style={{
              ...sidebarStyle,
              position: "relative",
              borderRadius: "0 24px 24px 0",
              height: "100%",
              transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
              transition: "transform 0.25s ease",
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
