import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { County } from '@/lib/types';
import { SectionHeading } from './SectionHeading';

// All 15 counties at a glance, busiest first, each with its real place
// count. Counties without listings yet stay visible (and say so) so the
// whole country is represented, not just where the catalog is today.
export async function CountyExplorer({ counties }: { counties: County[] }) {
  const t = await getTranslations('discover');
  const sorted = [...counties].sort(
    (a, b) => (b.placeCount ?? 0) - (a.placeCount ?? 0) || a.name.localeCompare(b.name),
  );
  const max = Math.max(1, ...sorted.map((c) => c.placeCount ?? 0));

  return (
    <section aria-labelledby="counties-heading" className="flex flex-col gap-5">
      <SectionHeading
        id="counties-heading"
        eyebrow={t('countiesEyebrow')}
        title={t('countiesTitle')}
        href="/counties"
        linkLabel={t('seeAll')}
      />
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {sorted.map((county) => {
          const count = county.placeCount ?? 0;
          return (
            <li key={county.id}>
              <Link
                href={`/counties/${county.slug}`}
                className={`group flex h-full flex-col gap-2 rounded-2xl border p-3.5 transition-all hover:-translate-y-0.5 hover:shadow-card motion-reduce:transition-none motion-reduce:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-300 ${
                  count > 0
                    ? 'border-brand-200 bg-white dark:border-brand-800 dark:bg-slate-900'
                    : 'border-slate-200 bg-white/50 dark:border-slate-800 dark:bg-slate-900/50'
                }`}
              >
                <span className="font-display text-base font-bold text-slate-900 group-hover:text-brand-700 dark:text-slate-50 dark:group-hover:text-brand-300">
                  {county.name}
                </span>
                <span className={`text-xs font-semibold ${count > 0 ? 'text-brand-700 dark:text-brand-300' : 'text-slate-400'}`}>
                  {t('countyPlaces', { count })}
                </span>
                {/* Relative catalog depth, decorative. */}
                <span aria-hidden className="mt-auto h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <span
                    className="block h-full rounded-full bg-gradient-to-r from-brand-500 to-sunset-400"
                    style={{ width: `${count > 0 ? Math.max(8, (count / max) * 100) : 0}%` }}
                  />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
