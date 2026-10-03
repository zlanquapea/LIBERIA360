import { formatMoney, formatPriceIn, otherCurrency } from '@/lib/currency';
import type { MenuCurrency } from '@/lib/types';

// The real price in the menu's own currency, with a muted estimate in the
// other one — Liberians pay in both, so neither should need mental math.
export function MenuPrice({
  amount,
  currency,
  rate,
  className = '',
  estimateClassName = 'text-slate-400 dark:text-slate-500',
}: {
  amount: number;
  currency: MenuCurrency;
  rate: number | null;
  className?: string;
  estimateClassName?: string;
}) {
  const estimate = rate ? formatPriceIn(amount, currency, otherCurrency(currency), rate) : null;
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-1.5 ${className}`}>
      <span>{formatMoney(amount, currency)}</span>
      {estimate && <span className={`text-[0.8em] font-medium ${estimateClassName}`}>{estimate}</span>}
    </span>
  );
}
