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

  it("processes the upload and saves it through the injected StorageProvider", async () => {
    processUploadedImage.mockResolvedValue({
      buffer: Buffer.from("processed"),
      contentType: "image/jpeg",
      extension: "jpg",
    });
    storage.save.mockResolvedValue({ url: "/uploads/some-uuid.jpg" });

    const result = await controller.uploadImage(makeFile());

    expect(processUploadedImage).toHaveBeenCalledWith(Buffer.from("raw-bytes"));
    expect(storage.save).toHaveBeenCalledWith(
      expect.objectContaining({
        buffer: Buffer.from("processed"),
        contentType: "image/jpeg",
        filename: expect.stringMatching(/^[0-9a-f-]{36}\.jpg$/),
      }),
    );
    expect(result).toEqual({ url: "/uploads/some-uuid.jpg" });
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
});
