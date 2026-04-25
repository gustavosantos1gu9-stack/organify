import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getUser() {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getAgenciaId(): Promise<string | null> {
  try {
    const user = await getUser();
    if (!user) return null;

    // Se é admin (dono) e tem agência selecionada no sessionStorage, usar essa
    if (typeof window !== "undefined") {
      const selecionada = sessionStorage.getItem("agencia_selecionada");
      if (selecionada) return selecionada;
    }

    // Buscar agência pelo auth_user_id
    const { data } = await supabase
      .from("usuarios")
      .select("agencia_id")
      .eq("auth_user_id", user.id)
      .limit(1);

    const agId = data?.[0]?.agencia_id;
    if (agId) {
      // Salvar no sessionStorage pra não precisar buscar de novo
      if (typeof window !== "undefined") {
        sessionStorage.setItem("agencia_selecionada", agId);
      }
      return agId;
    }

    // Fallback: se não achou no usuarios (dono/admin), buscar agência raiz
    const { data: agRaiz } = await supabase
      .from("agencias")
      .select("id")
      .is("parent_id", null)
      .limit(1);

    const raizId = agRaiz?.[0]?.id;
    if (raizId && typeof window !== "undefined") {
      sessionStorage.setItem("agencia_selecionada", raizId);
    }
    return raizId ?? null;
  } catch {
    return null;
  }
}
