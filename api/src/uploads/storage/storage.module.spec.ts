import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { StorageModule } from "./storage.module";
import { LocalStorageProvider } from "./local-storage.provider";
import { S3StorageProvider } from "./s3-storage.provider";
import { STORAGE_PROVIDER } from "./storage-provider.interface";

// LocalStorageProvider/S3StorageProvider both need a real-shaped `storage`
// config just to construct (S3StorageProvider reads .s3 in its
// constructor) — real ConfigModule + a minimal `load` function is simpler
// and less brittle here than trying to hand-mock ConfigService, since
// ConfigModule is registered `isGlobal: true` in the real app (see
// app.module.ts) and StorageModule's providers rely on that.
async function buildModule(driver: "local" | "s3") {
  const module: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        load: [
          () => ({
            storage: {
              driver,
              s3: {
                bucket: "",
                region: "auto",
                accessKeyId: "",
                secretAccessKey: "",
                endpoint: "",
                publicUrlBase: "",
              },
            },
          }),
        ],
      }),
      StorageModule,
    ],
  }).compile();
  return module;
}

describe("StorageModule", () => {
  it("selects LocalStorageProvider when STORAGE_DRIVER is local", async () => {
    const module = await buildModule("local");
    expect(module.get(STORAGE_PROVIDER)).toBeInstanceOf(LocalStorageProvider);
  });

  it("selects S3StorageProvider when STORAGE_DRIVER is s3", async () => {
    const module = await buildModule("s3");
    expect(module.get(STORAGE_PROVIDER)).toBeInstanceOf(S3StorageProvider);
  });
});
