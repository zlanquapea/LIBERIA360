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
  it("re-encodes both renditions to JPEG", async () => {
    const input = await makeTestImage(400, 300);
    const result = await processUploadedImage(input);

    expect(result.full.contentType).toBe("image/jpeg");
    expect(result.full.extension).toBe("jpg");
    expect(result.thumb.contentType).toBe("image/jpeg");
    expect(result.thumb.extension).toBe("jpg");
    const fullMetadata = await sharp(result.full.buffer).metadata();
    const thumbMetadata = await sharp(result.thumb.buffer).metadata();
    expect(fullMetadata.format).toBe("jpeg");
    expect(thumbMetadata.format).toBe("jpeg");
  });

  it("downscales an oversized image to a 1600px long edge for the full rendition", async () => {
    const input = await makeTestImage(4000, 3000);
    const result = await processUploadedImage(input);

    const metadata = await sharp(result.full.buffer).metadata();
    expect(metadata.width).toBe(1600);
    expect(metadata.height).toBe(1200); // aspect ratio preserved
  });

  it("downscales the thumbnail rendition to a 480px long edge", async () => {
    const input = await makeTestImage(4000, 3000);
    const result = await processUploadedImage(input);

    const metadata = await sharp(result.thumb.buffer).metadata();
    expect(metadata.width).toBe(480);
    expect(metadata.height).toBe(360); // aspect ratio preserved
  });

  it("never upscales an image smaller than the cap, in either rendition", async () => {
    const input = await makeTestImage(300, 225);
    const result = await processUploadedImage(input);

    const fullMetadata = await sharp(result.full.buffer).metadata();
    expect(fullMetadata.width).toBe(300);
    expect(fullMetadata.height).toBe(225);
    // 300px is below the 480px thumb cap too, so the thumbnail rendition
    // stays unscaled as well (see the next test for the case where it
    // isn't).
    const thumbMetadata = await sharp(result.thumb.buffer).metadata();
    expect(thumbMetadata.width).toBe(300);
    expect(thumbMetadata.height).toBe(225);
  });

  it("shrinks only the thumbnail rendition when the source is between the two caps", async () => {
    const input = await makeTestImage(1000, 750);
    const result = await processUploadedImage(input);

    const fullMetadata = await sharp(result.full.buffer).metadata();
    expect(fullMetadata.width).toBe(1000); // below the 1600px full cap — untouched
    const thumbMetadata = await sharp(result.thumb.buffer).metadata();
    expect(thumbMetadata.width).toBe(480); // above the 480px thumb cap — shrunk
  });

  it("rejects an image below the minimum dimension floor", async () => {
    const input = await makeTestImage(120, 80);
    await expect(processUploadedImage(input)).rejects.toThrow(
      /at least 200x200/,
    );
  });

  it("accepts an image exactly at the minimum dimension floor", async () => {
    const input = await makeTestImage(200, 200);
    const result = await processUploadedImage(input);
    const metadata = await sharp(result.full.buffer).metadata();
    expect(metadata.width).toBe(200);
    expect(metadata.height).toBe(200);
  });

  it("strips EXIF metadata from both renditions", async () => {
    const input = await makeTestImage(400, 300, true);
    const inputMetadata = await sharp(input).metadata();
    expect(inputMetadata.exif).toBeDefined(); // sanity check the fixture actually has EXIF

    const result = await processUploadedImage(input);
    const fullMetadata = await sharp(result.full.buffer).metadata();
    const thumbMetadata = await sharp(result.thumb.buffer).metadata();
    expect(fullMetadata.exif).toBeUndefined();
    expect(thumbMetadata.exif).toBeUndefined();
  });

  it("rejects a buffer that isn't a real image", async () => {
    await expect(
      processUploadedImage(Buffer.from("not an image")),
    ).rejects.toThrow();
  });
});
