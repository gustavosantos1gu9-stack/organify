"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  UserMinus,
  BarChart3,
  Target,
  DollarSign,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plug,
  Users2,
  Link2,
  MessageCircle,
  ClipboardList,
  CalendarCheck,
  Briefcase,
  Headphones,
  Radar,
  FileBarChart,
  Building2,
  MousePointer,
  Webhook,
  Info,
  UserCheck,
  Mail,
} from "lucide-react";

interface NavItem {
  href?: string;
  label: string;
  icon: React.ReactNode;
  children?: NavChild[];
}

interface NavChild {
  href?: string;
  label: string;
  children?: { href: string; label: string }[];
}

// ─── Menu MASTER (agência SALX) ─────────────────────────────
const navItems: NavItem[] = [
  { href: "/", label: "Início", icon: <LayoutDashboard size={16} /> },
  {
    label: "Financeiro",
    icon: <DollarSign size={16} />,
    children: [
      { href: "/clientes", label: "Clientes" },
      { href: "/dre", label: "DRE" },
      { href: "/financeiro/lancamentos-futuros", label: "Lançamentos futuros" },
      { href: "/financeiro/movimentacoes", label: "Movimentações" },
      { href: "/financeiro/recorrencias", label: "Recorrências" },
    ],
  },
  {
    label: "SDR",
    icon: <Headphones size={16} />,
    children: [
      { href: "/inbox", label: "Inbox WhatsApp" },
      { href: "/inbox/dashboard", label: "Dashboard Inbox" },
      { href: "/crm", label: "CRM" },
    ],
  },
  {
    label: "Relatórios Meta",
    icon: <FileBarChart size={16} />,
    children: [
      { href: "/relatorios-meta", label: "Relatórios" },
      { href: "/relatorios-meta/alertas", label: "Alertas" },
      { href: "/relatorios-meta/conexoes", label: "Conexões" },
    ],
  },
  {
    label: "Operacional",
    icon: <Briefcase size={16} />,
    children: [
      { href: "/controle-clientes", label: "Controle de Clientes" },
      { href: "/cadastros", label: "Cadastros" },
      { href: "/reunioes", label: "Reuniões" },
      { href: "/escala-ester", label: "Escala E." },
      { href: "/escala-nicolas", label: "Escala N." },
      { href: "/gerador-de-leads", label: "Churn" },
    ],
  },
  {
    label: "Rastreamento",
    icon: <Radar size={16} />,
    children: [
      { href: "/ferramentas/gerador-links", label: "Links & Campanhas" },
      { href: "/ferramentas/campanhas", label: "Configurar Campanha" },
      { href: "/jornada", label: "Jornada de Compra" },
    ],
  },
  { href: "/clientes-saas", label: "Clientes SaaS", icon: <Building2 size={16} /> },
  {
    label: "Configurações",
    icon: <Settings size={16} />,
    children: [
      { href: "/configuracoes/agencia", label: "Agência" },
      { href: "/configuracoes/integracoes", label: "Integrações" },
      { href: "/configuracoes/whatsapp-contas", label: "WhatsApp Contas" },
      {
        label: "Clientes",
        children: [
          { href: "/configuracoes/clientes/categorias", label: "Categorias/Tags" },
          { href: "/configuracoes/clientes/origens", label: "Origens" },
        ],
      },
      {
        label: "Financeiro",
        children: [
          { href: "/configuracoes/financeiro/categorias-entrada", label: "Categorias de entrada" },
          { href: "/configuracoes/financeiro/categorias-saida", label: "Categorias de saída" },
        ],
      },
      { href: "/configuracoes/fornecedores", label: "Fornecedores" },
      { href: "/configuracoes/usuarios", label: "Usuários" },
      { href: "/configuracoes/times", label: "Times" },
    ],
  },
];

// ─── Menu CLIENTE (agência filha) — flat, sem grupos ─────────
const navItemsCliente: NavItem[] = [
  { href: "/", label: "Dashboard", icon: <LayoutDashboard size={16} /> },
  { href: "/inbox", label: "Conversas", icon: <MessageCircle size={16} /> },
  { href: "/crm", label: "CRM", icon: <ClipboardList size={16} /> },
  { href: "/ferramentas/gerador-links", label: "Links Rastreáveis", icon: <Link2 size={16} /> },
  { href: "/ferramentas/campanhas", label: "Configurar Campanha", icon: <Target size={16} /> },
  { href: "/jornada", label: "Jornada de Compra", icon: <BarChart3 size={16} /> },
  { href: "/mensagens-rastreaveis", label: "Mensagens Rastreáveis", icon: <Mail size={16} /> },
  { href: "/disparos-pixel", label: "Disparos de Pixel", icon: <MousePointer size={16} /> },
  { href: "/disparos-webhook", label: "Disparos de Webhook", icon: <Webhook size={16} /> },
  { href: "/relatorios-meta", label: "Relatórios", icon: <FileBarChart size={16} /> },
  { href: "/configuracoes/integracoes", label: "Integrações", icon: <Plug size={16} /> },
  { href: "/configuracoes/usuarios", label: "Acessos", icon: <UserCheck size={16} /> },
  { href: "/configuracoes/agencia", label: "Informações", icon: <Info size={16} /> },
];

