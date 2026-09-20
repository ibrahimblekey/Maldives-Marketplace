import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * Next.js Proxy (formerly "Middleware", renamed in Next.js 16 — same
 * mechanism, new file name/export).
 *
 * IMPORTANT — read this before adding logic here:
 * Proxy is for FAST, OPTIMISTIC checks only (redirect an obviously logged-out
 * visitor away from /dashboard before the page even renders). It is NOT the
 * real authorization boundary. Next.js's own guidance is explicit that
 * Proxy should not be treated as a full session/authorization solution, and
 * this project's security requirements say the same: every protected page,
 * API route, and server action must independently verify the caller's
 * session and role server-side, because:
 *   1. Proxy only sees a decoded JWT cookie — it never re-checks the
 *      database (e.g. a since-deactivated account, a role that changed).
 *   2. Route handlers and server actions can be invoked directly (not just
 *      via a page navigation this file would intercept).
 *
 * See src/app/dashboard/layout.tsx and the pages under src/app/dashboard/*
 * for the real, server-side role checks, and src/server/auth/authorize.ts
 * for the shared helper they use.
 */
export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const path = req.nextUrl.pathname;

  const isProtectedRoute = path.startsWith("/dashboard");

  if (isProtectedRoute && !isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*"],
};
