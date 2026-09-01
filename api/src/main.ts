import "reflect-metadata";
import { NestFactory, HttpAdapterHost } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { ConfigService } from "@nestjs/config";
import { mkdirSync } from "fs";
import helmet from "helmet";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { AppConfig } from "./config/configuration";
import { validateProductionConfig } from "./config/validate-production-config";
import { localUploadsDir } from "./uploads/local-uploads-dir";
import { initErrorTracking } from "./error-tracking/error-tracking";
import { SentryExceptionsFilter } from "./error-tracking/sentry-exceptions.filter";
import { StructuredLogger } from "./logging/structured-logger";

async function bootstrap() {
  // Read directly from process.env here (same fallback as
  // configuration.ts) rather than via ConfigService, which doesn't exist
  // yet — this has to be passed into NestFactory.create() itself to also
  // cover Nest's own startup logs (RouterExplorer's route-mapping lines,
  // etc.), not just this file's own logging after the app object exists.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new StructuredLogger(process.env.NODE_ENV ?? "development"),
  });
  const configService = app.get(ConfigService<AppConfig, true>);

  // Express must only honor forwarded addresses when the deployment has
  // explicitly declared how many trusted proxy hops sit in front of it.
  // Keeping the default at zero prevents clients from spoofing audit and
  // throttling addresses with an arbitrary X-Forwarded-For header.
  const trustedProxyHops = Number.parseInt(
    process.env.TRUST_PROXY_HOPS ?? "0",
    10,
  );
  if (Number.isFinite(trustedProxyHops) && trustedProxyHops > 0) {
    app.set("trust proxy", trustedProxyHops);
  }

  validateProductionConfig(configService);

  initErrorTracking(
    configService.get("errorTracking", { infer: true }).dsn,
    configService.get("nodeEnv", { infer: true }),
  );
  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new SentryExceptionsFilter(httpAdapter));

  app.use(
    helmet({
      // Helmet's default Cross-Origin-Resource-Policy (same-origin) would
      // block the web app — a different origin — from loading uploaded
      // photos via <img src>, which is the entire point of serving them
      // (see uploads/local-storage.provider.ts). Every response here is
      // meant to be fetched cross-origin by the frontend (JSON via bearer
      // token, never cookies), so there's no CSRF-adjacent reason to keep
      // the stricter default.
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.getHttpAdapter().getInstance().disable("x-powered-by");

  // Let in-flight requests finish (and TypeORM close its pool) on SIGTERM
  // instead of dropping them — the difference between a clean rolling
  // deploy and a handful of failed requests every time this restarts.
  app.enableShutdownHooks();

  app.enableCors({
    origin: configService
      .get("corsOrigin", { infer: true })
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Only relevant when STORAGE_DRIVER=local (the default) — see
  // src/uploads/storage/local-storage.provider.ts. With STORAGE_DRIVER=s3,
  // uploaded files never touch this instance's disk at all.
  if (configService.get("storage", { infer: true }).driver === "local") {
    const uploadsDir = localUploadsDir();
    mkdirSync(uploadsDir, { recursive: true });
    app.useStaticAssets(uploadsDir, { prefix: "/uploads" });
  }

  app.setGlobalPrefix("api/v1", { exclude: ["health", "health/ready"] });

  // Built from the actual DTOs/decorators already on every controller
  // (see nest-cli.json's @nestjs/swagger CLI plugin, which infers
  // @ApiProperty from class-validator decorators and pulls in existing
  // JSDoc comments — introspectComments) rather than hand-written
  // @ApiProperty/@ApiOperation annotations throughout, so this stays in
  // sync with the real request/response shapes without needing to be
  // maintained twice. Mounted after setGlobalPrefix so every generated
  // path correctly shows the real /api/v1/... route.
  if (configService.get("nodeEnv", { infer: true }) !== "production") {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("LIBERIA360 API")
      .setDescription(
        "REST API for the LIBERIA360 tourism discovery platform — see api/README.md for feature-area docs (what each module does and why).",
      )
      .setVersion("1.0")
      .addBearerAuth()
      .build();
    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("api/docs", app, swaggerDocument);
  }

  const port = configService.get("port", { infer: true });
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`LIBERIA360 API listening on http://localhost:${port}`);
}

bootstrap();
