import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const proxyHandler = auth((req) => {
  const { pathname } = req.nextUrl;
  const role = req.auth?.user?.role;

  if (pathname.startsWith("/admin")) {
    if (!req.auth?.user) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (!role || !ADMIN_ROLES.includes(role)) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  if (pathname.startsWith("/account")) {
    if (!req.auth?.user) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
});

export default proxyHandler;
export const proxy = proxyHandler;

export const config = {
  matcher: ["/admin/:path*", "/account/:path*"],
};
