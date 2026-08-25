'use client';

import { useState } from 'react';
import { gradientForCategory } from '@/lib/category-colors';
import { resolveThumbUrl } from '@/lib/images';
import { CategoryIcon } from '@/lib/icons';
import { SafeImage } from './SafeImage';

// Destination profile hero. Real photos are the point — a traveler
// deciding on a hotel wants to see the room and the pool, not a category
// icon — but plenty of listings genuinely have no photos yet (freshly
// seeded, not yet claimed), so this falls back to the existing
// gradient+icon placeholder rather than showing an empty box.
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
        className="flex h-40 items-center justify-center rounded-2xl text-6xl"
        style={{ backgroundImage: gradientForCategory(categorySlug) }}
      >
        <CategoryIcon iconKey={categoryIcon} className="h-14 w-14 text-white/90" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800">
        <SafeImage
          src={images[active]}
          alt={alt}
          loading="eager"
          className="h-64 w-full object-cover sm:h-80"
          fallback={
            <div
              aria-hidden
              className="flex h-64 items-center justify-center text-6xl sm:h-80"
              style={{ backgroundImage: gradientForCategory(categorySlug) }}
            >
              <CategoryIcon iconKey={categoryIcon} className="h-14 w-14 text-white/90" />
            </div>
          }
        />
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={img}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Show photo ${i + 1} of ${images.length}`}
              aria-current={i === active}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 ${
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
