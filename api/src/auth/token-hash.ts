import { randomBytes, createHash, timingSafeEqual } from "crypto";

/**
 * High-entropy, single-use tokens (email verification, password reset) —
 * a different threat model than a password or TOTP code, so a different
 * storage treatment than bcrypt: the raw token has 256 bits of entropy
 * (nothing to brute-force), and it needs to be found by exact lookup, not
 * compared against every user's hash one at a time. SHA-256 at rest is
 * standard for this (same approach Rails/Devise use for
 * confirmation/reset tokens) — a DB leak alone doesn't hand out a usable
 * token, and lookup stays a single indexed query.
 */

export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Constant-time comparison of two hex-encoded hashes — avoids leaking
 * timing information about how much of a guessed token matched, even
 * though the lookup itself is already by exact hash match. */
export function hashesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
