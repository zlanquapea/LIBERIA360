#!/usr/bin/env node
// Regenerates the PWA/app icon set from public/logo.png.
//
// Why this exists: logo.png is a letterhead-style lockup (emblem + wordmark
// + tagline + a big white margin, no alpha channel) — used directly as a
// raw square, it produces an ugly white box wherever it sits on the
// brand-navy background, most visibly the OS-generated PWA launch splash
// (Android/Chrome draw the manifest's `icons` entry straight over
// `background_color`). This script derives two families of icons from it:
//
//   - "any" icons (public/icons/icon-{192,512}.png, src/app/icon.png):
//     the emblem+wordmark cropped tight, "unmatted" off its white
//     background into a real alpha channel, then composited onto a white
//     rounded-rectangle card with a soft drop shadow — so it floats
//     cleanly on navy instead of sitting in a flat white box, and stays
//     legible (the logo's dark-navy strokes need a light background to
//     read against).
//   - "maskable" icons (public/icons/icon-{192,512}-maskable.png,
//     src/app/apple-icon.png): the same card, full-bled onto an *opaque*
//     navy square. Maskable icons must never rely on transparency —
//     Android crops them into a circle/squircle/rounded-square per
//     launcher, and iOS fills a transparent touch icon with black — so the
//     medallion is kept inside the ~75% "safe zone" so no launcher's mask
//     clips it.
//
// There is no separate "source" file for the medallion art — re-run this
// script against logo.png (e.g. after a rebrand) to regenerate all of the
// above in one shot.
//
// Usage:
//   node scripts/generate-app-icons.js

const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "public", "logo.png");
const OUT_ICONS = path.join(ROOT, "public", "icons");
const OUT_APP = path.join(ROOT, "src", "app");

// Crop region within logo.png (1254x1254) containing just the emblem art
// and the "LIBERIA360" wordmark — excludes the small pictogram row and the
// two lines of tagline text below it, both illegible at icon sizes.
const CROP = { left: 20, top: 130, width: 1214, height: 600 };

// Matches manifest.webmanifest's background_color/theme_color (#081a50).
const NAVY = { r: 8, g: 26, b: 80 };

// logo.png has no alpha channel — it's the artwork flattened onto solid
// white. Recover per-pixel alpha from how far each pixel is from white
// (alpha = 255 - min(r,g,b)), then unpremultiply the RGB channels so the
// recovered pixels are the true foreground color, not a whitened blend.
async function unmatteOverWhite(input) {
  const { data, info } = await sharp(input)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const out = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * channels];
    const g = data[i * channels + 1];
    const b = data[i * channels + 2];
    const minC = Math.min(r, g, b);
    const alpha = 255 - minC;
    let fr = r,
      fg = g,
      fb = b;
    if (alpha > 4) {
      const a = alpha / 255;
      fr = Math.max(0, Math.min(255, Math.round((r - (1 - a) * 255) / a)));
      fg = Math.max(0, Math.min(255, Math.round((g - (1 - a) * 255) / a)));
      fb = Math.max(0, Math.min(255, Math.round((b - (1 - a) * 255) / a)));
    }
    out[i * 4] = fr;
    out[i * 4 + 1] = fg;
    out[i * 4 + 2] = fb;
    out[i * 4 + 3] = alpha;
  }
  return { buffer: out, width, height };
}

function roundedRectSvg(w, h, r, fill, fillOpacity = 1) {
  return Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="${fill}" fill-opacity="${fillOpacity}"/></svg>`,
  );
}

async function main() {
  const cropped = await sharp(SRC).extract(CROP).toBuffer();
  const { buffer, width: bw, height: bh } = await unmatteOverWhite(cropped);
  const badgePng = await sharp(buffer, {
    raw: { width: bw, height: bh, channels: 4 },
  })
    .png()
    .toBuffer();

  // The white "card" the unmatted badge sits on, plus a soft shadow so it
  // reads as an intentional medallion rather than an accidental box.
  const padX = 100;
  const padY = 110;
  const cardW = bw + padX * 2;
  const cardH = bh + padY * 2;
  const radius = 72;

  const card = await sharp(roundedRectSvg(cardW, cardH, radius, "#FFFFFF"))
    .composite([{ input: badgePng, gravity: "center" }])
    .png()
    .toBuffer();

  const shadowBlur = 36;
  const shadowPad = shadowBlur * 3;
  const shadow = await sharp(
    roundedRectSvg(
      cardW + shadowPad * 2,
      cardH + shadowPad * 2,
      radius + shadowPad,
      "transparent",
    ),
  )
    .composite([
      {
        input: roundedRectSvg(cardW, cardH, radius, "#000000", 0.42),
        gravity: "center",
      },
    ])
    .blur(shadowBlur)
    .png()
    .toBuffer();

  // "any" master: transparent background, sized generously so the shadow
  // layer (card + shadow padding on every side) always fits inside it.
  const anySide = 1750;
  const anyMaster = await sharp({
    create: {
      width: anySide,
      height: anySide,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: shadow,
        gravity: "center",
        top:
          Math.round((anySide - (cardH + shadowPad * 2)) / 2) + 16,
        left: Math.round((anySide - (cardW + shadowPad * 2)) / 2),
      },
      { input: card, gravity: "center" },
    ])
    .png()
    .toBuffer();

  for (const size of [512, 192]) {
    await sharp(anyMaster)
      .resize(size, size)
      .png()
      .toFile(path.join(OUT_ICONS, `icon-${size}.png`));
  }
  await sharp(anyMaster)
    .resize(512, 512)
    .png()
    .toFile(path.join(OUT_APP, "icon.png"));

  // Maskable master: same medallion, full-bled onto an opaque navy square
  // (never transparent — see header comment) with the medallion kept well
  // inside the safe zone so launcher masks never clip it.
  const maskSide = 2100;
  const maskableMaster = await sharp({
    create: {
      width: maskSide,
      height: maskSide,
      channels: 4,
      background: { r: NAVY.r, g: NAVY.g, b: NAVY.b, alpha: 1 },
    },
  })
    .composite([{ input: anyMaster, gravity: "center" }])
    .flatten({ background: { r: NAVY.r, g: NAVY.g, b: NAVY.b } })
    .png()
    .toBuffer();

  for (const size of [512, 192]) {
    await sharp(maskableMaster)
      .resize(size, size)
      .png()
      .toFile(path.join(OUT_ICONS, `icon-${size}-maskable.png`));
  }
  await sharp(maskableMaster)
    .resize(180, 180)
    .png()
    .toFile(path.join(OUT_APP, "apple-icon.png"));

  console.log("Generated app icons from public/logo.png.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
