import { randomBytes } from "crypto";

// One-time backup codes for when a device with the authenticator app is
// lost — without these, losing the device would permanently lock the
// account out (an over-correction "security" feature that's actually
// just a denial-of-service against your own users). Shown once at
// generation time; only bcrypt hashes are ever stored (same as
// passwords), so a DB leak doesn't hand out working codes.
const RECOVERY_CODE_COUNT = 10;

export function generateRecoveryCodes(): string[] {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const raw = randomBytes(5).toString("hex"); // 10 hex chars
    return `${raw.slice(0, 5)}-${raw.slice(5, 10)}`;
  });
}
