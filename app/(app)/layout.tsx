"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import { supabase } from "@/lib/hooks";

const hrefToModuloKey: Record<string, string> = {
  "/": "inicio",
  "/clientes": "clientes",
  "/inbox": "inbox",
  "/crm": "crm",
  "/crm/dashboard": "crm",
  "/inbox/dashboard": "inbox",
  "/secretaria-ia": "secretaria_ia",
  "/funis": "funis",
  "/relatorios-meta": "relatorios_meta",
  "/relatorios-meta/conexoes": "relatorios_conexoes",
  "/relatorios-meta/alertas": "relatorios_alertas",
  "/controle-clientes": "controle_clientes",
  "/cadastros": "cadastros",
  "/reunioes": "reunioes",
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
  "/configuracoes": "configuracoes",
  "/configuracoes/times": "configuracoes",
  "/configuracoes/usuarios": "configuracoes",
  "/configuracoes/agencia": "configuracoes",
  "/configuracoes/integracoes": "configuracoes",
  "/clientes-saas": "clientes_saas",
  "/mensagens-rastreaveis": "mensagens_rastreaveis",
  "/disparos-pixel": "disparos_pixel",
  "/disparos-webhook": "disparos_webhook",
};

const rotasPrioridade = [
  "/inbox", "/crm", "/clientes", "/controle-clientes", "/cadastros",
  "/relatorios-meta", "/dre", "/financeiro/movimentacoes",
  "/financeiro/lancamentos-futuros", "/financeiro/recorrencias",
  "/reunioes", "/jornada", "/configuracoes",
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checando, setChecando] = useState(true);
  const [redirecionando, setRedirecionando] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function verificar() {
      let session = null;
      if (typeof window !== "undefined" && window.location.hash.includes("access_token")) {
        const hash = window.location.hash;

        if (hash.includes("type=recovery")) {
          router.push("/nova-senha" + hash);
          return;
        }

        session = await new Promise<any>(resolve => {
          const timer = setTimeout(() => resolve(null), 3000);
          const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
            if (s) { clearTimeout(timer); subscription.unsubscribe(); resolve(s); }
          });
          supabase.auth.getSession().then(({ data }) => {
            if (data.session) { clearTimeout(timer); subscription.unsubscribe(); resolve(data.session); }
          });
        });
      } else {
        const { data } = await supabase.auth.getSession();
        session = data.session;
      }

      if (!session) { router.push("/login"); return; }

      if (cancelled) return;
      setChecando(false);
      setRedirecionando(false);

      try {
        const agenciaId = typeof window !== "undefined" ? sessionStorage.getItem("agencia_selecionada") : null;
        const permUrl = agenciaId ? `/api/permissoes?agencia_id=${agenciaId}` : "/api/permissoes";
        const res = await fetch(permUrl, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const { permissoes, modulos_agencia } = await res.json();

        if (cancelled) return;

        if (!permissoes) return;

        const allowedPerms = new Set<string>(permissoes);
        const moduloKey = hrefToModuloKey[pathname];

        if (!moduloKey) return;

        const blocked = !allowedPerms.has(moduloKey);

        if (blocked) {
          setRedirecionando(true);
          const destino = rotasPrioridade.find(r => {
            const k = hrefToModuloKey[r];
            return k && allowedPerms.has(k);
          });
          router.replace(destino || "/perfil");
        }
      } catch {}
    }

    verificar();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") { router.push("/nova-senha"); return; }
      if (!session) router.push("/login");
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [pathname]);

  if (checando || redirecionando) return (
    <div style={{ minHeight: "100vh", background: "var(--off-white)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "40px", height: "40px", borderRadius: "50%", border: "3px solid var(--border)", borderTop: "3px solid var(--brand)", animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--off-white)" }}>
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div className="app-shell-content" style={{ flex: 1, marginLeft: "280px", display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Topbar onMenuToggle={() => setMobileOpen(true)} />
        <main className="app-main" style={{ flex: 1, padding: "28px 40px 48px", overflowX: "hidden" }}>
          {children}
        </main>
      </div>
      <style>{`
        @media (max-width: 768px) {
          .topbar-hamburger { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
