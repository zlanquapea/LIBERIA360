import sharp, { type Stats } from "sharp";
import { cardCrop, processUploadedImage } from "./image-processing";

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

  it("downscales the card rendition to a 640px long edge", async () => {
    const input = await makeTestImage(4000, 3000);
    const result = await processUploadedImage(input);

    const metadata = await sharp(result.thumb.buffer).metadata();
    expect(metadata.width).toBe(640);
    expect(metadata.height).toBe(480); // aspect ratio preserved
  });

  it("never upscales an image smaller than the cap, in either rendition", async () => {
    const input = await makeTestImage(300, 225);
    const result = await processUploadedImage(input);

    const fullMetadata = await sharp(result.full.buffer).metadata();
    expect(fullMetadata.width).toBe(300);
    expect(fullMetadata.height).toBe(225);
    // 300px is below the 640px card cap too, so the thumbnail rendition
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
    expect(thumbMetadata.width).toBe(640); // above the 640px card cap — shrunk
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

  it("trims a panorama to 4:3 for cards but keeps the full photo whole", async () => {
    const input = await makeTestImage(3200, 1000);
    const result = await processUploadedImage(input);
    const full = await sharp(result.full.buffer).metadata();
    expect(full.width! / full.height!).toBeCloseTo(3.2, 1);
    const thumb = await sharp(result.thumb.buffer).metadata();
    expect(thumb.width! / thumb.height!).toBeCloseTo(4 / 3, 1);
  });

  it("keeps portrait photos portrait, trimming only very tall ones", async () => {
    const portrait = await processUploadedImage(await makeTestImage(900, 1200));
    const p = await sharp(portrait.thumb.buffer).metadata();
    expect(p.height! > p.width!).toBe(true);
    expect(p.width! / p.height!).toBeCloseTo(0.75, 2);

    const tall = await processUploadedImage(await makeTestImage(600, 2000));
    const t = await sharp(tall.thumb.buffer).metadata();
    expect(t.width! / t.height!).toBeCloseTo(0.75, 1);
  });

  it("evens out a flat, low-contrast photo", async () => {
    // Left half a little darker than the right: a dull, washed-out frame.
    const flat = await sharp({
      create: {
        width: 400,
        height: 300,
        channels: 3,
        background: { r: 120, g: 120, b: 120 },
      },
    })
      .composite([
        {
          input: await sharp({
            create: {
              width: 200,
              height: 300,
              channels: 3,
              background: { r: 140, g: 140, b: 140 },
            },
          })
            .png()
            .toBuffer(),
          left: 200,
          top: 0,
        },
      ])
      .png()
      .toBuffer();
    const result = await processUploadedImage(flat);
    const before = await sharp(flat).stats();
    const after = await sharp(result.full.buffer).stats();
    const spread = (st: Stats) => st.channels[0].max - st.channels[0].min;
    expect(spread(after)).toBeGreaterThan(spread(before));
  });

  it("writes progressive JPEGs", async () => {
    const result = await processUploadedImage(await makeTestImage(800, 600));
    expect((await sharp(result.full.buffer).metadata()).isProgressive).toBe(
      true,
    );
  });
});

describe("cardCrop", () => {
  it("leaves photos within 3:4–4:3 alone", () => {
    expect(cardCrop(4000, 3000)).toBeNull();
    expect(cardCrop(3000, 4000)).toBeNull();
    expect(cardCrop(1000, 1000)).toBeNull();
  });

  it("trims wide and tall images to the nearest card shape", () => {
    expect(cardCrop(1600, 900)).toEqual({ width: 1200, height: 900 });
    expect(cardCrop(900, 1600)).toEqual({ width: 900, height: 1200 });
  });
});
