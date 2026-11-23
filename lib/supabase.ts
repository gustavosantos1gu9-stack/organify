import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── Velocidade: "quem está logado?" uma vez só ──────────────────────────────
// auth.getUser() vai ao servidor do Supabase a cada chamada (eram ~11 por página).
// No navegador, o usuário já está na sessão salva localmente: usamos ela e guardamos
// a resposta por alguns minutos. Com token explícito (uso em servidor) segue o original.
if (typeof window !== "undefined") {
  const auth = supabase.auth as any;
  const getUserOriginal = auth.getUser.bind(auth);
  let cacheUser: { p: Promise<any>; t: number } | null = null;
  auth.getUser = (jwt?: string) => {
    if (jwt) return getUserOriginal(jwt);
    if (cacheUser && Date.now() - cacheUser.t < 5 * 60 * 1000) return cacheUser.p;
    const p = supabase.auth.getSession().then(async ({ data }) => {
      if (data.session?.user) return { data: { user: data.session.user }, error: null };
      return getUserOriginal();
    });
    cacheUser = { p, t: Date.now() };
    p.then((r: any) => { if (!r?.data?.user) cacheUser = null; }).catch(() => { cacheUser = null; });
    return p;
  };
  supabase.auth.onAuthStateChange(() => { cacheUser = null; limparMemo(); });
}

// ─── Velocidade: memória curta para dados repetidos entre layout, menu e páginas ──
const memoria = new Map<string, { p: Promise<unknown>; t: number }>();
export function memo<T>(chave: string, fn: () => Promise<T>, ttlMs = 60_000): Promise<T> {
  const atual = memoria.get(chave);
  if (atual && Date.now() - atual.t < ttlMs) return atual.p as Promise<T>;
  const p = fn();
  memoria.set(chave, { p, t: Date.now() });
  p.catch(() => memoria.delete(chave));
  return p;
}
export function limparMemo(prefixo = "") {
  for (const k of Array.from(memoria.keys())) if (k.startsWith(prefixo)) memoria.delete(k);
}

/** Permissões do usuário (uma busca compartilhada por layout, menu e Início). */
export async function carregarPermissoes(): Promise<{ permissoes: string[] | null; modulos_agencia: string[] | null }> {
  const agenciaId = typeof window !== "undefined" ? sessionStorage.getItem("agencia_selecionada") : null;
  return memo(`perm:${agenciaId || ""}`, async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const url = agenciaId ? `/api/permissoes?agencia_id=${agenciaId}` : "/api/permissoes";
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token ?? ""}` } });
    if (!res.ok) throw new Error("permissoes " + res.status);
    const j = await res.json();
    return { permissoes: j?.permissoes ?? null, modulos_agencia: j?.modulos_agencia ?? null };
  }, 5 * 60_000);
}

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
