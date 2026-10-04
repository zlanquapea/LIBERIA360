import type { CarListing } from './types';

export type RentalEstimate = { days: number; total: number };

/**
 * Rough totals for common rental lengths at the listed day rate, so a
 * renter can see what a weekend or a week costs before opening the
 * booking form. Lengths under the listing's minimum are lifted to it,
 * duplicates are dropped, and extras (driver, delivery, deposit) are
 * left out — the booking form itemises those.
 */
export function rentalEstimates(
  listing: Pick<CarListing, 'pricePerDay' | 'minRentalDays'>,
  lengths: number[] = [1, 3, 7],
): RentalEstimate[] {
  const rate = Number(listing.pricePerDay);
  if (!Number.isFinite(rate) || rate <= 0) return [];
  const minimum = Math.max(1, listing.minRentalDays || 1);
  const days = [...new Set(lengths.map((d) => Math.max(d, minimum)))].sort((a, b) => a - b);
  return days.map((d) => ({ days: d, total: Math.round(rate * d * 100) / 100 }));
}
