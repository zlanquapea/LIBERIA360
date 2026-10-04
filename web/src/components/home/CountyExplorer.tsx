import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { County } from '@/lib/types';
import { COUNTY_TILES, TILE_COLUMNS, TILE_ROWS, tileLevel } from '@/lib/county-tiles';
import { SectionHeading } from './SectionHeading';

const TILE_CLASS = [
  'border border-dashed border-slate-300 bg-white/70 text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400',
  'bg-brand-100 text-brand-900 dark:bg-brand-900/70 dark:text-brand-100',
  'bg-brand-300 text-brand-950 dark:bg-brand-700 dark:text-white',
  'bg-brand-500 text-white dark:bg-brand-600',
  'bg-brand-700 text-white dark:bg-brand-500',
] as const;

// All 15 counties at a glance, each with its real place count. From
// tablet width up they sit on a tile map of the country; on phones the
// busiest-first list is easier to tap. Counties without listings yet stay
// visible (and say so) so the whole country is represented, not just
// where the catalog is today.
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
      <CountyTileMap counties={counties} max={max} label={t('countyMapLabel')} countLabel={(n) => t('countyPlaces', { count: n })} notToScale={t('countyMapNote')} sea={t('countyMapSea')} legendNone={t('countyMapNone')} legendMore={t('countyMapMore')} />
      <ul className="grid grid-cols-2 gap-2.5 sm:hidden">
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

function CountyTileMap({
  counties,
  max,
  label,
  countLabel,
  notToScale,
  sea,
  legendNone,
  legendMore,
}: {
  counties: County[];
  max: number;
  label: string;
  countLabel: (count: number) => string;
  notToScale: string;
  sea: string;
  legendNone: string;
  legendMore: string;
}) {
  const bySlug = new Map(counties.map((c) => [c.slug, c]));
  return (
    <div className="hidden flex-col gap-3 sm:flex">
      <div
        className="lib-tilemap relative mx-auto grid w-full max-w-3xl gap-2 rounded-[1.75rem] border border-slate-200 p-4 lg:gap-2.5 lg:p-6 dark:border-slate-800"
        style={{ gridTemplateColumns: `repeat(${TILE_COLUMNS}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${TILE_ROWS}, minmax(0, 1fr))` }}
      >
        <p className="sr-only">{label}</p>
        <span
          aria-hidden
          className="pointer-events-none self-end ps-1 font-display text-sm italic tracking-wide text-sky-700/60 dark:text-sky-300/50"
          style={{ gridRow: '4 / span 2', gridColumn: '1 / span 3' }}
        >
          {sea}
        </span>
        {COUNTY_TILES.map((tile) => {
          const county = bySlug.get(tile.slug);
          if (!county) return null;
          const count = county.placeCount ?? 0;
          const level = tileLevel(count, max);
          return (
            <Link
              key={tile.slug}
              href={`/counties/${county.slug}`}
              aria-label={`${county.name}: ${countLabel(count)}`}
              style={{ gridRow: tile.row + 1, gridColumn: tile.col + 1 }}
              className={`group flex aspect-square min-w-0 flex-col justify-between rounded-2xl p-2 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-card focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-300 motion-reduce:transition-none motion-reduce:hover:translate-y-0 lg:p-2.5 ${TILE_CLASS[level]}`}
            >
              <span className="font-display text-[0.7rem] font-bold leading-tight sm:text-xs lg:text-[0.8rem]">{county.name}</span>
              <span aria-hidden className="text-lg font-black leading-none tabular-nums lg:text-2xl">
                {count}
              </span>
            </Link>
          );
        })}
      </div>
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5" aria-hidden>
          {legendNone}
          {TILE_CLASS.map((cls, i) => (
            <span key={i} className={`h-3.5 w-3.5 rounded ${cls}`} />
          ))}
          {legendMore}
        </span>
        <span>{notToScale}</span>
      </div>
    </div>
  );
}
