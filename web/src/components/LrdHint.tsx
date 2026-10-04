'use client';

import { useTranslations } from 'next-intl';
import { useLrdRate } from '@/hooks/useLrdRate';
import { lrdHint } from '@/lib/lrd';

/** A quiet "≈ L$…" next to a US$ price, so visitors can think in the
 * money people actually hand over. Renders nothing until an admin sets
 * the rate on Travel info. */
export function LrdHint({ usd, usdMax, className = '' }: { usd: number | null | undefined; usdMax?: number | null; className?: string }) {
  const t = useTranslations('common');
  const rate = useLrdRate();
  const hint = lrdHint(usd, rate, usdMax);
  if (!hint || rate === null) return null;
  return (
    <span className={`whitespace-nowrap text-slate-500 dark:text-slate-400 ${className}`} title={t('lrdRateNote', { rate })}>
      {hint}
    </span>
  );
}
