import Link from 'next/link';
import type { Place } from '@/lib/types';
import { gradientForCategory } from '@/lib/category-colors';
import { resolveImageUrl, resolveThumbUrl } from '@/lib/images';
import { CategoryIcon } from '@/lib/icons';
import { SafeImage } from './SafeImage';

// Hero visual hook ("make it amazing" pass, Sep 3, 2026): the hero's dark
// gradient + skyline SVG has carried the whole visual weight of the page's
// first screen on its own, entirely without imagery — by deliberate choice
// (see the layout-pass note atop app/page.tsx: no *stock*-photo dependency
// anywhere in the app, since a generic tourism stock photo would look
// exactly as fake as it is). That reasoning doesn't apply here: these are
// real photos of real catalog places passed in by the caller, not
// decorative filler, so using them is consistent with the app's own
// "no stock photography" principle rather than a violation of it — a new
// visitor gets an honest, concrete answer to "what does this actually look
// like" instead of only a headline and an abstract skyline.
//
// A fixed 2-column/3-row bento layout (one tall tile, three stacked)
// rather than a plain even grid — enough visual rhythm to not read as a
// generic photo dump, without needing a carousel or any client-side JS.
// Each tile degrades exactly the way PlaceCardCompact does — the same
// category-color gradient + icon fallback — so a place caught mid-upload
// or still awaiting photos (see the Data Quality Audit) never renders as a
// broken image; the grid always looks intentional even when the
// underlying catalog data is uneven. Desktop-only (see the `hidden lg:flex`
// wrapper at the call site) — mobile's hero is already tuned tight against
// the page's own "too much competing for attention" history, and a phone
// visitor reaches real photo grids one scroll away regardless.
const TILE_POSITION = [
  'col-start-1 row-start-1 row-span-3',
  'col-start-2 row-start-1',
  'col-start-2 row-start-2',
  'col-start-2 row-start-3',
];

export function HeroPhotoMosaic({ places }: { places: Place[] }) {
  if (places.length === 0) return null;

  return (
    <div className="grid h-72 grid-cols-2 grid-rows-3 gap-3 sm:h-80">
      {places.slice(0, 4).map((place, i) => {
        const cover = place.images[0] ? resolveImageUrl(place.images[0]) : null;
        const coverThumb = place.images[0] ? resolveThumbUrl(place.images[0]) : null;
        return (
          <Link
            key={place.id}
            href={`/places/${place.slug}`}
            className={`group relative overflow-hidden rounded-2xl shadow-lg ring-1 ring-white/10 transition-transform duration-300 hover:-translate-y-0.5 ${TILE_POSITION[i]}`}
          >
            <SafeImage
              src={cover}
              thumbSrc={coverThumb}
              alt=""
              loading={i === 0 ? 'eager' : 'lazy'}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              fallback={
                <div
                  aria-hidden
                  className="flex h-full w-full items-center justify-center"
                  style={{ backgroundImage: gradientForCategory(place.category.slug) }}
                >
                  <CategoryIcon iconKey={place.category.icon} categorySlug={place.category.slug} className="h-8 w-8 text-white/90" />
                </div>
              }
            />
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent p-2.5 pt-6"
            >
              <p className="truncate text-xs font-semibold text-white">{place.name}</p>
              <p className="truncate text-[11px] text-white/70">{place.city}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
