import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppConfig } from "../../config/configuration";
import { LocalStorageProvider } from "./local-storage.provider";
import type { S3StorageProvider } from "./s3-storage.provider";
import {
  STORAGE_PROVIDER,
  StorageProvider,
} from "./storage-provider.interface";

// Picks the StorageProvider implementation once, at boot, from
// STORAGE_DRIVER — everything downstream (UploadsController) depends only
// on the STORAGE_PROVIDER token, never on which concrete class backs it.
//
// Only the selected provider is ever constructed, and the S3 one is only
// *loaded* when it's the one selected (type-only import above, `require`
// below): the AWS SDK costs several MB of heap just to import, which a
// STORAGE_DRIVER=local deployment would otherwise carry for the life of
// the process without ever making an S3 call.
@Module({
  providers: [
    {
      provide: STORAGE_PROVIDER,
      useFactory: (
        configService: ConfigService<AppConfig, true>,
      ): StorageProvider => {
        if (configService.get("storage", { infer: true }).driver !== "s3") {
          return new LocalStorageProvider();
        }
        const { S3StorageProvider: S3 } =
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require("./s3-storage.provider") as {
            S3StorageProvider: typeof S3StorageProvider;
          };
        return new S3(configService);
      },
      inject: [ConfigService],
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
