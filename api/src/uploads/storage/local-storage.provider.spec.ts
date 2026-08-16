import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { LocalStorageProvider } from "./local-storage.provider";
import { localUploadsDir } from "../local-uploads-dir";

jest.mock("fs/promises");
jest.mock("../local-uploads-dir");

describe("LocalStorageProvider", () => {
  const mockedMkdir = mkdir as jest.Mock;
  const mockedWriteFile = writeFile as jest.Mock;
  const mockedUploadsDir = localUploadsDir as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUploadsDir.mockReturnValue("/fake/uploads");
    mockedMkdir.mockResolvedValue(undefined);
    mockedWriteFile.mockResolvedValue(undefined);
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
});
