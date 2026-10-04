import { leadsWithFeature, placeLocation, shortCategory } from './place-card';

describe('placeLocation', () => {
  it('trims stray spaces so it never reads "Monrovia , Montserrado"', () => {
    expect(placeLocation({ city: 'Monrovia ', county: { name: 'Montserrado' } })).toBe('Monrovia, Montserrado');
    expect(placeLocation({ city: '  Sinkor  ', county: { name: 'Montserrado' } })).toBe('Sinkor, Montserrado');
  });

  it('does not repeat the county', () => {
    expect(placeLocation({ city: 'Margibi', county: { name: 'Margibi' } })).toBe('Margibi');
    expect(placeLocation({ city: '', county: { name: 'Bong' } })).toBe('Bong');
  });
});

describe('shortCategory', () => {
  it('keeps the first part of a long category name', () => {
    expect(shortCategory('Waterfalls & Nature')).toBe('Waterfalls');
    expect(shortCategory('Salons/Barbers Shops')).toBe('Salons');
    expect(shortCategory('Nightlife')).toBe('Nightlife');
  });
});

describe('leadsWithFeature', () => {
  it('only leads with a feature tile when the grid stays gap-free', () => {
    expect([4, 5, 6, 8, 9, 13].map(leadsWithFeature)).toEqual([false, true, false, false, true, true]);
  });
});
