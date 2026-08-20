import {
  estimateTravelTime,
  formatBookingStatus,
  formatBudgetBand,
  formatBusinessType,
  formatCost,
  formatCreatorCategory,
  formatDistance,
  formatEventCategory,
  formatEventDateRange,
  formatPlaceType,
  formatPriceFrom,
  formatRating,
  formatTravelerType,
  formatVisitLength,
} from './format';

describe('formatTravelerType', () => {
  it('maps a known type to its label', () => {
    expect(formatTravelerType('diaspora')).toBe('Liberian diaspora');
  });
});

describe('formatPlaceType / formatBusinessType / formatEventCategory / formatBudgetBand / formatBookingStatus', () => {
  it('map known values to their labels', () => {
    expect(formatPlaceType('hotel')).toBe('Hotel & Lodge');
    expect(formatBusinessType('tour_operator')).toBe('Tour Operator');
    expect(formatEventCategory('nightlife')).toBe('Nightlife');
    expect(formatBudgetBand('budget')).toBe('Budget (under $10/stop)');
    expect(formatBookingStatus('confirmed')).toBe('Confirmed');
  });
});

describe('formatVisitLength', () => {
  it('formats a known length', () => {
    expect(formatVisitLength('day_trip')).toBe('Day trip');
  });

  it('returns null for null (no recommendation set)', () => {
    expect(formatVisitLength(null)).toBeNull();
  });
});

describe('formatDistance', () => {
  it('labels 0km as "In Monrovia" rather than "0 km from Monrovia"', () => {
    expect(formatDistance(0)).toBe('In Monrovia');
  });

  it('formats a positive distance', () => {
    expect(formatDistance(12)).toBe('12 km from Monrovia');
  });

  it('returns null when distance is unknown', () => {
    expect(formatDistance(null)).toBeNull();
  });
});

describe('estimateTravelTime', () => {
  it('returns null for 0km (already there) and null (unknown)', () => {
    expect(estimateTravelTime(0)).toBeNull();
    expect(estimateTravelTime(null)).toBeNull();
  });

  it('formats under an hour in minutes only', () => {
    expect(estimateTravelTime(17.5)).toBe('~30 min drive (estimated)');
  });

  it('formats over an hour as hours + minutes', () => {
    // 70km / 35km/h = 2h exactly
    expect(estimateTravelTime(70)).toBe('~2h drive (estimated)');
  });

  it('omits the minutes part when the remainder is exactly 0', () => {
    expect(estimateTravelTime(70)).not.toMatch(/0m/);
  });
});

describe('formatCost', () => {
  it('labels 0 as Free, not $0.00', () => {
    expect(formatCost(0)).toBe('Free');
  });

  it('formats a positive amount to two decimals', () => {
    expect(formatCost(12.5)).toBe('$12.50');
  });

  it('labels null as Not listed', () => {
    expect(formatCost(null)).toBe('Not listed');
  });
});

describe('formatCreatorCategory', () => {
  it('labels every category', () => {
    expect(formatCreatorCategory('photographer')).toBe('Photographer');
    expect(formatCreatorCategory('tour_guide')).toBe('Tour Guide');
    expect(formatCreatorCategory('other')).toBe('Creator');
  });
});

describe('formatPriceFrom', () => {
  it('returns null when no price is listed, not a fabricated "From $0"', () => {
    expect(formatPriceFrom(null)).toBeNull();
  });

  it('drops trailing decimals for whole-dollar amounts', () => {
    expect(formatPriceFrom(120)).toBe('From $120');
  });

  it('keeps two decimals for a fractional amount', () => {
    expect(formatPriceFrom(49.5)).toBe('From $49.50');
  });
});

describe('formatRating', () => {
  it('labels a place with no reviews rather than showing 0.0', () => {
    expect(formatRating(0, 0)).toBe('Not yet rated');
  });

  it('pluralizes review count correctly', () => {
    expect(formatRating(4.5, 1)).toBe('4.5 (1 review)');
    expect(formatRating(4.5, 2)).toBe('4.5 (2 reviews)');
  });
});

describe('formatEventDateRange', () => {
  it('formats a single-day event with just start date + time', () => {
    const result = formatEventDateRange('2026-03-15T18:00:00.000Z', null);
    expect(result).toContain('2026');
  });

  it('formats a same-day range as one date with a time range', () => {
    const result = formatEventDateRange('2026-03-15T18:00:00.000Z', '2026-03-15T22:00:00.000Z');
    expect(result).toMatch(/–|-/); // an en-dash/hyphen joins the two times
    // Only one date should appear (it's a time range, not a date range).
    expect(result.match(/2026/g)?.length).toBe(1);
  });

  it('formats a multi-day range as two dates', () => {
    const result = formatEventDateRange('2026-03-15T18:00:00.000Z', '2026-03-17T22:00:00.000Z');
    expect(result.match(/2026/g)?.length).toBe(2);
  });
});
