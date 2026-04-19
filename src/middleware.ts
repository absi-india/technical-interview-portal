import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isAuth = !!req.auth;
  const path = req.nextUrl.pathname;

  const protectedPaths = ["/dashboard", "/admin", "/candidates", "/tests"];
  const isProtected = protectedPaths.some((p) => path.startsWith(p));
  const isApiProtected = path.startsWith("/api/candidates") || path.startsWith("/api/tests") || path.startsWith("/api/users") || path.startsWith("/api/admin");

  if ((isProtected || isApiProtected) && !isAuth) {
    if (isApiProtected) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/candidates/:path*",
    "/tests/:path*",
    "/api/candidates/:path*",
    "/api/tests/:path*",
    "/api/users/:path*",
    "/api/admin/:path*",
  ],
};
