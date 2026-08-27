import Link from 'next/link';
import { ChevronRightIcon } from '@heroicons/react/24/solid';
import type { Place } from '@/lib/types';
import { gradientForCategory } from '@/lib/category-colors';
import { resolveImageUrl } from '@/lib/images';
import { CategoryIcon } from '@/lib/icons';
import { SafeImage } from './SafeImage';

// Home's single spotlight banner — one paid "featured" placement
// (SponsoredPlacement), picked at random from every currently active one
// on each page load (see page.tsx) rather than shown as a multi-card
// shelf: with several businesses paying for the same slot, a random pick
// per view/refresh is the fairest way to share it out — a rotating
// "bidding for placement" pool instead of a first-come-forever spot or a
// crowded carousel. Full-bleed image with the details overlaid on a
// bottom gradient and an "Explore" pill, matching the shared mock-up
// layout exactly. A single <Link> wraps the whole card (like the "Plan a
// weekend" banner elsewhere on this page) — the "Explore" pill is a
// decorative `<span>`, not a nested `<button>`, so there's no invalid
// button-inside-anchor markup.
export function FeaturedDestinationCard({ place }: { place: Place }) {
  const cover = place.images[0] ? resolveImageUrl(place.images[0]) : null;

  return (
    <Link
      href={`/places/${place.slug}`}
      className="group relative block h-56 overflow-hidden rounded-2xl shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover sm:h-64"
    >
      <SafeImage
        src={cover}
        alt=""
        className="h-56 w-full object-cover transition-transform duration-500 group-hover:scale-105 sm:h-64"
        fallback={
          <div
            aria-hidden
            className="flex h-56 items-center justify-center sm:h-64"
            style={{ backgroundImage: gradientForCategory(place.category.slug) }}
          >
            <CategoryIcon iconKey={place.category.icon} categorySlug={place.category.slug} className="h-16 w-16 text-white/80" />
          </div>
        }
      />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-4 text-white">
        <h3 className="font-display text-xl font-bold leading-tight sm:text-2xl">{place.name}</h3>
        <p className="line-clamp-2 text-sm text-white/85">{place.description}</p>
        <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors group-hover:bg-emerald-700">
          Explore
          <ChevronRightIcon aria-hidden className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}
