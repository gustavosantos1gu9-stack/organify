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
  // Modo sem login — retorna agência fixa
  const AGENCIA_ID = "32cdce6e-4664-4ac6-979d-6d68a1a68745";
  
  try {
    const user = await getUser();
    if (!user) return AGENCIA_ID;
    const { data } = await supabase
      .from("usuarios")
      .select("agencia_id")
      .eq("auth_user_id", user.id)
      .single();
    return data?.agencia_id ?? AGENCIA_ID;
  } catch {
    return AGENCIA_ID;
  }
}
