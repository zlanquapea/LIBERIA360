import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// Encrypts TOTP secrets at rest (AES-256-GCM) — a Postgres dump or backup
// leak alone shouldn't be enough to generate valid 2FA codes for every
// account, the way a plaintext `two_factor_secret` column would allow.
// Format: "<iv-hex>:<authTag-hex>:<ciphertext-hex>", one self-contained
// string per column value so no extra column is needed for the IV/tag.

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recommended for GCM

export function encryptSecret(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, "hex");
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

export function decryptSecret(encrypted: string, keyHex: string): string {
  const [ivHex, authTagHex, ciphertextHex] = encrypted.split(":");
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error("Malformed encrypted two-factor secret");
  }
  const key = Buffer.from(keyHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, "hex")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
