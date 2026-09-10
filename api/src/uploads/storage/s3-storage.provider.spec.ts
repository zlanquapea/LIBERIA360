import { ConfigService } from "@nestjs/config";
import { AppConfig } from "../../config/configuration";

const mockSend = jest.fn();
jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn().mockImplementation((options: unknown) => ({
    send: mockSend,
    __options: options,
  })),
  PutObjectCommand: jest.fn().mockImplementation((input: unknown) => ({
    __command: "PutObjectCommand",
    input,
  })),
  GetObjectCommand: jest.fn().mockImplementation((input: unknown) => ({
    __command: "GetObjectCommand",
    input,
  })),
}));

// Imported after the mock above so the module under test picks up the
// mocked SDK, not the real one.
import { S3StorageProvider } from "./s3-storage.provider";

function buildProvider(s3Overrides: Partial<Record<string, string>> = {}) {
  const s3Config = {
    bucket: "test-bucket",
    region: "auto",
    accessKeyId: "key",
    secretAccessKey: "secret",
    endpoint: "",
    publicUrlBase: "https://cdn.example.com/",
    ...s3Overrides,
  };
  const configService = {
    get: jest.fn().mockReturnValue({ s3: s3Config }),
  } as unknown as ConfigService<AppConfig, true>;
  return new S3StorageProvider(configService);
}

describe("S3StorageProvider", () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockSend.mockResolvedValue({});
  });

  it("uploads the buffer and returns a URL built from publicUrlBase", async () => {
    const provider = buildProvider();
    const result = await provider.save({
      buffer: Buffer.from("fake-jpeg-bytes"),
      filename: "abc123.jpg",
      contentType: "image/jpeg",
    });

    expect(mockSend).toHaveBeenCalledTimes(1);
    const command = mockSend.mock.calls[0][0];
    expect(command.input).toMatchObject({
      Bucket: "test-bucket",
      Key: "abc123.jpg",
      ContentType: "image/jpeg",
    });
    // Trailing slash on the configured base is normalized away, so the
    // result is never a double slash before the filename.
    expect(result).toEqual({ url: "https://cdn.example.com/abc123.jpg" });
  });

  it("strips a trailing slash from publicUrlBase before joining the filename", async () => {
    const provider = buildProvider({
      publicUrlBase: "https://cdn.example.com",
    });
    const result = await provider.save({
      buffer: Buffer.from("x"),
      filename: "f.jpg",
      contentType: "image/jpeg",
    });
    expect(result.url).toBe("https://cdn.example.com/f.jpg");
  });

  it("savePrivate() uploads under a private/ prefix and returns a key, not a URL", async () => {
    const provider = buildProvider();
    const result = await provider.savePrivate({
      buffer: Buffer.from("fake-prescription-bytes"),
      filename: "prescriptions/abc123.jpg",
      contentType: "image/jpeg",
    });

    expect(mockSend).toHaveBeenCalledTimes(1);
    const command = mockSend.mock.calls[0][0];
    expect(command.input).toMatchObject({
      Bucket: "test-bucket",
      Key: "private/prescriptions/abc123.jpg",
      ContentType: "image/jpeg",
    });
    expect(result).toEqual({ key: "private/prescriptions/abc123.jpg" });
  });

  it("readPrivate() fetches the object and returns its bytes as a Buffer", async () => {
    const provider = buildProvider();
    mockSend.mockResolvedValue({
      Body: {
        transformToByteArray: jest
          .fn()
          .mockResolvedValue(Uint8Array.from(Buffer.from("fake-bytes"))),
      },
    });

    const result = await provider.readPrivate(
      "private/prescriptions/abc123.jpg",
    );

    expect(mockSend).toHaveBeenCalledTimes(1);
    const command = mockSend.mock.calls[0][0];
    expect(command.input).toEqual({
      Bucket: "test-bucket",
      Key: "private/prescriptions/abc123.jpg",
    });
    expect(result).toEqual({ buffer: Buffer.from("fake-bytes") });
  });
});