// Map href → module key for permission filtering
const hrefToModuloKey: Record<string, string> = {
  "/": "inicio",
  "/clientes": "clientes",
  "/inbox": "inbox",
  "/crm": "crm",
  "/relatorios-meta": "relatorios_meta",
  "/relatorios-meta/conexoes": "relatorios_conexoes",
  "/relatorios-meta/alertas": "relatorios_alertas",
  "/controle-clientes": "controle_clientes",
  "/cadastros": "cadastros",
  "/reunioes": "reunioes",
  "/escala-ester": "escala_ester",
  "/escala-nicolas": "escala_nicolas",
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
  SDR: ["inbox", "crm"],
  "Relatórios Meta": ["relatorios_meta", "relatorios_conexoes", "relatorios_alertas"],
  Operacional: ["controle_clientes", "cadastros", "reunioes", "escala_ester", "escala_nicolas", "churn"],
  Rastreamento: ["links_campanhas", "configurar_campanha", "jornada"],
};

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
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
        if (permissoes) {
          setAllowedModulos(new Set<string>(permissoes));
        }
        if (modulos_agencia) {
          setModulosAgencia(new Set<string>(modulos_agencia));
        }

        // Detectar se é agência filha e buscar nome
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: usuario } = await supabase
              .from("usuarios")
              .select("agencia_id")
              .eq("auth_user_id", user.id)
              .single();

            const agId = agenciaId || usuario?.agencia_id;
            if (agId) {
              const { data: ag } = await supabase
                .from("agencias")
                .select("nome, parent_id")
                .eq("id", agId)
                .single();
              if (ag) {
                setAgenciaInfo({ nome: ag.nome, isFilha: !!ag.parent_id });
              }
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

  // ─── Renderizar item flat (usado pelo menu cliente) ────────
  const renderFlatItem = (item: NavItem) => (
    <Link key={item.href} href={item.href!}
      className={`sidebar-item ${isActive(item.href!) ? "active" : ""}`}
      style={{ justifyContent: collapsed ? "center" : undefined, padding: collapsed ? "9px" : undefined }}
      title={collapsed ? item.label : undefined}
    >
      <span style={{ flexShrink: 0 }}>{item.icon}</span>
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );

  // ─── Filtrar itens do master ───────────────────────────────
  const filterMasterItems = (items: NavItem[]) => items.filter((item) => {
    const isModuloAllowed = (key: string) => {
      if (allowedModulos && !allowedModulos.has(key)) return false;
      if (modulosAgencia && !modulosAgencia.has(key)) return false;
      return true;
    };

    if (item.label === "Clientes SaaS") {
      return !modulosAgencia && !allowedModulos;
    }

    if (!allowedModulos && !modulosAgencia) return true;

    if (item.label === "Configurações") {
      return isModuloAllowed("configuracoes");
    }

    const childKeys = groupChildKeys[item.label];
    if (childKeys) {
      return childKeys.some((k) => isModuloAllowed(k));
    }

    const href = item.href;
    if (!href) return true;
    const moduloKey = hrefToModuloKey[href];
    if (!moduloKey) return true;
    return isModuloAllowed(moduloKey);
  });

  // ─── Renderizar item do master (com suporte a groups) ──────
  const renderMasterItem = (item: NavItem) => {
    if (item.children) {
      const isOpen = openMenus.includes(item.label);
      const hasActiveChild = item.children.some((c) =>
        c.href ? isActive(c.href) : c.children?.some(sc => isActive(sc.href))
      );
      return (
        <div key={item.label}>
          <button
            onClick={() => !collapsed && toggleMenu(item.label)}
            className="sidebar-item"
            style={{
              color: hasActiveChild ? "#f0f0f0" : undefined,
              background: hasActiveChild ? "#2a2a2a" : undefined,
              justifyContent: collapsed ? "center" : "space-between",
              padding: collapsed ? "9px" : undefined,
            }}
            title={collapsed ? item.label : undefined}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ color: hasActiveChild ? "#29ABE2" : undefined, flexShrink: 0 }}>
                {item.icon}
              </span>
              {!collapsed && <span>{item.label}</span>}
            </div>
            {!collapsed && (
              <ChevronDown size={12} style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s", color: "#606060" }} />
            )}
          </button>
          {!collapsed && isOpen && (
            <div style={{ marginLeft: "26px", marginTop: "2px", display: "flex", flexDirection: "column", gap: "1px" }}>
              {item.children.filter((child) => {
                if ((!allowedModulos && !modulosAgencia) || !child.href) return true;
                const moduloKey = hrefToModuloKey[child.href];
                if (!moduloKey) return true;
                if (allowedModulos && !allowedModulos.has(moduloKey)) return false;
                if (modulosAgencia && !modulosAgencia.has(moduloKey)) return false;
                return true;
              }).map((child) => {
                if (child.children) {
                  const subOpen = openMenus.includes(`${item.label}:${child.label}`);
                  const hasActiveSub = child.children.some(sc => isActive(sc.href));
                  return (
                    <div key={child.label}>
                      <button
                        onClick={() => toggleMenu(`${item.label}:${child.label}`)}
                        style={{
                          width: "100%", display: "flex", alignItems: "center",
                          justifyContent: "space-between", padding: "7px 12px",
                          borderRadius: "6px", fontSize: "13px", cursor: "pointer",
                          background: hasActiveSub ? "#29ABE210" : "transparent",
                          border: "none",
                          color: hasActiveSub ? "#f0f0f0" : "#707070",
                        }}
                      >
                        <span>{child.label}</span>
                        <ChevronDown size={11} style={{ transform: subOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s", color: "#505050" }}/>
                      </button>
                      {subOpen && (
                        <div style={{ marginLeft: "12px", display: "flex", flexDirection: "column", gap: "1px" }}>
                          {child.children.map((sc) => (
                            <Link key={sc.href} href={sc.href} style={{
                              display: "block", padding: "6px 12px", borderRadius: "6px",
                              fontSize: "12px",
                              color: isActive(sc.href) ? "#f0f0f0" : "#606060",
                              background: isActive(sc.href) ? "#29ABE215" : "transparent",
                              textDecoration: "none",
                              borderLeft: isActive(sc.href) ? "2px solid #29ABE2" : "2px solid transparent",
                            }}>
                              {sc.label}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }
                return (
                  <Link key={child.href} href={child.href!} style={{
                    display: "block", padding: "7px 12px", borderRadius: "6px",
                    fontSize: "13px",
                    color: isActive(child.href!) ? "#f0f0f0" : "#707070",
                    background: isActive(child.href!) ? "#29ABE215" : "transparent",
                    textDecoration: "none",
                    borderLeft: isActive(child.href!) ? "2px solid #29ABE2" : "2px solid transparent",
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
    }

    return renderFlatItem(item);
  };

  return (
    <aside
      style={{
        width: collapsed ? "60px" : "220px",
        minWidth: collapsed ? "60px" : "220px",
        background: "#141414",
        borderRight: "1px solid #2e2e2e",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        position: "sticky",
        top: 0,
        transition: "width 0.2s ease, min-width 0.2s ease",
        overflow: "hidden",
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: "16px 14px",
          borderBottom: "1px solid #2e2e2e",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          minHeight: "60px",
        }}
      >
        {!collapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <img src="/logo.png" alt="SALX Convert" style={{ width: "44px", height: "44px", objectFit: "contain", flexShrink: 0 }}/>
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
              <span style={{ fontWeight: "800", fontSize: "16px", color: "#f0f0f0", letterSpacing: "-0.3px" }}>
                SALX <span style={{ color: "#29ABE2" }}>Convert</span>
              </span>
              {isFilha ? (
                <span style={{ fontSize: "10px", color: "#29ABE2", marginTop: "3px", letterSpacing: "0.03em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "120px" }}>
                  {agenciaInfo!.nome}
                </span>
              ) : (
                <span style={{ fontSize: "10px", color: "#606060", textAlign: "center", letterSpacing: "0.05em", marginTop: "2px" }}>
                  acelerador de vendas
                </span>
              )}
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            background: "#2a2a2a",
            border: "1px solid #3a3a3a",
            borderRadius: "6px",
            width: "24px",
            height: "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "#a0a0a0",
            flexShrink: 0,
            marginLeft: collapsed ? "auto" : "0",
          }}
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </div>

      {/* Nav */}
      <nav
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "8px",
          display: "flex",
          flexDirection: "column",
          gap: "2px",
        }}
      >
        {!permLoaded ? null : isFilha ? (
          // ─── Menu CLIENTE: flat, sem grupos ─────────
          navItemsCliente.map(renderFlatItem)
        ) : (
          // ─── Menu MASTER: com grupos colapsáveis ────
          filterMasterItems(navItems).map(renderMasterItem)
        )}
      </nav>

      {/* Sair */}
      <div style={{ padding: "8px", borderTop: "1px solid #2e2e2e" }}>
        <button
          className="sidebar-item"
          style={{
            color: "#606060",
            justifyContent: collapsed ? "center" : undefined,
            padding: collapsed ? "9px" : undefined,
          }}
          title={collapsed ? "Sair" : undefined}
        >
          <LogOut size={16} style={{ flexShrink: 0 }} />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
}
