import type { MenuCurrency } from './types';

const USD_FORMAT = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// LRD prices are almost always whole dollars; only show cents when the
// owner actually entered some.
const LRD_FORMAT = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function formatMoney(amount: number, currency: MenuCurrency): string {
  return currency === 'USD' ? `US$${USD_FORMAT.format(amount)}` : `L$${LRD_FORMAT.format(amount)}`;
}

export function otherCurrency(currency: MenuCurrency): MenuCurrency {
  return currency === 'USD' ? 'LRD' : 'USD';
}

/** null when there's no usable rate to convert with. */
export function convertMoney(
  amount: number,
  from: MenuCurrency,
  to: MenuCurrency,
  usdToLrdRate: number | null | undefined,
): number | null {
  if (from === to) return amount;
  if (!usdToLrdRate || usdToLrdRate <= 0) return null;
  return from === 'USD' ? amount * usdToLrdRate : amount / usdToLrdRate;
}

/** A price in `display`, converting from the menu's own currency when
 * they differ. Converted LRD rounds to whole dollars since it's an
 * estimate anyway. Falls back to the original currency without a rate. */
export function formatPriceIn(
  amount: number,
  menuCurrency: MenuCurrency,
  display: MenuCurrency,
  usdToLrdRate: number | null | undefined,
): string {
  const converted = convertMoney(amount, menuCurrency, display, usdToLrdRate);
  if (converted === null) return formatMoney(amount, menuCurrency);
  if (display === menuCurrency) return formatMoney(amount, menuCurrency);
  return `≈ ${formatMoney(display === 'LRD' ? Math.round(converted) : converted, display)}`;
}
