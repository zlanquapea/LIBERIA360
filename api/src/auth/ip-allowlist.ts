// Minimal, dependency-free IPv4 CIDR + exact-match check for
// ADMIN_LOGIN_IP_ALLOWLIST (see config/configuration.ts's
// adminSecurity.loginIpAllowlist). IPv6 addresses are supported as exact
// matches only — no CIDR parsing for v6, which needs a real library to
// get right; if that's ever needed, add one then rather than guessing at
// it here.

/** True when `ip` should be allowed to log in as an admin. An empty
 * allowlist means the feature is unconfigured — no restriction at all,
 * the same "no-op unless configured" shape as mail/push/error tracking.
 * A non-empty allowlist fails closed: an ip we can't verify (null, or
 * unparseable) is never allowed, and a malformed allowlist entry never
 * matches anything rather than silently matching everything. */
export function isIpAllowed(ip: string | null, allowlist: string[]): boolean {
  if (allowlist.length === 0) return true;
  if (!ip) return false;
  return allowlist.some((entry) => matchesEntry(ip, entry));
}

function matchesEntry(ip: string, entry: string): boolean {
  if (!entry.includes("/")) return ip === entry;

  const [rangeIp, prefixStr] = entry.split("/");
  const prefix = Number(prefixStr);
  const ipInt = parseIpv4ToInt(ip);
  const rangeInt = parseIpv4ToInt(rangeIp);
  if (ipInt === null || rangeInt === null || !isValidPrefix(prefix)) {
    return false;
  }

  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipInt & mask) === (rangeInt & mask);
}

function isValidPrefix(prefix: number): boolean {
  return Number.isInteger(prefix) && prefix >= 0 && prefix <= 32;
}

function parseIpv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map(Number);
  if (octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) {
    return null;
  }
  return (
    ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0
  );
}
