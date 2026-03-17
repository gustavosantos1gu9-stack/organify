import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  const isPublic =
    path === "/login" ||
    path === "/redefinir-senha" ||
    path === "/nova-senha" ||
    path.startsWith("/c") ||
    path.startsWith("/api");

  if (isPublic) return NextResponse.next();

  // Verificar qualquer cookie do Supabase
  const cookies = req.cookies.getAll();
  const isAuth = cookies.some(c => 
    c.name.startsWith("sb-") && c.name.endsWith("-auth-token")
  );

  if (!isAuth) return NextResponse.redirect(new URL("/login", req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
