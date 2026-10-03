import { suggestBusinessType } from './business-categories';

describe('suggestBusinessType', () => {
  it('defaults Nightlife places to the bar type whatever their place type', () => {
    expect(suggestBusinessType({ type: 'restaurant', category: { slug: 'nightlife' } })).toBe('bar');
    expect(suggestBusinessType({ type: 'attraction', category: { slug: 'nightlife' } })).toBe('bar');
  });

  it('falls back to the place type mapping otherwise', () => {
    expect(suggestBusinessType({ type: 'restaurant', category: { slug: 'food-dining' } })).toBe('restaurant');
    expect(suggestBusinessType({ type: 'hotel', category: null })).toBe('hotel');
    expect(suggestBusinessType({ type: 'nature_site' })).toBe('tour_operator');
  });
});
