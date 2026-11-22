"use client";

import { useEffect, useState } from "react";
import { supabase, getAgenciaId } from "@/lib/supabase";
import InicioDono from "@/components/inicio/InicioDono";
import InicioEquipe from "@/components/inicio/InicioEquipe";
import InicioFilha from "@/components/inicio/InicioFilha";
import { Carregando } from "@/components/inicio/ui";

type Modo =
  | { tipo: "carregando" }
  | { tipo: "filha" }
  | { tipo: "dono"; nome: string }
  | { tipo: "equipe"; nome: string; permissoes: Set<string> };

// Escolhe o Início certo para quem está logado:
// agência filha → resultados da filha; dono/admin (sem restrição) → visão completa;
// equipe (permissões do time) → os próprios clientes, sem números financeiros.
export default function InicioPage() {
  const [modo, setModo] = useState<Modo>({ tipo: "carregando" });

  useEffect(() => {
    (async () => {
      const agId = await getAgenciaId();
      if (agId) {
        const { data: ag } = await supabase.from("agencias").select("parent_id").eq("id", agId).single();
        if ((ag as any)?.parent_id) { setModo({ tipo: "filha" }); return; }
      }

      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      let nome = (user?.user_metadata?.nome || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "") as string;
      if (user) {
        const { data: linhas } = await supabase.from("usuarios").select("nome").eq("auth_user_id", user.id).limit(1);
        const n = (linhas as any[] | null)?.[0]?.nome;
        if (n) nome = n;
      }
      nome = nome ? nome.charAt(0).toUpperCase() + nome.slice(1) : "";

      let permissoes: string[] | null = null;
      try {
        const selecionada = typeof window !== "undefined" ? sessionStorage.getItem("agencia_selecionada") : null;
        const res = await fetch(selecionada ? `/api/permissoes?agencia_id=${selecionada}` : "/api/permissoes", {
          headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
        });
        permissoes = (await res.json())?.permissoes ?? null;
      } catch {
        // Na dúvida, mostra a versão sem números financeiros
        permissoes = [];
      }

      if (permissoes === null) setModo({ tipo: "dono", nome: nome.split(" ")[0] });
      else setModo({ tipo: "equipe", nome, permissoes: new Set(permissoes) });
    })();
  }, []);

  if (modo.tipo === "carregando") return <div className="ui-page"><Carregando /></div>;
  if (modo.tipo === "filha") return <InicioFilha />;
  if (modo.tipo === "dono") return <InicioDono nome={modo.nome} />;
  return <InicioEquipe nome={modo.nome} permissoes={modo.permissoes} />;
}
