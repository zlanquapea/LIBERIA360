import { timingSafeEqual } from "crypto";
import { isIP } from "net";
import type { Request } from "express";

/** Set by the web service (web/src/proxy.ts and web/src/lib/visitor-headers.ts)
 * on every call it makes to this API on a visitor's behalf — both browser
 * requests it reverse-proxies (/api/* rewrite) and server-side fetches made
 * while rendering a page. Keep the names in sync with
 * web/src/lib/visitor-ip.ts. */
export const CLIENT_IP_HEADER = "x-liberia360-client-ip";
export const PROXY_SECRET_HEADER = "x-liberia360-proxy-secret";

/** Anything shorter is treated as "not configured" rather than as a secret
 * worth trusting — a typo'd or placeholder value must not turn the
 * client-IP header into something a caller could guess their way into. */
export const MIN_PROXY_SECRET_LENGTH = 32;

export function configuredProxySecret(): string | undefined {
  const secret = process.env.INTERNAL_PROXY_SECRET;
  return secret && secret.length >= MIN_PROXY_SECRET_LENGTH
    ? secret
    : undefined;
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function secretMatches(presented: string, expected: string): boolean {
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The address rate limiting, the audit trail and the login-activity log
 * should attribute a request to.
 *
 * In production nearly every request reaches this API from the web
 * service, not from the visitor's own machine, so `req.ip` alone is the web
 * service's address for the whole site. The web service therefore passes
 * the visitor's address in CLIENT_IP_HEADER — and that header is honoured
 * only alongside the INTERNAL_PROXY_SECRET both services share. A caller
 * that reaches the API directly cannot know the secret, so it cannot claim
 * somebody else's address (or a fresh one per request to dodge the login
 * throttle); it is simply attributed to `req.ip`, exactly as before. */
export function resolveClientIp(req: Request): string | undefined {
  const expected = configuredProxySecret();
  const presented = firstHeader(req.headers[PROXY_SECRET_HEADER]);
  if (expected && presented && secretMatches(presented, expected)) {
    const forwarded = firstHeader(req.headers[CLIENT_IP_HEADER])?.trim();
    if (forwarded && isIP(forwarded)) return forwarded;
  }
  return req.ip;
}
