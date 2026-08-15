// Deterministic color per category, for the map's "colour-coded category
// pins" requirement (Tech Spec §3.1). Hash the slug instead of hard-coding
// per-category colors so new categories added later still get a stable,
// distinct color without a code change.
const PALETTE = [
  '#1f7c57', // brand green
  '#b45309', // amber
  '#1d4ed8', // blue
  '#be123c', // rose
  '#7c3aed', // violet
  '#0f766e', // teal
  '#c2410c', // orange
  '#4338ca', // indigo
  '#a16207', // yellow-brown
  '#0369a1', // sky
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

// Card/profile hero imagery (PlaceCard, the Destination Profile banner)
// used one flat green gradient for every place regardless of category —
// a hotel, a beach, and a museum all looked identical. This reuses the
// same per-category color as the map pins so imagery is visually
// distinct by category instead, with color-mix() lightening/darkening
// the category's own hue rather than reaching for a second, unrelated
// color per category.
export function gradientForCategory(slug: string): string {
  const hex = colorForCategory(slug);
  return `linear-gradient(to bottom right, color-mix(in srgb, ${hex} 72%, white), color-mix(in srgb, ${hex} 80%, black))`;
}
