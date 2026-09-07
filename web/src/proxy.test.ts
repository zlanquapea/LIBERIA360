/**
 * @jest-environment node
 */
// next/server's NextRequest needs the platform Request/Response/fetch
// globals, which jsdom (this project's default test environment) doesn't
// implement — Node's own globals (Node 18+) do.
import { NextRequest, NextResponse } from "next/server";
import { proxy } from "./proxy";

// next-intl (and its /middleware and /routing entry points) ship an ESM
// build that Jest's default transform (node_modules is untransformed)
// can't parse, and none of these tests exercise locale detection anyway —
// they're all about the auth gate that runs before it (see proxy.ts's own
// doc comment). Pass-through stubs keep this file focused on what it
// actually tests. The default export's jest.fn() is exported alongside it
// (rather than kept in an outer-scope const the factory closes over — that
// hits a TDZ, since the factory runs during the `import { proxy }` above,
// before any later top-level statement here has run) so tests can assert
// whether it was actually invoked — see the (no-locale)-route tests below,
// which pin the bug where every route, admin included, used to be handed
// to this middleware unconditionally. jest.requireMock (not a typed static
// import) pulls it back out, since the real next-intl/middleware types
// don't declare this mock-only export.
jest.mock("next-intl/middleware", () => {
  const fn = jest.fn(() => NextResponse.next());
  return { __esModule: true, default: () => fn, mockIntlMiddleware: fn };
});
jest.mock("next-intl/routing", () => ({
  __esModule: true,
  defineRouting: (config: unknown) => config,
}));
const { mockIntlMiddleware } = jest.requireMock<{ mockIntlMiddleware: jest.Mock }>(
  "next-intl/middleware",
);

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
describe("proxy", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, API_ORIGIN: "https://api.internal.example" };
    mockIntlMiddleware.mockClear();
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.restoreAllMocks();
  });

  function requestWithSessionCookie(url: string): NextRequest {
    return new NextRequest(url, {
      headers: { cookie: "liberia360_session=some-token" },
    });
  }

  it("redirects to /login without ever calling fetch when there's no session cookie", async () => {
    const fetchSpy = jest.spyOn(global, "fetch");
    const request = new NextRequest("https://app.example.com/account");

    const response = await proxy(request);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://app.example.com/login?next=%2Faccount",
    );
  });

  it("validates the cookie against the API's real origin, not this app's own public URL", async () => {
    const fetchSpy = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));

    const request = requestWithSessionCookie("https://app.example.com/account");
    const response = await proxy(request);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchSpy.mock.calls[0];
    expect(calledUrl).toBe("https://api.internal.example/api/v1/auth/me");
    expect((init?.headers as Record<string, string>).cookie).toBe(
      "liberia360_session=some-token",
    );
    // A valid session lets the request through — no redirect.
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects to /login if the API rejects the session, without leaking why", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(new Response(null, { status: 401 }));
    const request = requestWithSessionCookie("https://app.example.com/account");

    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://app.example.com/login?next=%2Faccount",
    );
  });

  it("redirects to /login (rather than throwing) if the validation fetch itself fails", async () => {
    jest.spyOn(global, "fetch").mockRejectedValue(new Error("fetch failed"));
    const request = requestWithSessionCookie("https://app.example.com/account");

    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://app.example.com/login?next=%2Faccount",
    );
  });

  it("sends a non-admin user on /admin back to /account instead of looping to /login", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ isAdmin: false, isSuperAdmin: false }), {
        status: 200,
      }),
    );
    const request = requestWithSessionCookie("https://app.example.com/admin");

    const response = await proxy(request);

    expect(response.headers.get("location")).toBe("https://app.example.com/account");
  });

  it("lets an admin through to /admin", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ isAdmin: true, isSuperAdmin: false }), {
        status: 200,
      }),
    );
    const request = requestWithSessionCookie("https://app.example.com/admin");

    const response = await proxy(request);

    expect(response.headers.get("location")).toBeNull();
  });

  // i18n (Sep 2026): /account lives inside the [locale] segment
  // (src/app/[locale]/account), so it's reachable as /fr/account,
  // /zh/account, /ar/account too — not just the unprefixed English form
  // the tests above cover. A French visitor with no session hitting
  // /fr/account must still be redirected, and back to /fr/login (not the
  // bare /login the unprefixed tests expect), or the locale is lost right
  // where a visitor most needs to stay oriented.
  it("redirects a locale-prefixed /account the same way as the unprefixed form", async () => {
    const fetchSpy = jest.spyOn(global, "fetch");
    const request = new NextRequest("https://app.example.com/fr/account");

    const response = await proxy(request);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://app.example.com/fr/login?next=%2Ffr%2Faccount",
    );
  });

  it("lets a valid session through on a locale-prefixed /account", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    const request = requestWithSessionCookie("https://app.example.com/zh/account");

    const response = await proxy(request);

    expect(response.headers.get("location")).toBeNull();
  });

  // Regression: (no-locale) routes (src/app/(no-locale)/admin, /privacy,
  // /terms) have no [locale] segment and render no NextIntlClientProvider.
  // proxy() used to fall through to intlMiddleware unconditionally for any
  // request that passed (or didn't need) the auth check above, and
  // next-intl — not knowing these routes are locale-less — rewrites them
  // to satisfy the [locale] segment convention (e.g. /admin/content/... to
  // /en/admin/content/...), a path with no matching page. That 404s every
  // admin page and both legal pages. Caught by e2e/admin-moderation.spec.ts
  // failing in CI despite passing locally against a stale/reused dev DB —
  // see that spec's git history for the full story.
  it.each([
    ["/admin/content/moderation", true],
    ["/privacy", false],
    ["/terms", false],
  ])("never hands %s to next-intl's middleware", async (path, needsAdmin) => {
    if (needsAdmin) {
      jest.spyOn(global, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ isAdmin: true, isSuperAdmin: false }), { status: 200 }),
      );
    }
    const request = needsAdmin
      ? requestWithSessionCookie(`https://app.example.com${path}`)
      : new NextRequest(`https://app.example.com${path}`);

    const response = await proxy(request);

    expect(mockIntlMiddleware).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBeNull();
  });

  it("still hands a [locale]-tree route to next-intl's middleware", async () => {
    const request = new NextRequest("https://app.example.com/places/some-place");

    await proxy(request);

    expect(mockIntlMiddleware).toHaveBeenCalledTimes(1);
  });
});
