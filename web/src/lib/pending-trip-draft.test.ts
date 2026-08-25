import { savePendingTripDraft, takePendingTripDraft } from './pending-trip-draft';

describe('pending-trip-draft', () => {
  afterEach(() => {
    window.sessionStorage.clear();
  });

  it('returns null when nothing was ever saved', () => {
    expect(takePendingTripDraft()).toBeNull();
  });

  it('round-trips a saved draft and consumes it on read', () => {
    const draft = { durationDays: 4, budgetBand: 'premium' as const, interests: ['hiking'], title: 'Weekend' };
    savePendingTripDraft(draft);

    expect(takePendingTripDraft()).toEqual(draft);
    // Gone after the first read — a stale draft can't resurrect itself on
    // a later, unrelated visit.
    expect(takePendingTripDraft()).toBeNull();
  });

  it('ignores corrupted storage instead of throwing', () => {
    window.sessionStorage.setItem('liberia360:pending-trip-draft', '{not json');
    expect(takePendingTripDraft()).toBeNull();
  });

  it('ignores a value with the wrong shape', () => {
    window.sessionStorage.setItem('liberia360:pending-trip-draft', JSON.stringify({ foo: 'bar' }));
    expect(takePendingTripDraft()).toBeNull();
  });
});
