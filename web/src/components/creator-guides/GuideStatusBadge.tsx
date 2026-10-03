'use client';

import { useTranslations } from 'next-intl';
import type { CreatorGuideStatus } from '@/lib/types';

const STYLES: Record<CreatorGuideStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  pending_review: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100',
  published: 'bg-brand-100 text-brand-900 dark:bg-brand-900/40 dark:text-brand-100',
  rejected: 'bg-flag-500/10 text-flag-700 dark:text-flag-300',
};

export function GuideStatusBadge({ status }: { status: CreatorGuideStatus }) {
  const t = useTranslations('creatorGuides');
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STYLES[status]}`}>{t(`status_${status}`)}</span>;
}
