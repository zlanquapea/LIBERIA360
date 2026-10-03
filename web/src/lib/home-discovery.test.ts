import { COLLECTIONS, collectionHref, weekendWindow, withoutShown } from './home-discovery';

describe('weekendWindow', () => {
  it('looks ahead to Friday–Sunday from midweek', () => {
    const { from, to, isNow } = weekendWindow(new Date('2026-10-07T14:00:00Z')); // Wednesday
    expect(isNow).toBe(false);
    expect(from.toISOString()).toBe('2026-10-09T00:00:00.000Z');
    expect(to.toISOString()).toBe('2026-10-11T23:59:59.999Z');
  });

  it('starts from now once the weekend has begun', () => {
    const now = new Date('2026-10-10T09:30:00Z'); // Saturday
    const { from, to, isNow } = weekendWindow(now);
    expect(isNow).toBe(true);
    expect(from).toBe(now);
    expect(to.toISOString()).toBe('2026-10-11T23:59:59.999Z');
  });

  it('ends the same day on a Sunday', () => {
    const { to } = weekendWindow(new Date('2026-10-11T20:00:00Z'));
    expect(to.toISOString()).toBe('2026-10-11T23:59:59.999Z');
  });

  it('treats Monday as the start of the wait for next weekend', () => {
    const { from } = weekendWindow(new Date('2026-10-12T08:00:00Z'));
    expect(from.toISOString()).toBe('2026-10-16T00:00:00.000Z');
  });
});

describe('collections', () => {
  it('links each collection to Explore filtered by its categories', () => {
    const nature = COLLECTIONS.find((c) => c.id === 'nature')!;
    expect(collectionHref(nature)).toBe('/explore?category=waterfalls-nature,hiking-adventure,wildlife-eco-tourism');
  });
});

describe('withoutShown', () => {
  it('drops already-shown items and keeps order', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    expect(withoutShown(items, ['b'], 2)).toEqual([{ id: 'a' }, { id: 'c' }]);
  });
});
