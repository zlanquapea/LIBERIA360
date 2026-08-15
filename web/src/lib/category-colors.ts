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

export function colorForCategory(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash << 5) - hash + slug.charCodeAt(i);
    hash |= 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
