import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { County } from '@/lib/types';
import { COUNTY_TILES, TILE_COLUMNS, TILE_ROWS } from '@/lib/county-tiles';

/**
 * "Where is it?" — the home page's tile map of Liberia, shrunk to a
 * locator: this county lit up in sunset orange, every other county a
 * quiet tile that links to its own page. Not to scale (see county-tiles).
 */
export function CountyLocator({ counties, currentSlug, tone = 'onDark' }: { counties: County[]; currentSlug: string; tone?: 'onDark' | 'onLight' }) {
  const t = useTranslations('countyPage');
  const bySlug = new Map(counties.map((c) => [c.slug, c]));
  const idle =
    tone === 'onDark'
      ? 'bg-white/10 text-white/70 ring-1 ring-inset ring-white/15 hover:bg-white/20 hover:text-white'
      : 'bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200 hover:bg-brand-50 hover:text-brand-800 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700';

  return (
    <figure className="flex flex-col gap-2">
      <div
        className="relative grid gap-1"
        style={{ gridTemplateColumns: `repeat(${TILE_COLUMNS}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${TILE_ROWS}, minmax(0, 1fr))` }}
      >
        <span
          aria-hidden
          className={`pointer-events-none self-end ps-0.5 font-display text-[10px] italic ${tone === 'onDark' ? 'text-sky-200/60' : 'text-sky-700/60 dark:text-sky-300/50'}`}
          style={{ gridRow: '5', gridColumn: '1 / span 3' }}
        >
          {t('ocean')}
        </span>
        {COUNTY_TILES.map((tile) => {
          const county = bySlug.get(tile.slug);
          if (!county) return null;
          const current = tile.slug === currentSlug;
          return (
            <Link
              key={tile.slug}
              href={`/counties/${county.slug}`}
              aria-label={county.name}
              aria-current={current ? 'page' : undefined}
              title={county.name}
              style={{ gridRow: tile.row + 1, gridColumn: tile.col + 1 }}
              className={`flex aspect-square items-center justify-center rounded-md text-[9px] font-bold tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300 sm:text-[10px] ${
                current ? 'lib-locator-pulse bg-sunset-500 text-white shadow-lg shadow-sunset-500/40' : idle
              }`}
            >
              {tile.short}
            </Link>
          );
        })}
      </div>
      <figcaption className={`text-[11px] ${tone === 'onDark' ? 'text-white/50' : 'text-slate-500 dark:text-slate-400'}`}>{t('notToScale')}</figcaption>
    </figure>
  );
}
