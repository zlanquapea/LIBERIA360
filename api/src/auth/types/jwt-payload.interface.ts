export interface JwtPayload {
  sub: string; // user id
  email: string;
}

// Signed by AuthService.login instead of a real JwtPayload when the account
// has 2FA enabled — a narrowly-scoped, short-lived token that proves "this
// caller already has the right password" without granting API access.
// JwtStrategy.validate rejects any token carrying `purpose`, so this can
// only ever be exchanged at POST /auth/2fa/verify, never used as a bearer
// token elsewhere.
export interface TwoFactorPendingPayload {
  sub: string; // user id
  purpose: "2fa-pending";
}
