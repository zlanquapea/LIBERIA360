import { COUNTY_TILES, TILE_COLUMNS, TILE_ROWS, tileLevel } from './county-tiles';

describe('county tiles', () => {
  it('places all 15 counties once, inside the grid, with no overlaps', () => {
    expect(COUNTY_TILES).toHaveLength(15);
    expect(new Set(COUNTY_TILES.map((t) => t.slug)).size).toBe(15);
    expect(new Set(COUNTY_TILES.map((t) => `${t.row}:${t.col}`)).size).toBe(15);
    for (const t of COUNTY_TILES) {
      expect(t.row).toBeLessThan(TILE_ROWS);
      expect(t.col).toBeLessThan(TILE_COLUMNS);
    }
  });

  it('shades by share of the busiest county', () => {
    expect(tileLevel(0, 9)).toBe(0);
    expect(tileLevel(1, 9)).toBe(1);
    expect(tileLevel(3, 9)).toBe(2);
    expect(tileLevel(5, 9)).toBe(3);
    expect(tileLevel(9, 9)).toBe(4);
  });
});
