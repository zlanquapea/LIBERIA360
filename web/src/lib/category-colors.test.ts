import { colorForCategory, colorForCreator, gradientForCategory } from './category-colors';

describe('colorForCategory', () => {
  it('is deterministic for the same slug', () => {
    expect(colorForCategory('beaches')).toBe(colorForCategory('beaches'));
  });

  it('returns a valid hex color', () => {
    expect(colorForCategory('beaches')).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('gives different categories a good chance of different colors (not a constant)', () => {
    const slugs = ['beaches', 'culture-heritage', 'nightlife', 'nature', 'food', 'adventure'];
    const colors = new Set(slugs.map(colorForCategory));
    // With a 10-color palette and 6 inputs, seeing only 1 unique color
    // back would mean the hash isn't actually varying by input.
    expect(colors.size).toBeGreaterThan(1);
  });
});

describe('colorForCreator', () => {
  it('is deterministic for the same username', () => {
    expect(colorForCreator('monrovia_explorer')).toBe(colorForCreator('monrovia_explorer'));
  });

  it('uses the same palette/hash as colorForCategory for the same input string', () => {
    // Both are backed by the same seeded hash — a category slug and a
    // creator username that happen to be equal strings should agree.
    expect(colorForCreator('beaches')).toBe(colorForCategory('beaches'));
  });
});

describe('gradientForCategory', () => {
  it('produces a CSS linear-gradient built from the category color', () => {
    const gradient = gradientForCategory('beaches');
    expect(gradient).toContain('linear-gradient');
    expect(gradient).toContain(colorForCategory('beaches'));
  });
});
