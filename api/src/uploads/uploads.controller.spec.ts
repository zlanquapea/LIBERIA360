import { BadRequestException } from "@nestjs/common";
import { UploadsController } from "./uploads.controller";
import { StorageProvider } from "./storage/storage-provider.interface";
import * as imageProcessing from "./image-processing";

jest.mock("./image-processing");

function makeFile(
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File {
  return {
    buffer: Buffer.from("raw-bytes"),
    originalname: "photo.jpg",
    mimetype: "image/jpeg",
    fieldname: "file",
    encoding: "7bit",
    size: 9,
    stream: undefined as never,
    destination: "",
    filename: "",
    path: "",
    ...overrides,
  };
}

describe("UploadsController", () => {
  let storage: { save: jest.Mock };
  let controller: UploadsController;
  const processUploadedImage =
    imageProcessing.processUploadedImage as jest.Mock;

  beforeEach(() => {
    storage = { save: jest.fn() };
    controller = new UploadsController(storage as unknown as StorageProvider);
    processUploadedImage.mockReset();
  });

  it("rejects when no file is present", async () => {
    await expect(
      controller.uploadImage(undefined as unknown as Express.Multer.File),
    ).rejects.toThrow(BadRequestException);
    expect(processUploadedImage).not.toHaveBeenCalled();
  });

  it("processes the upload and saves both renditions through the injected StorageProvider", async () => {
    processUploadedImage.mockResolvedValue({
      full: {
        buffer: Buffer.from("processed-full"),
        contentType: "image/jpeg",
        extension: "jpg",
      },
      thumb: {
        buffer: Buffer.from("processed-thumb"),
        contentType: "image/jpeg",
        extension: "jpg",
      },
    });
    storage.save.mockImplementation(({ filename }: { filename: string }) =>
      Promise.resolve({ url: `/uploads/${filename}` }),
    );

    const result = await controller.uploadImage(makeFile());

    expect(processUploadedImage).toHaveBeenCalledWith(Buffer.from("raw-bytes"));
    expect(storage.save).toHaveBeenCalledTimes(2);
    expect(storage.save).toHaveBeenCalledWith(
      expect.objectContaining({
        buffer: Buffer.from("processed-full"),
        contentType: "image/jpeg",
        filename: expect.stringMatching(/^[0-9a-f-]{36}\.jpg$/),
      }),
    );
    expect(storage.save).toHaveBeenCalledWith(
      expect.objectContaining({
        buffer: Buffer.from("processed-thumb"),
        contentType: "image/jpeg",
        filename: expect.stringMatching(/^[0-9a-f-]{36}-thumb\.jpg$/),
      }),
    );
    // Both renditions share one UUID base, so the frontend can derive the
    // thumbnail's URL from the returned full URL alone.
    const fullFilename = storage.save.mock.calls[0][0].filename as string;
    const thumbFilename = storage.save.mock.calls[1][0].filename as string;
    expect(thumbFilename).toBe(fullFilename.replace(/\.jpg$/, "-thumb.jpg"));
    expect(result).toEqual({ url: `/uploads/${fullFilename}` });
  });

  it("still returns the full-size URL when the thumbnail save fails (best-effort)", async () => {
    processUploadedImage.mockResolvedValue({
      full: {
        buffer: Buffer.from("processed-full"),
        contentType: "image/jpeg",
        extension: "jpg",
      },
      thumb: {
        buffer: Buffer.from("processed-thumb"),
        contentType: "image/jpeg",
        extension: "jpg",
      },
    });
    storage.save.mockImplementation(({ filename }: { filename: string }) =>
      filename.includes("-thumb")
        ? Promise.reject(new Error("disk full"))
        : Promise.resolve({ url: `/uploads/${filename}` }),
    );

    const result = await controller.uploadImage(makeFile());

    expect(result.url).toMatch(/^\/uploads\/[0-9a-f-]{36}\.jpg$/);
  });

  it("turns a processing failure (corrupted/fake image) into a 400, not a 500", async () => {
    processUploadedImage.mockRejectedValue(
      new Error("Input buffer contains unsupported image format"),
    );

    await expect(controller.uploadImage(makeFile())).rejects.toThrow(
      BadRequestException,
    );
    expect(storage.save).not.toHaveBeenCalled();
  });

  it("rejects a missing video file", async () => {
    await expect(
      controller.uploadVideo(undefined as unknown as Express.Multer.File),
    ).rejects.toThrow(BadRequestException);
    expect(storage.save).not.toHaveBeenCalled();
  });

  it("rejects a video whose declared MIME type is not allowed", async () => {
    await expect(
      controller.uploadVideo(
        makeFile({ mimetype: "text/plain", buffer: Buffer.from("not-video") }),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(storage.save).not.toHaveBeenCalled();
  });

  it("rejects a renamed non-video file even when its MIME type is allowed", async () => {
    await expect(
      controller.uploadVideo(
        makeFile({ mimetype: "video/mp4", buffer: Buffer.from("not-video") }),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(storage.save).not.toHaveBeenCalled();
  });

  it("stores a valid MP4 video with a unique extension", async () => {
    storage.save.mockImplementation(({ filename }: { filename: string }) =>
      Promise.resolve({ url: `/uploads/${filename}` }),
    );
    const mp4Header = Buffer.concat([
      Buffer.alloc(4),
      Buffer.from("ftyp"),
      Buffer.alloc(16),
    ]);

    const result = await controller.uploadVideo(
      makeFile({ mimetype: "video/mp4", buffer: mp4Header }),
    );

    expect(storage.save).toHaveBeenCalledTimes(1);
    expect(storage.save).toHaveBeenCalledWith(
      expect.objectContaining({
        buffer: mp4Header,
        contentType: "video/mp4",
        filename: expect.stringMatching(/^[0-9a-f-]{36}\.mp4$/),
      }),
    );
    expect(result.url).toMatch(/^\/uploads\/[0-9a-f-]{36}\.mp4$/);
  });
});
