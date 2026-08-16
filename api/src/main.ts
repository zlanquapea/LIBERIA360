import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { ConfigService } from "@nestjs/config";
import { mkdirSync } from "fs";
import { AppModule } from "./app.module";
import { AppConfig } from "./config/configuration";
import { validateProductionConfig } from "./config/validate-production-config";
import { localUploadsDir } from "./uploads/local-uploads-dir";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService<AppConfig, true>);

  validateProductionConfig(configService);

  app.enableCors({
    origin: configService.get("corsOrigin", { infer: true }),
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

  const port = configService.get("port", { infer: true });
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`LIBERIA360 API listening on http://localhost:${port}`);
}

bootstrap();
