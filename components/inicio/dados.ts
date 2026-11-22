import { supabase } from "@/lib/supabase";

export interface ClienteCarteira {
  id: string;
  nome: string;
  status: string | null;
  gestor: string | null;
  consultor: string | null;
  sdr: string | null;
  head_squad: string | null;
  escala_jornada: string | null;
  uti: boolean | null;
  data_entrada: string | null;
  data_churn: string | null;
}

export function inicioDoMes() {
  const h = new Date();
  return new Date(h.getFullYear(), h.getMonth(), 1).toISOString().split("T")[0];
}

/** Carteira da agência (e das filhas, como nas Escalas). Só leitura. */
export async function carregarCarteira(agId: string): Promise<ClienteCarteira[]> {
  const { data: filhas } = await supabase.from("agencias").select("id").eq("parent_id", agId);
  const ids = [agId, ...((filhas as { id: string }[] | null)?.map((f) => f.id) ?? [])];
  const { data } = await supabase
    .from("controle_clientes")
    .select("id, nome, status, gestor, consultor, sdr, head_squad, escala_jornada, uti, data_entrada, data_churn")
    .in("agencia_id", ids)
    .order("nome", { ascending: true });
  return (data as ClienteCarteira[] | null) ?? [];
}

export function contarFases(lista: ClienteCarteira[]) {
  const contagem: Record<string, number> = {};
  let semFase = 0;
  lista.forEach((c) => {
    if (c.escala_jornada) contagem[c.escala_jornada] = (contagem[c.escala_jornada] || 0) + 1;
    else semFase++;
  });
  return { contagem, semFase };
}

/** Conversas novas no período (contagem no banco, sem baixar as linhas). */
export async function contarConversas(agId: string, desde: string) {
  const base = () => supabase.from("conversas").select("id", { count: "exact", head: true }).eq("agencia_id", agId).gte("created_at", desde);
  const [{ count: total }, { count: naoRastreadas }, { count: semOrigem }] = await Promise.all([
    base(),
    base().eq("origem", "Não Rastreada"),
    base().is("origem", null),
  ]);
  const t = total ?? 0;
  const nr = (naoRastreadas ?? 0) + (semOrigem ?? 0);
  return { total: t, rastreadas: Math.max(0, t - nr), naoRastreadas: nr };
}
