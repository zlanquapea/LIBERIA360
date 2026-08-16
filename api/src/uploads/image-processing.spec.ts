import sharp from "sharp";
import { processUploadedImage } from "./image-processing";

async function makeTestImage(
  width: number,
  height: number,
  withExif = false,
): Promise<Buffer> {
  const image = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 50, b: 50 },
    },
  });
  if (withExif) {
    // A real EXIF block (as a phone photo would carry) — enough to prove
    // processUploadedImage's output doesn't retain it.
    return image
      .withExif({ IFD0: { Make: "TestCam", Model: "Model 1" } })
      .jpeg()
      .toBuffer();
  }
  return image.png().toBuffer();
}

describe("processUploadedImage", () => {
  it("re-encodes to JPEG", async () => {
    const input = await makeTestImage(400, 300);
    const result = await processUploadedImage(input);

    expect(result.contentType).toBe("image/jpeg");
    expect(result.extension).toBe("jpg");
    const metadata = await sharp(result.buffer).metadata();
    expect(metadata.format).toBe("jpeg");
  });

  it("downscales an oversized image to a 2000px long edge", async () => {
    const input = await makeTestImage(4000, 3000);
    const result = await processUploadedImage(input);

    const metadata = await sharp(result.buffer).metadata();
    expect(metadata.width).toBe(2000);
    expect(metadata.height).toBe(1500); // aspect ratio preserved
  });

  it("never upscales an image smaller than the cap", async () => {
    const input = await makeTestImage(200, 150);
    const result = await processUploadedImage(input);

    const metadata = await sharp(result.buffer).metadata();
    expect(metadata.width).toBe(200);
    expect(metadata.height).toBe(150);
  });

  it("strips EXIF metadata from the output", async () => {
    const input = await makeTestImage(400, 300, true);
    const inputMetadata = await sharp(input).metadata();
    expect(inputMetadata.exif).toBeDefined(); // sanity check the fixture actually has EXIF

    const result = await processUploadedImage(input);
    const outputMetadata = await sharp(result.buffer).metadata();
    expect(outputMetadata.exif).toBeUndefined();
  });

  it("rejects a buffer that isn't a real image", async () => {
    await expect(
      processUploadedImage(Buffer.from("not an image")),
    ).rejects.toThrow();
  });
});
