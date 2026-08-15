export interface AppConfig {
  port: number;
  nodeEnv: string;
  corsOrigin: string;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    synchronize: boolean;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  webPush: {
    publicKey: string;
    privateKey: string;
    contactEmail: string;
  };
  twoFactor: {
    // 32-byte hex key for AES-256-GCM, encrypting TOTP secrets at rest
    // (see auth/two-factor-crypto.ts) — a DB leak alone shouldn't be
    // enough to generate valid codes for every account.
    encryptionKey: string;
  };
}

export default (): AppConfig => ({
  port: parseInt(process.env.PORT ?? "3001", 10),
  nodeEnv: process.env.NODE_ENV ?? "development",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  database: {
    host: process.env.DB_HOST ?? "localhost",
    port: parseInt(process.env.DB_PORT ?? "5432", 10),
    username: process.env.DB_USERNAME ?? "liberia360",
    password: process.env.DB_PASSWORD ?? "liberia360",
    database: process.env.DB_DATABASE ?? "liberia360",
    synchronize: process.env.DB_SYNCHRONIZE === "true",
  },
  jwt: {
    // Dev-only fallback so a fresh checkout boots without extra setup —
    // never rely on this default outside local development.
    secret: process.env.JWT_SECRET ?? "dev-only-insecure-secret-change-me",
    expiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  },
  webPush: {
    publicKey: process.env.VAPID_PUBLIC_KEY ?? "",
    privateKey: process.env.VAPID_PRIVATE_KEY ?? "",
    contactEmail: process.env.VAPID_CONTACT_EMAIL ?? "mailto:admin@example.com",
  },
  twoFactor: {
    // Dev-only fallback (32 bytes of "dead", valid hex, obviously not
    // random), same pattern as jwt.secret above — never rely on this
    // outside local development. Generate a real one with:
    //   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    encryptionKey: process.env.TWO_FACTOR_ENCRYPTION_KEY ?? "dead".repeat(16),
  },
});
