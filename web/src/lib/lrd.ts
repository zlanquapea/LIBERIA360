const LRD_FORMAT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** Rounds a converted amount so it reads like a price people quote in
 * Monrovia: whole dollars under 100, nearest 10 under 1,000, nearest 50
 * above. It's an estimate, so false precision only gets in the way. */
export function roundLrd(amount: number): number {
  if (amount < 100) return Math.round(amount);
  if (amount < 1000) return Math.round(amount / 10) * 10;
  return Math.round(amount / 50) * 50;
}

function usable(rate: number | string | null | undefined): number | null {
  const n = Number(rate);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** "≈ L$1,950" (or a range) for a US$ price, or null when there's no
 * admin-set rate or nothing to convert (missing or free). */
export function lrdHint(
  usd: number | null | undefined,
  rate: number | string | null | undefined,
  usdMax?: number | null,
): string | null {
  const r = usable(rate);
  if (r === null || usd == null || !(usd > 0)) return null;
  const low = `L$${LRD_FORMAT.format(roundLrd(usd * r))}`;
  if (usdMax != null && usdMax > usd) {
    return `≈ ${low} – L$${LRD_FORMAT.format(roundLrd(usdMax * r))}`;
  }
  return `≈ ${low}`;
}
