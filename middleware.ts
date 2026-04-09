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

  // Verificar se tem cookie de sessão do Supabase
  // O Supabase armazena a sessão em cookies com prefixo sb-{ref}-auth-token
  const cookies = req.cookies.getAll();
  const hasSession = cookies.some(c =>
    c.name.includes("auth-token") ||
    c.name.includes("access-token") ||
    c.name.includes("sb-") && c.name.includes("-auth")
  );

  if (!hasSession) {
    // API routes: 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    // Páginas: redirecionar pro login
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
