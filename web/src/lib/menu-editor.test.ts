import { draftError, draftFromItem, draftToInput, emptyDraft, presetGroup } from './menu-editor';
import type { MenuItem } from './types';

const item: MenuItem = {
  id: 'i1',
  businessId: 'b1',
  name: 'Mojito',
  description: null,
  price: 6,
  image: null,
  category: 'Cocktails',
  isAvailable: true,
  sortOrder: 0,
  kind: 'drink',
  tags: ['popular'],
  servingSize: null,
  containsAlcohol: true,
  optionGroups: [
    {
      id: 'g1',
      name: 'Rum',
      required: true,
      maxSelections: 1,
      choices: [
        { id: 'c1', name: 'House', priceDelta: 0 },
        { id: 'c2', name: 'Premium', priceDelta: 2.5 },
      ],
    },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('menu-editor', () => {
  it('round-trips an item and keeps server ids so existing carts still match', () => {
    const input = draftToInput(draftFromItem(item));
    expect(input).toMatchObject({
      name: 'Mojito',
      price: 6,
      kind: 'drink',
      tags: ['popular'],
      containsAlcohol: true,
      description: '',
      servingSize: '',
      image: '',
    });
    expect(input.optionGroups).toEqual([
      {
        id: 'g1',
        name: 'Rum',
        required: true,
        maxSelections: 1,
        choices: [
          { id: 'c1', name: 'House', priceDelta: 0 },
          { id: 'c2', name: 'Premium', priceDelta: 2.5 },
        ],
      },
    ]);
  });

  it('omits ids for new groups and caps maxSelections at the choice count', () => {
    const draft = { ...emptyDraft(), name: 'Rice', price: '5', groups: [{ ...presetGroup('addons'), maxSelections: 9 }] };
    const [group] = draftToInput(draft).optionGroups!;
    expect(group).not.toHaveProperty('id');
    expect(group.choices[0]).not.toHaveProperty('id');
    expect(group.maxSelections).toBe(2);
  });

  it('reports the first blocking problem in reading order', () => {
    expect(draftError(emptyDraft())).toBe('Give the item a name');
    expect(draftError({ ...emptyDraft(), name: 'Rice', price: '-1' })).toBe('Enter a valid price');
    const unnamed = { ...emptyDraft(), name: 'Rice', price: '5', groups: [presetGroup('blank')] };
    expect(draftError(unnamed)).toBe('Name option group 1 (e.g. Size, Add-ons)');
    const blankChoice = { ...unnamed, groups: [{ ...presetGroup('blank'), name: 'Sides' }] };
    expect(draftError(blankChoice)).toBe('Every choice in Sides needs a name');
    expect(draftError({ ...emptyDraft(), name: 'Rice', price: '5', groups: [presetGroup('size')] })).toBeNull();
  });
});
