import type { MenuItem } from './types';
import {
  addToCart,
  cartSummary,
  describeSelections,
  lineKey,
  loadCart,
  pruneCart,
  saveCart,
  selectionError,
  setLineQuantity,
  unitPriceFor,
} from './menu-cart';

function item(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    id: 'jollof',
    businessId: 'b1',
    name: 'Jollof Rice',
    description: null,
    price: 10,
    image: null,
    category: 'Mains',
    isAvailable: true,
    sortOrder: 0,
    kind: 'food',
    tags: [],
    servingSize: null,
    containsAlcohol: false,
    optionGroups: [
      {
        id: 'size',
        name: 'Size',
        required: true,
        maxSelections: 1,
        choices: [
          { id: 'reg', name: 'Regular', priceDelta: 0 },
          { id: 'lg', name: 'Large', priceDelta: 2 },
        ],
      },
      {
        id: 'extras',
        name: 'Extras',
        required: false,
        maxSelections: 2,
        choices: [
          { id: 'egg', name: 'Egg', priceDelta: 0.5 },
          { id: 'plantain', name: 'Plantain', priceDelta: 1.25 },
        ],
      },
    ],
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('lineKey', () => {
  it('is the same regardless of selection order', () => {
    expect(
      lineKey('jollof', [
        { groupId: 'extras', choiceIds: ['plantain', 'egg'] },
        { groupId: 'size', choiceIds: ['lg'] },
      ]),
    ).toBe(lineKey('jollof', [{ groupId: 'size', choiceIds: ['lg'] }, { groupId: 'extras', choiceIds: ['egg', 'plantain'] }]));
  });

  it('is just the item id with no options', () => {
    expect(lineKey('jollof', [])).toBe('jollof');
  });
});

describe('selectionError', () => {
  it('asks for a required group', () => {
    expect(selectionError(item(), [])).toBe('Choose size');
  });

  it('caps multi-select groups', () => {
    expect(
      selectionError(
        item({ optionGroups: [{ ...item().optionGroups[1], maxSelections: 1 }] }),
        [{ groupId: 'extras', choiceIds: ['egg', 'plantain'] }],
      ),
    ).toBe('Choose up to 1 for Extras');
  });

  it('accepts complete selections', () => {
    expect(selectionError(item(), [{ groupId: 'size', choiceIds: ['reg'] }])).toBeNull();
  });

  it('flags a choice that no longer exists', () => {
    expect(selectionError(item(), [{ groupId: 'size', choiceIds: ['xl'] }])).toBe('These options are no longer available');
  });
});

describe('pricing and description', () => {
  const selections = [
    { groupId: 'size', choiceIds: ['lg'] },
    { groupId: 'extras', choiceIds: ['plantain', 'egg'] },
  ];

  it('adds every chosen delta to the base price', () => {
    expect(unitPriceFor(item(), selections)).toBe(13.75);
  });

  it('describes choices in menu order', () => {
    expect(describeSelections(item(), selections)).toBe('Large · Egg, Plantain');
  });
});

describe('cart lines', () => {
  it('merges the same item and options into one line, capped at 20', () => {
    let lines = addToCart([], 'jollof', [{ groupId: 'size', choiceIds: ['lg'] }], 15);
    lines = addToCart(lines, 'jollof', [{ groupId: 'size', choiceIds: ['lg'] }], 10);
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(20);
  });

  it('keeps different options as separate lines', () => {
    let lines = addToCart([], 'jollof', [{ groupId: 'size', choiceIds: ['lg'] }], 1);
    lines = addToCart(lines, 'jollof', [{ groupId: 'size', choiceIds: ['reg'] }], 1);
    expect(lines).toHaveLength(2);
  });

  it('removes a line set to zero', () => {
    const lines = addToCart([], 'jollof', [{ groupId: 'size', choiceIds: ['reg'] }], 2);
    expect(setLineQuantity(lines, lines[0].key, 0)).toEqual([]);
  });

  it('prunes lines invalidated by a menu change', () => {
    const lines = addToCart([], 'jollof', [{ groupId: 'size', choiceIds: ['reg'] }], 1);
    expect(pruneCart(lines, [item({ isAvailable: false })])).toEqual([]);
    expect(pruneCart(lines, [item({ optionGroups: [] })])).toEqual([]);
    expect(pruneCart(lines, [item()])).toHaveLength(1);
  });

  it('summarizes count, subtotal and alcohol', () => {
    const beer = item({ id: 'beer', price: 3, optionGroups: [], containsAlcohol: true });
    let lines = addToCart([], 'jollof', [{ groupId: 'size', choiceIds: ['lg'] }], 2);
    lines = addToCart(lines, 'beer', [], 3);
    expect(cartSummary(lines, [item(), beer])).toEqual({ count: 5, subtotal: 33, hasAlcohol: true });
  });
});

describe('cart storage', () => {
  beforeEach(() => window.localStorage.clear());

  it('round-trips a cart per business and clears an empty one', () => {
    const lines = addToCart([], 'jollof', [{ groupId: 'size', choiceIds: ['reg'] }], 1);
    saveCart('b1', lines);
    expect(loadCart('b1')).toEqual(lines);
    expect(loadCart('b2')).toEqual([]);
    saveCart('b1', []);
    expect(loadCart('b1')).toEqual([]);
  });

  it('survives corrupt storage', () => {
    window.localStorage.setItem('liberia360:menu-cart:b1', '{not json');
    expect(loadCart('b1')).toEqual([]);
  });
});
