import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Rotas públicas que NÃO precisam de autenticação
const PUBLIC_PATHS = [
  "/login",
  "/nova-senha",
  "/redefinir-senha",
  "/c/",
  "/whatsapp",
  "/api/webhook/",
  "/api/captura",
  "/api/pixel-id",
  "/api/cron/",
  "/api/cadastro",
  "/api/pixel",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname.startsWith(p));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Assets estáticos
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Rotas públicas
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Proteger API routes com Authorization header (quando disponível)
  // O Supabase client-side usa localStorage, então cookies não estão disponíveis
  // A proteção principal é feita por:
  // 1. RLS no banco (isolamento por agência)
  // 2. Layout client-side redireciona pro login se sem sessão
  // 3. Webhook protegido por secret
  // 4. Cron protegido por CRON_SECRET

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
