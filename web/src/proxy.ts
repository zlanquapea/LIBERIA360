import { NextResponse, type NextRequest } from "next/server";
import { serverApiOrigin } from "./lib/server-api-origin";

const SESSION_COOKIE = "liberia360_session";

export async function proxy(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );

  if (!request.cookies.has(SESSION_COOKIE))
    return NextResponse.redirect(loginUrl);

  try {
    // Validate the signed cookie directly against the API's own origin —
    // not by fetching this app's own public /api/v1/auth/me URL, which
    // would round-trip back out through this same deployment's rewrite
    // (next.config.js) before landing on the API anyway. That self-referential
    // hop adds nothing (the rewrite's destination *is* serverApiOrigin()) and
    // makes every protected page's load depend on this deployment being able
    // to reach its own public URL — a real request over the network, subject
    // to the platform's own DNS, TLS, and routing for a hostname that isn't
    // guaranteed reachable from inside the container serving it. A hiccup
    // there produced exactly the symptom this was fixed for: a valid,
    // just-issued session cookie bouncing straight back to /login because
    // this fetch itself failed, not because the session was actually bad.
    // Admin routes additionally require a current server-side role.
    const response = await fetch(`${serverApiOrigin()}/api/v1/auth/me`, {
      headers: { cookie: request.headers.get("cookie") ?? "" },
      cache: "no-store",
    });
    if (!response.ok) return NextResponse.redirect(loginUrl);
    if (request.nextUrl.pathname.startsWith("/admin")) {
      const user = (await response.json()) as {
        isAdmin?: boolean;
        isSuperAdmin?: boolean;
      };
      if (!user.isAdmin && !user.isSuperAdmin)
        return NextResponse.redirect(new URL("/account", request.url));
    }
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: ["/admin/:path*", "/account/:path*"],
};
