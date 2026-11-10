import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { serverApiOrigin } from "./lib/server-api-origin";
import {
  CLIENT_IP_HEADER,
  PROXY_SECRET_HEADER,
  proxySecret,
  visitorIpFromForwardedFor,
} from "./lib/visitor-ip";

// Next.js 16 renamed the `middleware.ts` file convention to `proxy.ts` (the
// exported function is unaffected by that rename; see
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
//
// This file does three unrelated jobs in one pass, since Next.js only allows
// a single proxy file:
//   0. Stamps every request with the visitor's address so the API can
//      rate-limit per visitor instead of per web server (see
//      stampVisitorAddress below).
//   1. Session-cookie auth gating for /account and /admin (pre-existing;
//      see the regression note below — this predates i18n and must keep
//      working exactly as before for every locale).
//   2. next-intl's locale detection/redirect/rewrite (added Sep 2026,
//      I18N_PLAN.md) for everything under the [locale] segment.
// Auth runs first; only a request that passes it (or isn't protected at
// all) reaches the intl middleware.

const SESSION_COOKIE = "liberia360_session";
const intlMiddleware = createIntlMiddleware(routing);

// /account lives inside the [locale] segment (src/app/[locale]/account),
// so it's reachable as both /account (English, unprefixed) and
// /fr/account, /zh/account, /ar/account. The auth check below needs to
// recognize all of those as "the same protected route" — otherwise a
// French visitor could reach /fr/account with no valid session at all,
// since a naive `pathname.startsWith("/account")` check only catches the
// unprefixed form. /admin lives OUTSIDE the [locale] segment (see
// src/app/(no-locale)/admin) and is never locale-prefixed, but stripping
// is harmless there too — the regex simply won't match.
function stripLocalePrefix(pathname: string): { prefix: string; rest: string } {
  const match = pathname.match(/^\/([a-z]{2})(?=\/|$)/);
  if (match && (routing.locales as readonly string[]).includes(match[1])) {
    return { prefix: `/${match[1]}`, rest: pathname.slice(match[0].length) || "/" };
  }
  return { prefix: "", rest: pathname };
}

// Everything physically under src/app/(no-locale) — a route group, so
// none of this appears in the URL. These pages have no [locale] segment
// and render no NextIntlClientProvider, so next-intl's middleware must
// never touch them: it doesn't know these routes are locale-less and
// will rewrite e.g. /admin/content/moderation to /en/admin/content/moderation
// to satisfy the [locale] segment convention — a path with no matching
// page (src/app/[locale]/admin/... doesn't exist), which 404s. Keep this
// list in sync with (no-locale)'s actual top-level entries.
const NO_LOCALE_ROUTES = ["/admin", "/privacy", "/terms"];

function isNoLocaleRoute(pathname: string): boolean {
  return NO_LOCALE_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

// The API sees this web server, not the visitor, as the client of every
// request (see lib/visitor-ip.ts). Resolve the visitor's address once here
// and write it onto the request itself — overwriting whatever the client
// may have sent under the same names — so that:
//   - /api/* requests, which next.config.js rewrites straight through to
//     the API, arrive there carrying the address plus the shared secret
//     that makes the API believe it;
//   - page requests expose the address to server-side data fetching
//     (lib/visitor-headers.ts), which adds the secret itself. The secret is
//     deliberately not put on page requests: nothing rendering a page
//     needs it from there.
// Returns the visitor address headers for this function's own API call.
function stampVisitorAddress(request: NextRequest): Record<string, string> {
  const secret = proxySecret();
  const ip = secret
    ? visitorIpFromForwardedFor(request.headers.get("x-forwarded-for"))
    : undefined;

  request.headers.delete(CLIENT_IP_HEADER);
  request.headers.delete(PROXY_SECRET_HEADER);
  if (!secret || !ip) return {};

  request.headers.set(CLIENT_IP_HEADER, ip);
  if (isApiRoute(request.nextUrl.pathname)) {
    request.headers.set(PROXY_SECRET_HEADER, secret);
  }
  return { [CLIENT_IP_HEADER]: ip, [PROXY_SECRET_HEADER]: secret };
}

function isApiRoute(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

// This regression pins the fix itself: proxy() used to validate the session
// cookie by fetching new URL("/api/v1/auth/me", request.url) — this app's
// own public URL, which then has to round-trip back out through its own
// next.config.js rewrite before reaching the API. Any hiccup in that
// self-referential hop (DNS, TLS, the platform's own routing for a hostname
// that isn't guaranteed reachable from inside the container serving it)
// made every protected page redirect a just-logged-in user straight back to
// /login, indistinguishable from a genuinely dead session — exactly the "I'm
// logged in but the account page bounces me to login" report this fixed.
// proxy() must instead hit the API's real origin (serverApiOrigin()) directly.
export async function proxy(request: NextRequest) {
  const visitor = stampVisitorAddress(request);

  // Rewritten to the API by next.config.js — nothing else in this file
  // (auth gate, locale routing) applies to it.
  if (isApiRoute(request.nextUrl.pathname)) {
    return NextResponse.next({ request: { headers: request.headers } });
  }

  const { prefix, rest } = stripLocalePrefix(request.nextUrl.pathname);
  const isProtected = rest.startsWith("/admin") || rest.startsWith("/account");

  if (isProtected) {
    const loginUrl = new URL(`${prefix}/login`, request.url);
    loginUrl.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );

    if (!request.cookies.has(SESSION_COOKIE))
      return NextResponse.redirect(loginUrl);

    try {
      const response = await fetch(`${serverApiOrigin()}/api/v1/auth/me`, {
        headers: { cookie: request.headers.get("cookie") ?? "", ...visitor },
        cache: "no-store",
      });
      if (!response.ok) return NextResponse.redirect(loginUrl);
      if (rest.startsWith("/admin")) {
        const user = (await response.json()) as {
          isAdmin?: boolean;
          isSuperAdmin?: boolean;
        };
        if (!user.isAdmin && !user.isSuperAdmin)
          return NextResponse.redirect(new URL(`${prefix}/account`, request.url));
      }
    } catch {
      return NextResponse.redirect(loginUrl);
    }
  }

  // (no-locale) routes (admin/privacy/terms) never go through next-intl —
  // see isNoLocaleRoute's doc comment for why that would break them.
  if (isNoLocaleRoute(request.nextUrl.pathname)) {
    return NextResponse.next({ request: { headers: request.headers } });
  }

  // Authenticated (or not a protected route at all) — hand off to
  // next-intl for locale detection/redirect/rewrite. It forwards
  // request.headers (as stamped above) to the page on its own.
  return intlMiddleware(request);
}

export const config = {
  // Runs on every route except: Next internals, the /uploads proxy target
  // (next.config.js rewrites it to the backend), static
  // files (anything with a dot, e.g. manifest.webmanifest, icons), and
  // the site's own service worker (sw.js must be served from the true
  // root, not from under a locale prefix, or its scope only covers that
  // one locale's pages). Broader than the pre-i18n matcher
  // (["/admin/:path*", "/account/:path*"]) had to be, since next-intl
  // needs to run on every tourist-facing page, not just the protected
  // ones — the auth check inside proxy() above still only *acts* on
  // /admin and /account (locale-prefix-aware), exactly as before.
  //
  // /api is matched by its own entry, unconditionally (an API path may
  // legitimately contain a dot, which the first pattern would skip): those
  // requests need the visitor address stamped on them before the rewrite,
  // and proxy() returns early for them before any auth/locale handling.
  matcher: ["/((?!api|uploads|_next|sw\\.js|.*\\..*).*)", "/api/:path*"],
};
