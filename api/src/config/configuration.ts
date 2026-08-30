export interface AppConfig {
  port: number;
  nodeEnv: string;
  corsOrigin: string;
  trustProxyHops: number;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    synchronize: boolean;
    ssl: boolean;
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
  mail: {
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPassword: string;
    smtpSecure: boolean;
    from: string;
  };
  // Public web app origin — used to build links that go *in* an email
  // (verify-email, reset-password), since the API has no view layer of
  // its own to render those pages.
  webAppUrl: string;
  storage: {
    // "local" (default, dev/demo — see uploads/local-storage.provider.ts)
    // or "s3" (S3-compatible: AWS S3, Cloudflare R2, DigitalOcean Spaces,
    // MinIO, ...). See uploads/README section in api/README.md.
    driver: "local" | "s3";
    s3: {
      bucket: string;
      region: string;
      accessKeyId: string;
      secretAccessKey: string;
      // Only needed for non-AWS S3-compatible providers (R2, MinIO, ...).
      endpoint: string;
      // Public base URL uploaded files are served from — a CDN in front
      // of the bucket, the bucket's own public URL, or the provider's
      // endpoint, depending on setup.
      publicUrlBase: string;
    };
  };
  // Crash reporting (src/error-tracking) — same "no-op unless configured"
  // shape as mail/push above. Unset by default; errors are only logged
  // locally.
  errorTracking: {
    dsn: string;
  };
  adminSecurity: {
    // Optional CIDR/exact-IP allowlist restricting which addresses an
    // isAdmin/isSuperAdmin account can log in from (see
    // auth/ip-allowlist.ts) — empty by default, meaning no restriction
    // at all, same "no-op unless configured" shape as mail/push/error
    // tracking above.
    loginIpAllowlist: string[];
  };
  assistant: {
    apiKey: string;
    apiBase: string;
    model: string;
  };
}

function nonNegativeInteger(value: string | undefined, fallback = 0): number {
  const parsed = Number.parseInt(value ?? String(fallback), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export default (): AppConfig => ({
  port: parseInt(process.env.PORT ?? "3001", 10),
  nodeEnv: process.env.NODE_ENV ?? "development",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  trustProxyHops: nonNegativeInteger(process.env.TRUST_PROXY_HOPS),
  database: {
    host: process.env.DB_HOST ?? "localhost",
    port: parseInt(process.env.DB_PORT ?? "5432", 10),
    username: process.env.DB_USERNAME ?? "liberia360",
    password: process.env.DB_PASSWORD ?? "liberia360",
    database: process.env.DB_DATABASE ?? "liberia360",
    synchronize: process.env.DB_SYNCHRONIZE === "true",
    // Off by default — a self-hosted Postgres (Railway/Render's own plugin,
    // local dev) talks plain TCP on a private network. Free managed
    // providers you'd point this at instead (Neon, Supabase, ElephantSQL,
    // ...) require TLS and refuse a non-SSL connection outright, so this
    // needs to be explicitly turned on for those via DB_SSL=true.
    ssl: process.env.DB_SSL === "true",
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
  mail: {
    smtpHost: process.env.SMTP_HOST ?? "",
    smtpPort: parseInt(process.env.SMTP_PORT ?? "587", 10),
    smtpUser: process.env.SMTP_USER ?? "",
    smtpPassword: process.env.SMTP_PASSWORD ?? "",
    smtpSecure: process.env.SMTP_SECURE === "true",
    from: process.env.MAIL_FROM ?? "LIBERIA360 <no-reply@liberia360.example>",
  },
  webAppUrl: process.env.WEB_APP_URL ?? "http://localhost:3000",
  storage: {
    driver: process.env.STORAGE_DRIVER === "s3" ? "s3" : "local",
    s3: {
      bucket: process.env.S3_BUCKET ?? "",
      region: process.env.S3_REGION ?? "auto",
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
      endpoint: process.env.S3_ENDPOINT ?? "",
      publicUrlBase: process.env.S3_PUBLIC_URL_BASE ?? "",
    },
  },
  errorTracking: {
    dsn: process.env.SENTRY_DSN ?? "",
  },
  adminSecurity: {
    loginIpAllowlist: (process.env.ADMIN_LOGIN_IP_ALLOWLIST ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  },
  assistant: {
    apiKey: process.env.OPENAI_API_KEY ?? "",
    apiBase: (
      process.env.OPENAI_API_BASE ?? "https://api.openai.com/v1"
    ).replace(/\/$/, ""),
    model: process.env.CHATBOT_MODEL ?? "gpt-5-mini",
  },
});
