import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppConfig } from "../../config/configuration";
import { LocalStorageProvider } from "./local-storage.provider";
import { S3StorageProvider } from "./s3-storage.provider";
import { STORAGE_PROVIDER } from "./storage-provider.interface";

// Picks the StorageProvider implementation once, at boot, from
// STORAGE_DRIVER — everything downstream (UploadsController) depends only
// on the STORAGE_PROVIDER token, never on which concrete class backs it.
@Module({
  providers: [
    LocalStorageProvider,
    S3StorageProvider,
    {
      provide: STORAGE_PROVIDER,
      useFactory: (
        configService: ConfigService<AppConfig, true>,
        local: LocalStorageProvider,
        s3: S3StorageProvider,
      ) =>
        configService.get("storage", { infer: true }).driver === "s3"
          ? s3
          : local,
      inject: [ConfigService, LocalStorageProvider, S3StorageProvider],
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
