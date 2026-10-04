import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { BanknotesIcon, ClockIcon, MapIcon, SparklesIcon, StarIcon, TruckIcon, BookOpenIcon, HomeModernIcon } from '@heroicons/react/24/outline';
import type { Business, MenuSettings, Place } from '@/lib/types';
import type { PlaceKind } from '@/lib/place-kind';
import { estimateTravelTime, formatCost, formatDistance, formatVisitLength } from '@/lib/format';
import { LrdHint } from '@/components/LrdHint';
import { HoursStatus } from './HoursStatus';

interface Tile {
  icon: typeof ClockIcon;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}

/**
 * The four things someone deciding about this place wants first, chosen
 * per kind: entry fee and how long to spend for a sight; nightly price
 * for a stay; hours, price and menu for food. Tiles with nothing to say
 * are left out rather than filled with "not listed".
 */
export function PlaceAtAGlance({
  place,
  kind,
  business,
  menuCount = 0,
  menuSettings,
}: {
  place: Place;
  kind: PlaceKind;
  business: Business | null;
  menuCount?: number;
  menuSettings?: MenuSettings | null;
}) {
  const t = useTranslations('placeKind');
  const distance = formatDistance(place.distanceFromMonroviaKm);
  const travel = estimateTravelTime(place.distanceFromMonroviaKm);
  const priceMin = business?.priceRangeMin ?? null;
  const priceMax = business?.priceRangeMax ?? null;
  const priceRange =
    priceMin != null || priceMax != null
      ? priceMax != null && priceMin != null && priceMax > priceMin
        ? `${formatCost(priceMin)} – ${formatCost(priceMax)}`
        : formatCost(priceMin ?? priceMax)
      : null;
  const ratingTile: Tile | null =
    place.reviewCount > 0
      ? { icon: StarIcon, label: t('rating'), value: Number(place.rating).toFixed(1), hint: t('reviewCount', { count: place.reviewCount }) }
      : null;
  const fromMonrovia: Tile | null = distance
    ? { icon: MapIcon, label: t('fromMonrovia'), value: distance.replace(' from Monrovia', ''), hint: travel ?? undefined }
    : null;
  const hoursTile: Tile = {
    icon: ClockIcon,
    label: t('hoursNow'),
    value: <HoursStatus hours={place.structuredHours} fallbackText={business?.openingHours ?? place.openingHours} />,
  };

  let tiles: Array<Tile | null> = [];
  if (kind === 'destination') {
    tiles = [
      place.estimatedCostEntry != null
        ? {
            icon: BanknotesIcon,
            label: t('entry'),
            value: place.estimatedCostEntry === 0 ? t('free') : formatCost(place.estimatedCostEntry),
            hint: <LrdHint usd={place.estimatedCostEntry} />,
          }
        : null,
      formatVisitLength(place.recommendedVisitLength)
        ? { icon: ClockIcon, label: t('timeToSpend'), value: formatVisitLength(place.recommendedVisitLength) }
        : null,
      fromMonrovia,
      ratingTile,
    ];
  } else if (kind === 'stay') {
    tiles = [
      priceRange ? { icon: BanknotesIcon, label: t('perNight'), value: priceRange, hint: <LrdHint usd={priceMin ?? priceMax} usdMax={priceMax} /> } : null,
      ratingTile,
      place.amenities.length > 0 ? { icon: HomeModernIcon, label: t('amenities'), value: t('amenityCount', { count: place.amenities.length }) } : null,
      fromMonrovia,
    ];
  } else if (kind === 'eat') {
    tiles = [
      hoursTile,
      priceRange ? { icon: BanknotesIcon, label: t('priceRange'), value: priceRange, hint: <LrdHint usd={priceMin ?? priceMax} usdMax={priceMax} /> } : null,
      menuCount > 0 ? { icon: BookOpenIcon, label: t('menu'), value: t('dishCount', { count: menuCount }) } : null,
      menuSettings?.deliveryEnabled ? { icon: TruckIcon, label: t('delivery'), value: t('deliveryAvailable') } : ratingTile,
    ];
  } else {
    tiles = [hoursTile, ratingTile, fromMonrovia, place.amenities.length > 0 ? { icon: SparklesIcon, label: t('amenities'), value: t('amenityCount', { count: place.amenities.length }) } : null];
  }

  const shown = tiles.filter(Boolean) as Tile[];
  if (shown.length === 0) return null;

  return (
    <section aria-label={t('atAGlance')} className="grid grid-cols-2 gap-3 lg:grid-cols-4 max-lg:[&>*:last-child:nth-child(odd)]:col-span-2">
      {shown.map((tile) => (
        <div key={tile.label} className="flex min-w-0 flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            <tile.icon aria-hidden className="h-4 w-4 text-brand-600 dark:text-brand-400" />
            {tile.label}
          </span>
          <span className="font-display text-xl font-black leading-tight text-slate-950 dark:text-white">{tile.value}</span>
          {tile.hint && <span className="text-xs text-slate-500 dark:text-slate-400">{tile.hint}</span>}
        </div>
      ))}
    </section>
  );
}
