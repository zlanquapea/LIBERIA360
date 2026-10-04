import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { BoltIcon, MapPinIcon, TruckIcon as DeliveryIcon } from '@heroicons/react/20/solid';
import { TruckIcon } from '@heroicons/react/24/solid';
import type { CarListing } from '@/lib/types';
import { gradientForCategory } from '@/lib/category-colors';
import { formatCarCategory, formatCarFuelType, formatCarTransmission, formatCost } from '@/lib/format';
import { resolveImageUrl, resolveThumbUrl } from '@/lib/images';
import { staggerDelay } from '@/lib/animation';
import { AddToTripButton } from './AddToTripButton';
import { InteractiveCard } from './InteractiveCard';
import { SafeImage } from './SafeImage';
import { VerificationSeal } from './VerificationBadge';
import { PlaceRating } from './place-card-parts';

/**
 * A car as it would sit in a showroom at night: a dark card, the car lit
 * from above with a headlight beam sweeping across on hover, a dashboard
 * row of spec cells (seats, gearbox, fuel, driver) and the day rate on a
 * glowing readout. Only approved, active listings reach this card. The
 * Add to trip control is a sibling of the card's link, never inside it.
 */
export function CarListingCard({ listing, index }: { listing: CarListing; index?: number }) {
  const t = useTranslations('carCard');
  const coverPath = listing.images[0] ?? null;
  const cover = coverPath ? resolveImageUrl(coverPath) : null;
  const coverThumb = coverPath ? resolveThumbUrl(coverPath) : null;
  const location = listing.business?.linkedPlace
    ? `${listing.business.linkedPlace.city.trim()}, ${listing.business.linkedPlace.county.name}`
    : listing.county?.name ?? null;

  const specs = [
    { label: t('seats'), value: String(listing.seats) },
    { label: t('gearbox'), value: formatCarTransmission(listing.transmission) },
    { label: t('fuel'), value: formatCarFuelType(listing.fuelType) },
    { label: t('driver'), value: listing.withDriverAvailable ? t('driverYes') : t('driverNo') },
  ];

  return (
    <div className="reveal-on-scroll h-full min-w-0" style={index != null ? staggerDelay(index) : undefined}>
      <InteractiveCard className="group relative isolate flex h-full flex-col overflow-hidden rounded-[1.5rem] bg-gradient-to-b from-slate-900 to-slate-950 text-white shadow-card ring-1 ring-white/10">
        <Link
          href={`/car-rentals/${listing.id}`}
          className="flex h-full flex-col rounded-[inherit] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-emerald-300"
        >
          {/* The stage: the car under a spotlight, on a glossy floor. */}
          <div className="relative aspect-[16/10] overflow-hidden">
            <SafeImage
              src={cover}
              thumbSrc={coverThumb}
              alt=""
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.05] motion-reduce:transition-none"
              fallback={
                <div aria-hidden className="absolute inset-0 flex items-center justify-center" style={{ backgroundImage: gradientForCategory(listing.category) }}>
                  <TruckIcon className="h-14 w-14 text-white/70" />
                </div>
              }
            />
            <span aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,rgb(255_255_255/0.25),transparent_55%)]" />
            <span aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
            <span aria-hidden className="lib-headlight" />
            <span className="absolute start-3 top-3 rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ring-1 ring-white/20 backdrop-blur-md">
              {formatCarCategory(listing.category)}
            </span>
            {(listing.instantBookEnabled || listing.deliveryAvailable) && (
              <span className="absolute bottom-3 start-3 flex flex-wrap gap-1.5">
                {listing.instantBookEnabled && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gold-400 px-2 py-0.5 text-[11px] font-bold text-slate-950 shadow">
                    <BoltIcon aria-hidden className="h-3 w-3" />
                    {t('instantBook')}
                  </span>
                )}
                {listing.deliveryAvailable && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold ring-1 ring-white/25 backdrop-blur-md">
                    <DeliveryIcon aria-hidden className="h-3 w-3" />
                    {t('delivery')}
                  </span>
                )}
              </span>
            )}
          </div>

          <div className="flex flex-1 flex-col gap-3 p-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-300/80">
                {listing.year} · {listing.make}
              </p>
              <h3 className="mt-0.5 font-display text-lg font-bold leading-snug">
                {listing.title}
                {listing.business && (
                  <>
                    {' '}
                    <VerificationSeal status={listing.business.verificationStatus} tone="onDark" />
                  </>
                )}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/60">
                {location && (
                  <span className="flex min-w-0 items-center gap-1">
                    <MapPinIcon aria-hidden className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{location}</span>
                  </span>
                )}
                <PlaceRating place={listing} />
              </div>
            </div>

            {/* Instrument cluster. */}
            <dl className="grid grid-cols-4 gap-1.5">
              {specs.map((s) => (
                <div key={s.label} className="min-w-0 rounded-xl bg-white/[0.06] px-1.5 py-2 text-center ring-1 ring-inset ring-white/10">
                  <dt className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/45">{s.label}</dt>
                  <dd className="mt-0.5 truncate text-xs font-semibold">{s.value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-auto flex items-end justify-between gap-3">
              <div className="rounded-xl bg-black/50 px-3 py-1.5 ring-1 ring-inset ring-emerald-400/20">
                <p className="lib-readout font-mono text-xl font-bold tabular-nums leading-none text-emerald-300">
                  {formatCost(listing.pricePerDay)}
                  <span className="ms-1 font-sans text-[11px] font-medium text-emerald-200/70">{t('perDay')}</span>
                </p>
                {listing.pricePerHour != null && (
                  <p className="mt-0.5 font-mono text-[11px] tabular-nums text-emerald-200/60">{t('perHour', { price: formatCost(listing.pricePerHour) })}</p>
                )}
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-white/80 transition-colors group-hover:text-emerald-300">
                {t('view')}
                <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1 rtl:-scale-x-100 motion-reduce:transition-none">→</span>
              </span>
            </div>
          </div>
        </Link>
        <div className="absolute end-2.5 top-2.5 z-10">
          <AddToTripButton contentType="carListing" itemId={listing.id} itemName={listing.title} compact />
        </div>
      </InteractiveCard>
    </div>
  );
}
