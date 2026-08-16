import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { ConfigService } from "@nestjs/config";
import { mkdirSync } from "fs";
import { join } from "path";
import { AppModule } from "./app.module";
import { AppConfig } from "./config/configuration";
import { validateProductionConfig } from "./config/validate-production-config";

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

  // Local-disk upload storage (dev/demo only — see src/uploads/uploads.controller.ts).
  const uploadsDir = join(__dirname, "..", "uploads");
  mkdirSync(uploadsDir, { recursive: true });
  app.useStaticAssets(uploadsDir, { prefix: "/uploads" });

  app.setGlobalPrefix("api/v1", { exclude: ["health"] });

  const port = configService.get("port", { infer: true });
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`LIBERIA360 API listening on http://localhost:${port}`);
}

bootstrap();
