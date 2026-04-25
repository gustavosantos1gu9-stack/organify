import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "./supabase-admin";

interface AuthResult {
  userId: string;
  agenciaId: string;
}

// Extrai e valida o usuário autenticado + agencia_id de uma request de API
// Verifica que o usuário pertence à agência que está acessando
export async function getAuthenticatedAgenciaId(
  req: NextRequest,
  bodyAgenciaId?: string
): Promise<AuthResult> {
  // 1. Extrair token da session cookie ou Authorization header
  const authHeader = req.headers.get("authorization");
  let token: string | null = null;

  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  }

  // Tentar cookie de sessão do Supabase
  if (!token) {
    const cookies = req.cookies;
    // Supabase armazena o token em cookies com prefixo sb-
    for (const [name, cookie] of cookies.getAll().map(c => [c.name, c.value] as const)) {
      if (name.includes("auth-token") || name.includes("access-token") || name.includes("access_token")) {
        // O cookie pode ser base64 encoded JSON
        try {
          const parsed = JSON.parse(cookie);
          if (parsed?.access_token) {
            token = parsed.access_token;
            break;
          }
        } catch {
          // Pode ser o token direto
          if (cookie.startsWith("eyJ")) {
            token = cookie;
            break;
          }
        }
      }
    }
  }

  if (!token) {
    throw new AuthError("Não autenticado", 401);
  }

  // 2. Validar o token e obter o usuário
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    throw new AuthError("Token inválido ou expirado", 401);
  }

  // 3. Buscar agencia_id do usuário
  const { data: usuarios } = await supabaseAdmin
    .from("usuarios")
    .select("agencia_id")
    .eq("auth_user_id", user.id)
    .limit(1);

  if (!usuarios?.[0]?.agencia_id) {
    throw new AuthError("Usuário sem agência vinculada", 403);
  }

  const agenciaId = usuarios[0].agencia_id;

  // 4. Se o body da request tem um agencia_id, verificar que bate
  if (bodyAgenciaId && bodyAgenciaId !== agenciaId) {
    // Verificar se é uma agência filha (admin acessando cliente)
    const { data: agFilha } = await supabaseAdmin
      .from("agencias")
      .select("id")
      .eq("id", bodyAgenciaId)
      .eq("parent_id", agenciaId)
      .single();

    if (!agFilha) {
      throw new AuthError("Sem permissão para acessar esta agência", 403);
    }

    // É agência filha, permitir acesso
    return { userId: user.id, agenciaId: bodyAgenciaId };
  }

  return { userId: user.id, agenciaId };
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Helper: retorna NextResponse de erro para catch blocks
export function handleAuthError(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return NextResponse.json({ error: "Erro interno" }, { status: 500 });
}
