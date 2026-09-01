import type { APIRequestContext, APIResponse, Page } from '@playwright/test';
import { Client } from 'pg';

// Talks directly to the API — the same one the web app under test talks
// to — for fast, reliable fixture setup (registering users, claiming a
// business, seeding reports) instead of driving every prerequisite
// through the UI. Keeps each spec's browser interactions focused on the
// flow it's actually testing.
export const API_URL = process.env.PLAYWRIGHT_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

// The web app the browser drives — needed to scope the session cookie
// loginAs() injects (see below) to the right origin.
const WEB_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

// Kept in sync with AuthController's own SESSION_COOKIE name. Register/
// login now hand the JWT back exclusively as a Secure, HttpOnly cookie
// (see AuthController.establishSession) rather than in the JSON body, so
// fixture setup here reads it the only place it still exists: the
// response's own Set-Cookie header. Cookie domain-matching ignores port,
// so a cookie minted by the API on :3001 still applies to the web app on
// :3000 once added to the browser context with that origin.
const SESSION_COOKIE_NAME = 'liberia360_session';

function sessionTokenFrom(res: APIResponse): string {
  const setCookieHeaders = res
    .headersArray()
    .filter((h) => h.name.toLowerCase() === 'set-cookie')
    .map((h) => h.value.split(';')[0]);
  const match = setCookieHeaders.find((pair) => pair.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (!match) {
    throw new Error(
      `Expected a ${SESSION_COOKIE_NAME} cookie in the response but got: ${setCookieHeaders.join(' | ') || '(none)'}`,
    );
  }
  return match.slice(SESSION_COOKIE_NAME.length + 1);
}

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${uniqueSuffix()}@example.com`;
}

// Specs that assert on a fixture's display name (not just its email) need
// the *name* to be unique across runs too — this suite runs against a
// shared, accumulating dev DB (see e2e/README.md), so a fixed literal name
// reused run after run eventually matches more than one review/user and
// breaks a `getByText(...)` locator's uniqueness.
export function uniqueName(label: string): string {
  return `${label} ${uniqueSuffix()}`;
}

export interface RegisteredUser {
  // The raw session JWT, extracted from the response's Set-Cookie header
  // (see sessionTokenFrom above) — never present in the JSON body anymore.
  // Still usable as a Bearer token for direct API fixture calls below
  // (JwtStrategy keeps that fallback for non-browser clients), and it's
  // exactly what loginAs() needs to seed a browser session.
  token: string;
  id: string;
  name: string;
  email: string;
}

export async function registerUser(
  request: APIRequestContext,
  opts: { name: string; email?: string; password?: string },
): Promise<RegisteredUser> {
  const email = opts.email ?? uniqueEmail('e2e');
  const password = opts.password ?? 'password123';
  const res = await request.post(`${API_URL}/auth/register`, {
    data: { name: opts.name, email, password },
  });
  if (!res.ok()) {
    throw new Error(`register failed (${res.status()}): ${await res.text()}`);
  }
  const body = await res.json();
  return { token: sessionTokenFrom(res), id: body.user.id, name: opts.name, email };
}

// `index` (default 0) picks which catalog place to use — specs that
// create a review and then check for it on that place's page should each
// use a *different* index (see the per-file comments where this is
// called), for two independent reasons:
//   1. The destination profile page is server-rendered with a short data-
//      cache window (see web/README.md's "a short revalidation window") —
//      two specs both defaulting to index 0 within that window could see
//      each other's cached page and miss their own just-created review.
//   2. `sort=name` (explicit below, not the API's default `featured`,
//      which factors in rating) is what actually keeps "index N" a stable
//      identity across the whole suite — under the default sort, one
//      spec creating a review shifts every other place's relative rank,
//      so "the Nth place" would silently point at something different by
//      the time a later spec asks for it.
export async function getPlace(
  request: APIRequestContext,
  index = 0,
): Promise<{ id: string; slug: string; name: string }> {
  const res = await request.get(`${API_URL}/places?sort=name&limit=${index + 1}`);
  if (!res.ok()) throw new Error(`GET /places failed (${res.status()})`);
  const body = await res.json();
  if (!body.data?.[index]) {
    throw new Error(
      `No seeded place at index ${index} — run \`npm run seed --workspace=api\` against the DB this suite targets, or use a lower index.`,
    );
  }
  return body.data[index];
}

export const getFirstPlace = (request: APIRequestContext) => getPlace(request, 0);

