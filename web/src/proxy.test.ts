/**
 * @jest-environment node
 */
// next/server's NextRequest needs the platform Request/Response/fetch
// globals, which jsdom (this project's default test environment) doesn't
// implement — Node's own globals (Node 18+) do.
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

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
});
