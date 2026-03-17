import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const token = req.cookies.get("sb-dfjmnibyfowwmlmfbbpa-auth-token");
  const isAuth = !!token;
  const path = req.nextUrl.pathname;

  const isPublic =
    path === "/login" ||
    path === "/redefinir-senha" ||
    path === "/nova-senha" ||
    path.startsWith("/c") ||
    path.startsWith("/api");

  if (isPublic) return NextResponse.next();
  if (!isAuth) return NextResponse.redirect(new URL("/login", req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
