import type { MenuItem } from './types';
import { businessHasMenu, groupBySection, menuKindsInOrder } from './menu';

const item = (overrides: Partial<MenuItem>): MenuItem =>
  ({
    id: Math.random().toString(),
    category: null,
    kind: 'food',
    ...overrides,
  }) as MenuItem;

describe('businessHasMenu', () => {
  it('is true for restaurants and bars only', () => {
    expect(businessHasMenu('restaurant')).toBe(true);
    expect(businessHasMenu('bar')).toBe(true);
    expect(businessHasMenu('hotel')).toBe(false);
  });
});

describe('menuKindsInOrder', () => {
  const items = [item({ kind: 'dessert' }), item({ kind: 'drink' }), item({ kind: 'food' })];

  it('leads with food for restaurants', () => {
    expect(menuKindsInOrder(items, 'restaurant')).toEqual(['food', 'drink', 'dessert']);
  });

  it('leads with drinks for bars', () => {
    expect(menuKindsInOrder(items, 'bar')).toEqual(['drink', 'food', 'dessert']);
  });

  it('skips kinds with no items', () => {
    expect(menuKindsInOrder([item({ kind: 'drink' })], 'restaurant')).toEqual(['drink']);
  });
});

describe('groupBySection', () => {
  it('keeps API order and moves uncategorized items last', () => {
    const groups = groupBySection(
      [item({ category: null, name: 'a' }), item({ category: 'Mains', name: 'b' }), item({ category: 'Soups', name: 'c' })],
      'More',
    );
    expect(groups.map((g) => g.section)).toEqual(['Mains', 'Soups', 'More']);
  });
});
