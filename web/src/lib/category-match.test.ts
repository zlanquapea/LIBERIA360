import { findMatchingCategory } from './category-match';
import type { Category } from './types';

function category(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat-1',
    name: 'Beaches',
    slug: 'beaches',
    description: null,
    icon: null,
    ...overrides,
  };
}

describe('findMatchingCategory', () => {
  const beaches = category();
  const culture = category({ id: 'cat-2', name: 'Culture & Heritage', slug: 'culture-heritage' });
  const categories = [beaches, culture];

  it('matches a plural query against a singular category word (and vice versa)', () => {
    expect(findMatchingCategory(categories, 'beach')).toBe(beaches);
    expect(findMatchingCategory(categories, 'Beaches')).toBe(beaches);
  });

  it('matches a word from a multi-word category name', () => {
    expect(findMatchingCategory(categories, 'culture')).toBe(culture);
    expect(findMatchingCategory(categories, 'heritage')).toBe(culture);
  });

  it('matches a known alias for a category', () => {
    expect(findMatchingCategory(categories, 'surf')).toBe(beaches);
    expect(findMatchingCategory(categories, 'museum')).toBe(culture);
  });

  it('returns null for a multi-word query, even one that would otherwise match', () => {
    expect(findMatchingCategory(categories, 'beach vacation')).toBeNull();
  });

  it('returns null when nothing matches', () => {
    expect(findMatchingCategory(categories, 'nonexistentxyz')).toBeNull();
  });

  it('returns null for an empty or whitespace-only query', () => {
    expect(findMatchingCategory(categories, '')).toBeNull();
    expect(findMatchingCategory(categories, '   ')).toBeNull();
  });
});
