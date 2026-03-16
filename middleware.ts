import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const token = req.cookies.get("sb-dfjmnibyfowwmlmfbbpa-auth-token");
  const isAuth = !!token;
  const isLoginPage = req.nextUrl.pathname === "/login";
  const isPublic = req.nextUrl.pathname.startsWith("/c") || req.nextUrl.pathname.startsWith("/api");

  if (isPublic) return NextResponse.next();
  if (!isAuth && !isLoginPage) return NextResponse.redirect(new URL("/login", req.url));
  if (isAuth && isLoginPage) return NextResponse.redirect(new URL("/", req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
