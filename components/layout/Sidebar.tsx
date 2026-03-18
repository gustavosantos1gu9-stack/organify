"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  UserPlus,
  UserMinus,
  BarChart3,
  Target,
  Sparkles,
  DollarSign,
  GraduationCap,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Wallet,
  Calendar,
  RefreshCw,
  Building2,
  Plug,
  Tag,
  MapPin,
  Landmark,
  Truck,
  UserCog,
  Users2,
  Link2,
  MessageCircle,
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

const navItems: NavItem[] = [
  { href: "/", label: "Início", icon: <LayoutDashboard size={16} /> },
  { href: "/clientes", label: "Clientes", icon: <Users size={16} /> },
  { href: "/inbox", label: "Inbox WhatsApp", icon: <MessageCircle size={16} /> },
  { href: "/crm", label: "CRM", icon: <CreditCard size={16} /> },
  { href: "/gerador-de-leads", label: "Churn", icon: <UserMinus size={16} /> },
  { href: "/ferramentas/gerador-links", label: "Links & Campanhas", icon: <Link2 size={16} /> },
  { href: "/ferramentas/campanhas", label: "Configurar Campanha", icon: <Target size={16} /> },
  { href: "/jornada", label: "Jornada de Compra", icon: <Target size={16} /> },
  { href: "/dre", label: "DRE", icon: <BarChart3 size={16} /> },
  { href: "/metas", label: "Metas", icon: <Target size={16} /> },
  { href: "/vivian-ia", label: "Vivian IA", icon: <Sparkles size={16} /> },
  {
    label: "Financeiro",
    icon: <DollarSign size={16} />,
    children: [
      { href: "/financeiro/lancamentos-futuros", label: "Lançamentos futuros" },
      { href: "/financeiro/movimentacoes", label: "Movimentações" },
      { href: "/financeiro/recorrencias", label: "Recorrências" },
    ],
  },
  { href: "/universidade", label: "Universidade", icon: <GraduationCap size={16} /> },
  {
    label: "Configurações",
    icon: <Settings size={16} />,
    children: [
      { href: "/configuracoes/agencia", label: "Agência" },
      { href: "/configuracoes/integracoes", label: "Integrações" },
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

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [openMenus, setOpenMenus] = useState<string[]>(["Financeiro", "Configurações"]);

  const toggleMenu = (label: string) => {
    setOpenMenus((prev) =>
      prev.includes(label) ? prev.filter((m) => m !== label) : [...prev, label]
    );
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
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
            <img src="/logo.png" alt="SALX Convert" style={{ width: "36px", height: "36px", objectFit: "contain", flexShrink: 0 }}/>
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
              <span style={{ fontWeight: "800", fontSize: "16px", color: "#f0f0f0", letterSpacing: "-0.3px" }}>
                SALX <span style={{ color: "#29ABE2" }}>Convert</span>
              </span>
              <span style={{ fontSize: "10px", color: "#606060", textAlign: "center", letterSpacing: "0.05em", marginTop: "2px" }}>
                gestão de agências
              </span>
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
        {navItems.map((item) => {
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
                    {item.children.map((child) => {
                      // Subgrupo com filhos (ex: Clientes, Financeiro dentro de Configurações)
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
                      // Item simples
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

          return (
            <Link key={item.href} href={item.href!}
              className={`sidebar-item ${isActive(item.href!) ? "active" : ""}`}
              style={{ justifyContent: collapsed ? "center" : undefined, padding: collapsed ? "9px" : undefined }}
              title={collapsed ? item.label : undefined}
            >
              <span style={{ flexShrink: 0 }}>{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
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
