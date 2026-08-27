'use client';

import { useState } from 'react';
import { gradientForCategory } from '@/lib/category-colors';
import { resolveThumbUrl } from '@/lib/images';
import { CategoryIcon } from '@/lib/icons';
import { SafeImage } from './SafeImage';

// Place-detail gallery. The layout is intentionally shared only by place
// profiles: large rounded media first, then a compact selectable thumbnail
// strip. It never invents a featured label or substitute business imagery.
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
      <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-100 shadow-sm dark:border-slate-800 dark:bg-slate-800">
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
      </div>

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
    </div>
  );
}
