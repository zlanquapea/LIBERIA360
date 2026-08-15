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
});
