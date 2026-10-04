import { rentalEstimates } from './car-estimates';

describe('rentalEstimates', () => {
  it('prices 1, 3 and 7 days at the day rate', () => {
    expect(rentalEstimates({ pricePerDay: 60, minRentalDays: 1 })).toEqual([
      { days: 1, total: 60 },
      { days: 3, total: 180 },
      { days: 7, total: 420 },
    ]);
  });

  it('lifts lengths under the minimum to it and drops duplicates', () => {
    expect(rentalEstimates({ pricePerDay: 45.5, minRentalDays: 3 })).toEqual([
      { days: 3, total: 136.5 },
      { days: 7, total: 318.5 },
    ]);
  });

  it('returns nothing without a usable day rate', () => {
    expect(rentalEstimates({ pricePerDay: 0, minRentalDays: 1 })).toEqual([]);
    expect(rentalEstimates({ pricePerDay: Number.NaN, minRentalDays: 1 })).toEqual([]);
  });
});
