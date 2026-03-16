import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    const agencias = await supabase.from("agencias").select("id").limit(1).single();
    return agencias.data?.id ?? null;
  }
  const { data } = await supabase
    .from("usuarios")
    .select("agencia_id")
    .eq("auth_user_id", session.user.id)
    .single();
  if (data?.agencia_id) return data.agencia_id;
  const agencias = await supabase.from("agencias").select("id").limit(1).single();
  return agencias.data?.id ?? null;
}
