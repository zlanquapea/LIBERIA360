// How the API learns which visitor a request is for.
//
// Browsers never talk to the API directly: their /api/* calls are
// reverse-proxied by this web server (next.config.js rewrites) and pages are
// rendered here from server-side fetches. Left alone, the API would see this
// server's address on every request and rate-limit the whole site as one
// client. So every call made on a visitor's behalf carries the visitor's
// address in CLIENT_IP_HEADER, plus PROXY_SECRET_HEADER — the
// INTERNAL_PROXY_SECRET both services share — without which the API ignores
// it (see api/src/common/client-ip.ts; keep the header names in sync).
//
// Side-effect free and free of next/* imports on purpose: proxy.ts and
// visitor-headers.ts both use it.
export const CLIENT_IP_HEADER = "x-liberia360-client-ip";
export const PROXY_SECRET_HEADER = "x-liberia360-proxy-secret";

// Same floor the API enforces — a shorter value is ignored there, so don't
// send it at all.
const MIN_PROXY_SECRET_LENGTH = 32;

export function proxySecret(): string | undefined {
  const secret = process.env.INTERNAL_PROXY_SECRET;
  return secret && secret.length >= MIN_PROXY_SECRET_LENGTH
    ? secret
    : undefined;
}

// How many reverse proxies (load balancer, CDN, ...) sit between the
// visitor and this web server — each appends the address it received the
// request from to X-Forwarded-For. Defaults to 1, the usual managed-host
// setup of a single load balancer.
export function trustedProxyHops(): number {
  const hops = Number.parseInt(process.env.TRUST_PROXY_HOPS ?? "", 10);
  return Number.isFinite(hops) && hops >= 0 ? hops : 1;
}

const IP_SHAPE = /^[0-9a-fA-F:.]{2,45}$/;

/** Picks the visitor's address out of X-Forwarded-For.
 *
 * Only the entries appended by our own proxies can be believed — everything
 * to their left is whatever the client chose to send. With N trusted
 * proxies in front, the visitor is therefore the Nth entry from the right,
 * never simply the first. With no proxy at all (hops 0, e.g. `next start`
 * on localhost) Next itself fills the header with the socket address when
 * the client sent none, so the rightmost entry is used there too. */
export function visitorIpFromForwardedFor(
  forwardedFor: string | null | undefined,
  hops: number = trustedProxyHops(),
): string | undefined {
  if (!forwardedFor) return undefined;
  const entries = forwardedFor
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const candidate = entries[entries.length - Math.max(hops, 1)];
  return candidate && IP_SHAPE.test(candidate) ? candidate : undefined;
}
