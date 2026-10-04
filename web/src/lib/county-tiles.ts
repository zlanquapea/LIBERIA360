/** A tile map of Liberia's 15 counties: one equal tile each, placed
 * roughly where the county sits (northwest at top-left, the coast
 * running down to Maryland at bottom-right). Not to scale — it trades
 * true shapes for a map every county can be tapped on. */
export const COUNTY_TILES: ReadonlyArray<{ slug: string; row: number; col: number; short: string }> = [
  { slug: 'lofa', row: 0, col: 1, short: 'LO' },
  { slug: 'grand-cape-mount', row: 1, col: 0, short: 'CM' },
  { slug: 'gbarpolu', row: 1, col: 1, short: 'GP' },
  { slug: 'bong', row: 1, col: 2, short: 'BG' },
  { slug: 'nimba', row: 1, col: 3, short: 'NI' },
  { slug: 'bomi', row: 2, col: 0, short: 'BO' },
  { slug: 'montserrado', row: 2, col: 1, short: 'MO' },
  { slug: 'margibi', row: 2, col: 2, short: 'MG' },
  { slug: 'grand-bassa', row: 2, col: 3, short: 'GB' },
  { slug: 'grand-gedeh', row: 2, col: 4, short: 'GG' },
  { slug: 'river-cess', row: 3, col: 3, short: 'RI' },
  { slug: 'sinoe', row: 3, col: 4, short: 'SI' },
  { slug: 'river-gee', row: 3, col: 5, short: 'RG' },
  { slug: 'grand-kru', row: 4, col: 5, short: 'GK' },
  { slug: 'maryland', row: 4, col: 6, short: 'MY' },
];

export const TILE_COLUMNS = 7;
export const TILE_ROWS = 5;

/** 0 for no listings, then 1–4 by share of the busiest county, so even
 * one listing reads as "something here". */
export function tileLevel(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0 || max <= 0) return 0;
  const share = count / max;
  if (share > 0.75) return 4;
  if (share > 0.4) return 3;
  if (share > 0.15) return 2;
  return 1;
}