// Idempotent: a place allows only one linked business, so re-running the
// suite against a DB from a previous run would 409 on a fresh claim
// attempt — falls back to the place's existing business in that case,
// which serves booking.spec.ts's purpose just as well (any claimed
// business to book against).
//
// A fresh self-claim starts SUBMITTED_FOR_REVIEW (see
// BusinessesService.claimPlace) and the public /places/[slug] page only
// ever shows an APPROVED business — so a caller that needs the claimed
// business to actually be visible/bookable through the UI (not just to
// exist) must pass `approve: true`, which flips it directly via SQL the
// same way promoteToAdmin does (no self-service "approve your own claim"
// API exists, by design — an admin has to do that for real).
export async function claimBusiness(
  request: APIRequestContext,
  token: string,
  placeId: string,
  name: string,
  opts: { approve?: boolean } = {},
): Promise<{ id: string }> {
  const res = await request.post(`${API_URL}/businesses`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { placeId, name, type: 'hotel' },
  });
  let business: { id: string } | null = null;
  if (res.ok()) {
    business = await res.json();
  } else if (res.status() === 409) {
    // GET /businesses?placeId= returns a single object (or null), not a
    // list — and an unapproved business (not yet reviewed, e.g. one a
    // prior/concurrent test run just claimed) comes back as a 200 with an
    // *empty* body rather than the text "null" (see web/src/lib/api.ts's
    // apiFetch for the same case), which .json() can't parse.
    const existing = await request.get(`${API_URL}/businesses?placeId=${placeId}`);
    const text = await existing.text();
    business = text ? JSON.parse(text) : null;
  }
  if (!business) {
    throw new Error(`business claim failed (${res.status()}): ${await res.text()}`);
  }
  if (opts.approve) await approveBusiness(business.id);
  return business;
}

async function approveBusiness(businessId: string): Promise<void> {
  const client = new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USERNAME ?? 'liberia360',
    password: process.env.DB_PASSWORD ?? 'liberia360',
    database: process.env.DB_DATABASE ?? 'liberia360',
  });
  await client.connect();
  try {
    await client.query("UPDATE businesses SET review_status = 'approved' WHERE id = $1", [businessId]);
  } finally {
    await client.end();
  }
}

export async function createReview(
  request: APIRequestContext,
  token: string,
  placeId: string,
  overallRating = 4,
): Promise<{ id: string }> {
  const res = await request.post(`${API_URL}/reviews`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { placeId, overallRating, comment: 'E2E fixture review — safe to remove.' },
  });
  if (!res.ok()) {
    throw new Error(`review creation failed (${res.status()}): ${await res.text()}`);
  }
  return res.json();
}

export async function reportContent(
  request: APIRequestContext,
  token: string,
  targetType: 'review' | 'event',
  targetId: string,
  reason: 'spam' | 'inappropriate' | 'fake' | 'other' = 'spam',
): Promise<void> {
  const res = await request.post(`${API_URL}/reports`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { targetType, targetId, reason },
  });
  if (!res.ok()) {
    throw new Error(`report failed (${res.status()}): ${await res.text()}`);
  }
}

// Direct DB write — there is no self-service API for this by design (see
// api/README.md's Admin section), so a raw connection is the only way to
// set up an admin fixture for a test.
export async function promoteToAdmin(email: string, opts: { superAdmin?: boolean } = {}): Promise<void> {
  const client = new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USERNAME ?? 'liberia360',
    password: process.env.DB_PASSWORD ?? 'liberia360',
    database: process.env.DB_DATABASE ?? 'liberia360',
  });
  await client.connect();
  try {
    await client.query('UPDATE users SET is_admin = true, is_super_admin = $2 WHERE email = $1', [
      email,
      Boolean(opts.superAdmin),
    ]);
  } finally {
    await client.end();
  }
}

// Injects auth state directly into localStorage, bypassing the login UI,
// for specs that aren't themselves testing the login/signup forms —
// auth.spec.ts is the one place those get exercised for real.
//
// isAdmin/isSuperAdmin default to false and should be passed explicitly
// (matching whatever promoteToAdmin was actually called with, if any)
// rather than left to AuthRefresher's background /auth/me refetch to fix
// up asynchronously — AdminGate reads the *current* cached value on first
// render, so a test that navigates straight to /admin right after
// promoting a user can otherwise race that refetch.
export async function loginAs(
  page: Page,
  user: RegisteredUser,
  roles: { isAdmin?: boolean; isSuperAdmin?: boolean } = {},
) {
  // The actual authenticated identity: a real session cookie, exactly as
  // the browser would hold one after a real login through the UI. Every
  // API call the app makes is same-origin with credentials: 'same-origin'
  // (see web/src/lib/http.ts) — there's no bearer header to fake anymore,
  // so this is the only way a fixture-registered user's browser session
  // can actually authenticate.
  await page.context().addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: user.token,
      url: WEB_URL,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  await page.goto('/');
  await page.evaluate(
    (userJson) => {
      window.localStorage.setItem('liberia360:auth-user', userJson);
    },
    JSON.stringify({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: null,
      authProvider: 'email',
      homeCounty: null,
      isAdmin: roles.isAdmin ?? false,
      isSuperAdmin: roles.isSuperAdmin ?? false,
      travelerType: null,
      interests: [],
      twoFactorEnabled: false,
      emailVerified: false,
      createdAt: new Date().toISOString(),
    }),
  );
  await page.reload();
}
