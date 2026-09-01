import type { Response } from "supertest";

// Kept in sync with AuthController's own SESSION_COOKIE name — register,
// login, 2fa/verify, and friends now hand the JWT back exclusively as a
// Secure, HttpOnly, SameSite=Lax cookie (see AuthController.establishSession)
// rather than in the JSON body, so a browser's own JS can never read it. An
// e2e test authenticates downstream requests the same way a real browser
// does: by replaying the Set-Cookie value verbatim as a Cookie header,
// never by reading res.body.accessToken (that field no longer exists).
const SESSION_COOKIE_NAME = "liberia360_session";

function setCookies(res: Response): string[] {
  const raw = res.headers["set-cookie"] as unknown as string[] | undefined;
  return raw ?? [];
}

// Asserts a session was actually established on this response and returns
// the exact `name=value` pair to hand to a later request's
// `.set("Cookie", sessionCookie(res))` — deliberately failing the calling
// test (via the built-in expect) rather than returning undefined if the
// endpoint didn't set one, since every call site expects one to be there.
export function sessionCookie(res: Response): string {
  const match = setCookies(res).find((c) =>
    c.startsWith(`${SESSION_COOKIE_NAME}=`),
  );
  expect(match).toBeDefined();
  return match!.split(";")[0];
}

// The negative case — e.g. a 2FA-required login response, which
// intentionally issues a pendingToken in the body instead of a real
// session, and must not also set the session cookie.
export function expectNoSessionCookie(res: Response): void {
  expect(
    setCookies(res).some((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`)),
  ).toBe(false);
}
