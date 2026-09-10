import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import { join } from "path";
import { LocalStorageProvider } from "./local-storage.provider";
import { localUploadsDir } from "../local-uploads-dir";
import { localPrivateUploadsDir } from "../local-private-uploads-dir";

jest.mock("fs/promises");
jest.mock("../local-uploads-dir");
jest.mock("../local-private-uploads-dir");

describe("LocalStorageProvider", () => {
  const mockedMkdir = mkdir as jest.Mock;
  const mockedWriteFile = writeFile as jest.Mock;
  const mockedReadFile = readFile as jest.Mock;
  const mockedUnlink = unlink as jest.Mock;
  const mockedUploadsDir = localUploadsDir as jest.Mock;
  const mockedPrivateUploadsDir = localPrivateUploadsDir as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUploadsDir.mockReturnValue("/fake/uploads");
    mockedPrivateUploadsDir.mockReturnValue("/fake/private-uploads");
    mockedMkdir.mockResolvedValue(undefined);
    mockedWriteFile.mockResolvedValue(undefined);
    mockedReadFile.mockResolvedValue(Buffer.from("fake-bytes"));
    mockedUnlink.mockResolvedValue(undefined);
  });

  it("writes the buffer into the uploads directory and returns a root-relative URL", async () => {
    const provider = new LocalStorageProvider();
    const result = await provider.save({
      buffer: Buffer.from("fake-jpeg-bytes"),
      filename: "abc123.jpg",
      contentType: "image/jpeg",
    });

    expect(mockedMkdir).toHaveBeenCalledWith("/fake/uploads", {
      recursive: true,
    });
    expect(mockedWriteFile).toHaveBeenCalledWith(
      join("/fake/uploads", "abc123.jpg"),
      Buffer.from("fake-jpeg-bytes"),
    );
    expect(result).toEqual({ url: "/uploads/abc123.jpg" });
  });

  it("creates a nested prefix's subdirectory for a namespaced key", async () => {
    const provider = new LocalStorageProvider();
    const result = await provider.save({
      buffer: Buffer.from("fake-pdf-bytes"),
      filename: "prescriptions/abc123.pdf",
      contentType: "application/pdf",
    });

    expect(mockedMkdir).toHaveBeenCalledWith("/fake/uploads/prescriptions", {
      recursive: true,
    });
    expect(mockedWriteFile).toHaveBeenCalledWith(
      join("/fake/uploads", "prescriptions", "abc123.pdf"),
      Buffer.from("fake-pdf-bytes"),
    );
    expect(result).toEqual({ url: "/uploads/prescriptions/abc123.pdf" });
  });

  it("refuses a key that would escape the uploads directory", async () => {
    const provider = new LocalStorageProvider();

    await expect(
      provider.save({
        buffer: Buffer.from("x"),
        filename: "../../etc/passwd",
        contentType: "text/plain",
      }),
    ).rejects.toThrow("Invalid storage key");
    expect(mockedWriteFile).not.toHaveBeenCalled();
  });

  it("savePrivate() writes under the private uploads directory and returns a key, not a URL", async () => {
    const provider = new LocalStorageProvider();
    const result = await provider.savePrivate({
      buffer: Buffer.from("fake-prescription-bytes"),
      filename: "prescriptions/abc123.jpg",
      contentType: "image/jpeg",
    });

    expect(mockedMkdir).toHaveBeenCalledWith(
      "/fake/private-uploads/prescriptions",
      { recursive: true },
    );
    expect(mockedWriteFile).toHaveBeenCalledWith(
      join("/fake/private-uploads", "prescriptions", "abc123.jpg"),
      Buffer.from("fake-prescription-bytes"),
    );
    expect(result).toEqual({ key: "prescriptions/abc123.jpg" });
  });

  it("savePrivate() refuses a key that would escape the private uploads directory", async () => {
    const provider = new LocalStorageProvider();

    await expect(
      provider.savePrivate({
        buffer: Buffer.from("x"),
        filename: "../../etc/passwd",
        contentType: "text/plain",
      }),
    ).rejects.toThrow("Invalid storage key");
    expect(mockedWriteFile).not.toHaveBeenCalled();
  });

  it("readPrivate() reads the file back from the private uploads directory", async () => {
    const provider = new LocalStorageProvider();
    const result = await provider.readPrivate("prescriptions/abc123.jpg");

    expect(mockedReadFile).toHaveBeenCalledWith(
      join("/fake/private-uploads", "prescriptions", "abc123.jpg"),
    );
    expect(result).toEqual({ buffer: Buffer.from("fake-bytes") });
  });

  it("readPrivate() refuses a key that would escape the private uploads directory", async () => {
    const provider = new LocalStorageProvider();

    await expect(provider.readPrivate("../../etc/passwd")).rejects.toThrow(
      "Invalid storage key",
    );
    expect(mockedReadFile).not.toHaveBeenCalled();
  });

  it("deletePrivate() unlinks the file from the private uploads directory", async () => {
    const provider = new LocalStorageProvider();
    await provider.deletePrivate("prescriptions/abc123.jpg");

    expect(mockedUnlink).toHaveBeenCalledWith(
      join("/fake/private-uploads", "prescriptions", "abc123.jpg"),
    );
  });

  it("deletePrivate() swallows an already-gone file instead of throwing", async () => {
    const provider = new LocalStorageProvider();
    const enoent = Object.assign(new Error("no such file"), {
      code: "ENOENT",
    });
    mockedUnlink.mockRejectedValue(enoent);

    await expect(
      provider.deletePrivate("prescriptions/gone.jpg"),
    ).resolves.toBeUndefined();
  });

  it("deletePrivate() still surfaces a non-ENOENT failure", async () => {
    const provider = new LocalStorageProvider();
    mockedUnlink.mockRejectedValue(
      Object.assign(new Error("permission denied"), { code: "EACCES" }),
    );

    await expect(
      provider.deletePrivate("prescriptions/locked.jpg"),
    ).rejects.toThrow("permission denied");
  });

  it("deletePrivate() refuses a key that would escape the private uploads directory", async () => {
    const provider = new LocalStorageProvider();

    await expect(provider.deletePrivate("../../etc/passwd")).rejects.toThrow(
      "Invalid storage key",
    );
    expect(mockedUnlink).not.toHaveBeenCalled();
  });
});
