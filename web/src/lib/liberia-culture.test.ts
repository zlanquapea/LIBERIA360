import { findDishes } from './liberian-dishes';
import { PHRASES, phraseOfTheDay } from './liberian-english';

describe('findDishes', () => {
  it('spots dishes by name, ignoring case and spelling variants', () => {
    expect(findDishes('Palm Butter & rice', 'served with DUMBOY').map((d) => d.id)).toEqual(['palmButter', 'dumboy']);
    expect(findDishes('Palaver sauce with fish').map((d) => d.id)).toEqual(['palavaSauce']);
  });

  it('matches whole words only', () => {
    expect(findDishes('Kalamazoo burger')).toEqual([]);
    expect(findDishes('Fresh kala every morning').map((d) => d.id)).toEqual(['kala']);
  });

  it('copes with nothing to read', () => {
    expect(findDishes(null, undefined, '')).toEqual([]);
  });
});

describe('phraseOfTheDay', () => {
  it('is the same all day and changes the next day', () => {
    const morning = phraseOfTheDay(new Date('2026-10-04T01:00:00Z'));
    const evening = phraseOfTheDay(new Date('2026-10-04T23:00:00Z'));
    const tomorrow = phraseOfTheDay(new Date('2026-10-05T01:00:00Z'));
    expect(morning).toBe(evening);
    expect(tomorrow).not.toBe(morning);
  });

  it('cycles through every phrase', () => {
    const seen = new Set<string>();
    for (let d = 0; d < PHRASES.length; d++) {
      seen.add(phraseOfTheDay(new Date(Date.UTC(2026, 0, 1 + d))).id);
    }
    expect(seen.size).toBe(PHRASES.length);
  });
});
