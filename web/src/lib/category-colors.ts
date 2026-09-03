// Deterministic color per category, for the map's "colour-coded category
// pins" requirement (Tech Spec §3.1). Hash the slug instead of hard-coding
// per-category colors so new categories added later still get a stable,
// distinct color without a code change.
//
// Redesign (Sep 3, 2026): product feedback — "the blue looks light and a
// lot of things on the home page [compete for] attention." Root cause
// traced here, not to the navy brand hero: this was a grab-bag of stock
// Tailwind primaries (a bright `#1d4ed8` blue, a `#0369a1` sky, a
// `#4338ca` indigo, sitting next to a muted `#a16207` yellow-brown and a
// deep `#0f766e` teal) with wildly inconsistent lightness/saturation. Fed
// into county icons, category icons, and card-placeholder gradients on
// the same page, that unevenness is exactly what reads as "some colors
// look light/cheap" and "too many things shouting for attention" — ten
// mismatched hues at ten different visual volumes. Replaced with a
// curated set of deep jewel tones, deliberately normalized to a similar
// lightness/chroma so every category reads as an intentional part of one
// palette rather than a random assortment — and no blue in the set is
// lighter or more washed-out than its neighbors.
const PALETTE = [
  '#0f6e4f', // emerald (echoes accent green)
  '#9a5b12', // bronze
  '#1e4d8f', // deep sapphire — a rich, saturated navy-blue, not a light one
  '#9c2b4e', // wine
  '#5b3a9e', // amethyst
  '#0d6e6e', // teal
  '#9a4a1f', // terracotta
  '#7a2f6e', // plum
  '#7a5c17', // olive-gold
  '#1f6b7a', // petrol
];

function colorForString(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function colorForCategory(slug: string): string {
  return colorForString(slug);
}

// Creator initial-letter avatars (no profile photos in this MVP) had the
// same "every card looks identical" problem as place imagery, on a
// smaller scale — every creator got the same flat green circle regardless
// of who they are. Same palette, seeded by username instead of a category
// slug, so it's still deterministic per creator without a second lookup
// table to maintain.
export function colorForCreator(username: string): string {
  return colorForString(username);
}

// County browse grid (product feedback, Aug 27, 2026 — "make the counties
// look as beautiful as the categories") reuses the same deterministic
// palette, seeded by county slug, for the colored icon badge behind each
// CountyIcon — matching CategoryGrid's treatment rather than inventing a
// second color system.
export function colorForCounty(slug: string): string {
  return colorForString(slug);
}

// Card/profile hero imagery (PlaceCard, the Destination Profile banner)
// used one flat green gradient for every place regardless of category —
// a hotel, a beach, and a museum all looked identical. This reuses the
// same per-category color as the map pins so imagery is visually
// distinct by category instead, with color-mix() lightening/darkening
// the category's own hue rather than reaching for a second, unrelated
// color per category.
//
// Redesign (Sep 3, 2026): the previous 72%/80% mix ratios pushed every
// hue most of the way to white before it ever reached the canvas, which
// is what made these placeholders look pastel/washed-out next to the
// app's navy-tinted, deep-shadow "premium" surfaces elsewhere. Pulling
// both stops back toward the source hue keeps the same white-icon-on-
// gradient contrast while reading as rich color instead of a tint.
export function gradientForCategory(slug: string): string {
  const hex = colorForCategory(slug);
  return `linear-gradient(to bottom right, color-mix(in srgb, ${hex} 82%, white), color-mix(in srgb, ${hex} 88%, black))`;
}
