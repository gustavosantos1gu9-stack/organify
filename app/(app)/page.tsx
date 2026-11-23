"use client";

import { useEffect, useState } from "react";
import { supabase, getAgenciaId, carregarPermissoes } from "@/lib/supabase";
import InicioDono from "@/components/inicio/InicioDono";
import dynamic from "next/dynamic";
// Só baixa o Início da equipe ou da agência filha (que tem gráficos) para quem usa
const InicioEquipe = dynamic(() => import("@/components/inicio/InicioEquipe"), { ssr: false, loading: () => <div className="ui-page"><Carregando /></div> });
const InicioFilha = dynamic(() => import("@/components/inicio/InicioFilha"), { ssr: false, loading: () => <div className="ui-page"><Carregando /></div> });
import { Carregando } from "@/components/inicio/ui";

type Modo =
  | { tipo: "carregando" }
  | { tipo: "filha" }
  | { tipo: "dono"; nome: string }
  | { tipo: "equipe"; nome: string; permissoes: Set<string> };

// Escolhe o Início certo para quem está logado:
// agência filha → resultados da filha; dono/admin (sem restrição) → visão completa;
// equipe (permissões do time) → os próprios clientes, sem números financeiros.
const cacheModo = new Map<string, Modo>();

export default function InicioPage() {
  const [modo, setModo] = useState<Modo>({ tipo: "carregando" });

  useEffect(() => {
    // Visita anterior nesta aba: já sabe qual Início mostrar
    const guardado = cacheModo.get(sessionStorage.getItem("agencia_selecionada") || "");
    if (guardado) setModo(guardado);

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      const agId = await getAgenciaId();

      // As quatro buscas saem juntas (antes eram em fila)
      const [agRes, linhasRes, emailRes, permRes] = await Promise.all([
        agId ? supabase.from("agencias").select("parent_id").eq("id", agId).single() : Promise.resolve({ data: null }),
        user ? supabase.from("usuarios").select("nome").eq("auth_user_id", user.id).limit(1) : Promise.resolve({ data: null }),
        user?.email ? supabase.from("usuarios").select("nome").eq("email", user.email).limit(1) : Promise.resolve({ data: null }),
        // Na dúvida, mostra a versão sem números financeiros
        carregarPermissoes().then((r) => r.permissoes).catch(() => [] as string[]),
      ]);

      let novo: Modo;
      if ((agRes as any)?.data?.parent_id) {
        novo = { tipo: "filha" };
      } else {
        let nome = (user?.user_metadata?.nome || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "") as string;
        // Dono sem vínculo por auth: usa o cadastro de usuários pelo e-mail
        const n = ((linhasRes as any)?.data as any[] | null)?.[0]?.nome || ((emailRes as any)?.data as any[] | null)?.[0]?.nome;
        if (n) nome = n;
        // Nome tirado do e-mail (com números) não serve de saudação
        if (/\d/.test(nome)) nome = "";
        nome = nome ? nome.charAt(0).toUpperCase() + nome.slice(1) : "";
        const permissoes = permRes as string[] | null;
        novo = permissoes === null
          ? { tipo: "dono", nome: nome.split(" ")[0] }
          : { tipo: "equipe", nome, permissoes: new Set(permissoes) };
      }
      cacheModo.set(agId || "", novo);
      setModo(novo);
    })();
  }, []);

  if (modo.tipo === "carregando") return <div className="ui-page"><Carregando /></div>;
  if (modo.tipo === "filha") return <InicioFilha />;
  if (modo.tipo === "dono") return <InicioDono nome={modo.nome} />;
  return <InicioEquipe nome={modo.nome} permissoes={modo.permissoes} />;
}
