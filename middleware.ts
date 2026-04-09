import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Rotas públicas que NÃO precisam de autenticação
const PUBLIC_PATHS = [
  "/login",
  "/nova-senha",
  "/redefinir-senha",
  "/c/",              // página de captura pública
  "/whatsapp",
  "/api/webhook/",    // webhooks externos
  "/api/captura",     // captura de tracking pública
  "/api/pixel-id",    // lookup público de pixel
  "/api/cron/",       // protegido por CRON_SECRET próprio
  "/api/cadastro",    // cadastro público de clientes
  "/api/pixel",       // disparado internamente pelo webhook
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname.startsWith(p));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Assets estáticos — passar direto
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Rotas públicas — passar direto
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Criar resposta mutável para o Supabase gerenciar cookies
  let response = NextResponse.next({
    request: { headers: req.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresh da sessão (importante pra manter tokens atualizados)
  const { data: { session } } = await supabase.auth.getSession();

  // Sem sessão válida
  if (!session) {
    // API routes: retornar 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Não autenticado" },
        { status: 401 }
      );
    }

    // Páginas protegidas: redirecionar para login
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
