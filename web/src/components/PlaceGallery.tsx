'use client';

import { useState } from 'react';
import { MagnifyingGlassPlusIcon } from '@heroicons/react/24/outline';
import { gradientForCategory } from '@/lib/category-colors';
import { resolveThumbUrl } from '@/lib/images';
import { CategoryIcon } from '@/lib/icons';
import { SafeImage } from './SafeImage';
import { PhotoLightbox } from './PhotoLightbox';

// Place-detail gallery. The layout is intentionally shared only by place
// profiles: large rounded media first, then a compact selectable thumbnail
// strip. It never invents a featured label or substitute business imagery.
//
// Lightbox ("make it amazing" pass, item 5/5, Sep 3, 2026): the hero image
// used to just sit there — no way to see it any larger than this layout's
// own fixed height, on a page whose whole job is to sell someone on a
// place they haven't been to yet. Tapping it (or a thumbnail) now opens
// the same full-screen viewer CreatorPortfolioGallery already has, via
// the shared PhotoLightbox — see that component's own doc comment for why
// this didn't refactor onto CreatorPortfolioGallery's version instead.
export function PlaceGallery({
  images,
  categorySlug,
  categoryIcon,
  alt,
}: {
  images: string[];
  categorySlug: string;
  categoryIcon: string | null;
  alt: string;
}) {
  const [active, setActive] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (images.length === 0) {
    return (
      <div
        aria-hidden
        className="flex min-h-72 items-center justify-center rounded-[2rem] bg-slate-100 text-6xl dark:bg-slate-800 sm:min-h-[30rem]"
        style={{ backgroundImage: gradientForCategory(categorySlug) }}
      >
        <CategoryIcon iconKey={categoryIcon} categorySlug={categorySlug} className="h-16 w-16 text-white/90" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setLightboxIndex(active)}
        aria-label={`View ${alt} photo full-screen`}
        className="group relative overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-100 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-800 dark:bg-slate-800"
      >
        <SafeImage
          src={images[active]}
          alt={alt}
          loading="eager"
          className="h-72 w-full object-cover sm:h-[30rem]"
          fallback={
            <div
              aria-hidden
              className="flex h-72 items-center justify-center text-6xl sm:h-[30rem]"
              style={{ backgroundImage: gradientForCategory(categorySlug) }}
            >
              <CategoryIcon iconKey={categoryIcon} categorySlug={categorySlug} className="h-16 w-16 text-white/90" />
            </div>
          }
        />
        <span
          aria-hidden
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 sm:opacity-100"
        >
          <MagnifyingGlassPlusIcon className="h-4.5 w-4.5" />
        </span>
        {images.length > 1 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {images.map((image, index) => (
              <span
                key={image}
                aria-hidden
                className={`h-2.5 w-2.5 rounded-full border border-white/80 ${index === active ? 'bg-white' : 'bg-white/45'}`}
              />
            ))}
          </div>
        )}
      </button>

      {images.length > 1 && (
        <div className="flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {images.map((img, i) => (
            <button
              key={img}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Show photo ${i + 1} of ${images.length}`}
              aria-current={i === active}
              className={`h-16 w-20 shrink-0 overflow-hidden rounded-2xl border-2 bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:h-20 sm:w-24 ${
                i === active ? 'border-brand-600' : 'border-transparent'
              }`}
            >
              <SafeImage
                src={img}
                thumbSrc={resolveThumbUrl(img)}
                alt=""
                className="h-full w-full object-cover"
                fallback={<div aria-hidden className="h-full w-full bg-slate-200 dark:bg-slate-700" />}
              />
            </button>
          ))}
        </div>
      )}

      <PhotoLightbox
        images={images}
        index={lightboxIndex}
        alt={alt}
        onClose={() => setLightboxIndex(null)}
        onNavigate={(i) => {
          setLightboxIndex(i);
          setActive(i);
        }}
      />
    </div>
  );
}
