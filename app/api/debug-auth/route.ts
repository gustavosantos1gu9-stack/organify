import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  // Pegar token do cookie
  const authCookie = req.cookies.get("sb-dfjmnibyfowwmlmfbbpa-auth-token");

  // Listar todos usuarios com auth_user_id
  const { data: usuarios } = await supabase.from("usuarios")
    .select("id, nome, email, auth_user_id, agencia_id");

  // Tentar pegar user do token se disponível
  let currentUser = null;
  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    const { data } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    currentUser = data?.user;
  }

  return NextResponse.json({
    has_cookie: !!authCookie,
    cookie_preview: authCookie?.value?.substring(0, 50),
    current_user: currentUser ? { id: currentUser.id, email: currentUser.email } : null,
    usuarios: usuarios?.map(u => ({ nome: u.nome, email: u.email, auth_user_id: u.auth_user_id, agencia_id: u.agencia_id })),
    fix: "Acesse /api/debug-auth?fix=SUA_AUTH_USER_ID para corrigir",
  });
}
