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
  "/configuracoes": "configuracoes",
  "/configuracoes/times": "configuracoes",
  "/configuracoes/usuarios": "configuracoes",
  "/configuracoes/agencia": "configuracoes",
  "/configuracoes/integracoes": "configuracoes",
};

// Ordem de prioridade pra redirecionar ao primeiro módulo permitido
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
  const [permitido, setPermitido] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/login"); return; }
      setChecando(false);

      // Verificar permissão da página atual
      fetch("/api/permissoes", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then(r => r.json())
        .then(({ permissoes }) => {
          if (!permissoes) return; // admin, acesso total
          const allowed = new Set<string>(permissoes);
          const moduloKey = hrefToModuloKey[pathname];

          // Se a rota não está mapeada (ex: /perfil), permite
          if (!moduloKey) return;

          if (!allowed.has(moduloKey)) {
            setPermitido(false);
            // Redirecionar pra primeira rota permitida
            const destino = rotasPrioridade.find(r => {
              const k = hrefToModuloKey[r];
              return k && allowed.has(k);
            });
            router.push(destino || "/perfil");
          }
        })
        .catch(() => {});
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) router.push("/login");
    });

    return () => subscription.unsubscribe();
  }, [pathname]);

  if (checando || !permitido) return (
    <div style={{ minHeight:"100vh", background:"#0f0f0f", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ width:"40px", height:"40px", borderRadius:"50%", border:"3px solid #2e2e2e", borderTop:"3px solid #22c55e", animation:"spin 1s linear infinite" }}/>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:"#0f0f0f" }}>
      <Sidebar />
      <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0 }}>
        <Topbar />
        <main style={{ flex:1, padding:"28px 32px", overflowX:"hidden" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
