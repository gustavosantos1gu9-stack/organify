"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  UserPlus,
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
} from "lucide-react";

interface NavItem {
  href?: string;
  label: string;
  icon: React.ReactNode;
  children?: { href: string; label: string }[];
}

const navItems: NavItem[] = [
  { href: "/", label: "Início", icon: <LayoutDashboard size={16} /> },
  { href: "/clientes", label: "Clientes", icon: <Users size={16} /> },
  { href: "/crm", label: "CRM", icon: <CreditCard size={16} /> },
  { href: "/gerador-leads", label: "Gerador de Leads", icon: <UserPlus size={16} /> },
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
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                width: "28px",
                height: "28px",
                background: "#22c55e",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: "14px", fontWeight: "800", color: "#000" }}>O</span>
            </div>
            <span style={{ fontWeight: "700", fontSize: "15px", color: "#f0f0f0" }}>
              ORGANIFY
            </span>
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
            const hasActiveChild = item.children.some((c) => isActive(c.href));
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
                    <span style={{ color: hasActiveChild ? "#22c55e" : undefined, flexShrink: 0 }}>
                      {item.icon}
                    </span>
                    {!collapsed && <span>{item.label}</span>}
                  </div>
                  {!collapsed && (
                    <ChevronDown
                      size={12}
                      style={{
                        transform: isOpen ? "rotate(180deg)" : "rotate(0)",
                        transition: "transform 0.2s",
                        color: "#606060",
                      }}
                    />
                  )}
                </button>
                {!collapsed && isOpen && (
                  <div style={{ marginLeft: "26px", marginTop: "2px", display: "flex", flexDirection: "column", gap: "1px" }}>
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        style={{
                          display: "block",
                          padding: "7px 12px",
                          borderRadius: "6px",
                          fontSize: "13px",
                          color: isActive(child.href) ? "#f0f0f0" : "#707070",
                          background: isActive(child.href) ? "#22c55e15" : "transparent",
                          textDecoration: "none",
                          borderLeft: isActive(child.href) ? "2px solid #22c55e" : "2px solid transparent",
                          transition: "all 0.15s",
                        }}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href!}
              className={`sidebar-item ${isActive(item.href!) ? "active" : ""}`}
              style={{
                justifyContent: collapsed ? "center" : undefined,
                padding: collapsed ? "9px" : undefined,
              }}
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
