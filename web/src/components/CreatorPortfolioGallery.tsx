'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, PlayCircleIcon, XMarkIcon } from '@heroicons/react/24/solid';
import type { CreatorPortfolioItem } from '@/lib/types';
import { resolveImageUrl } from '@/lib/images';
import { SafeImage } from './SafeImage';

// The "visually appealing rather than a basic image list" gallery the spec
// asks for: category filter chips (from whatever tags the creator actually
// used — freeform, see CreatorPortfolioItem.category's doc comment),
// a responsive grid, and a real full-screen lightbox with keyboard nav.
//
// Video items aren't embedded — see CreatorPortfolioItemType's doc comment
// on the backend (link/embed-only, external URL) — they open in a new tab
// instead of an iframe, which sidesteps both the "does this URL even embed"
// parsing problem for arbitrary YouTube/Vimeo/Instagram links and any CSP
// concern with framing an untrusted third-party URL.
export function CreatorPortfolioGallery({ items }: { items: CreatorPortfolioItem[] }) {
  const categories = useMemo(
    () => Array.from(new Set(items.map((i) => i.category).filter((c): c is string => Boolean(c)))),
    [items],
  );
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const filtered = activeCategory ? items.filter((i) => i.category === activeCategory) : items;
  const imageItems = useMemo(() => filtered.filter((i) => i.type === 'image'), [filtered]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (lightboxIndex === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowRight') setLightboxIndex((i) => (i === null ? null : (i + 1) % imageItems.length));
      if (e.key === 'ArrowLeft') setLightboxIndex((i) => (i === null ? null : (i - 1 + imageItems.length) % imageItems.length));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIndex, imageItems.length]);

  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-8 text-center text-slate-500 dark:text-slate-400">
        No portfolio items yet.
      </p>
    );
  }

  const activeImage = lightboxIndex !== null ? imageItems[lightboxIndex] : null;

  return (
    <div className="flex flex-col gap-3">
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setActiveCategory(null)}
            aria-pressed={activeCategory === null}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              activeCategory === null
                ? 'border-transparent bg-brand-700 text-white'
                : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-brand-500'
            }`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setActiveCategory(c)}
              aria-pressed={activeCategory === c}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                activeCategory === c
                  ? 'border-transparent bg-brand-700 text-white'
                  : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-brand-500'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {filtered.map((item) =>
          item.type === 'image' ? (
            <button
              key={item.id}
              type="button"
              onClick={() => setLightboxIndex(imageItems.findIndex((i) => i.id === item.id))}
              className="group relative aspect-square overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800"
            >
              <SafeImage
                src={resolveImageUrl(item.url)}
                alt={item.caption ?? ''}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                fallback={<div aria-hidden className="h-full w-full bg-slate-200 dark:bg-slate-700" />}
              />
              {item.caption && (
                <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {item.caption}
                </span>
              )}
            </button>
          ) : (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative flex aspect-square flex-col items-center justify-center gap-1 rounded-lg bg-slate-900 px-2 text-center text-white transition-transform duration-300 hover:scale-[1.02]"
            >
              <PlayCircleIcon aria-hidden className="h-10 w-10" />
              <span className="line-clamp-2 text-xs">{item.caption ?? 'Watch video'}</span>
            </a>
          ),
        )}
      </div>

      {activeImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Portfolio image viewer"
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setLightboxIndex(null)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-1.5 text-white hover:bg-white/20"
          >
            <XMarkIcon aria-hidden className="h-7 w-7" />
          </button>
          {imageItems.length > 1 && (
            <button
              type="button"
              aria-label="Previous image"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex((i) => (i === null ? null : (i - 1 + imageItems.length) % imageItems.length));
              }}
              className="absolute left-2 rounded-full bg-white/10 p-1.5 text-white hover:bg-white/20 sm:left-4"
            >
              <ChevronLeftIcon aria-hidden className="h-8 w-8" />
            </button>
          )}
          <SafeImage
            src={resolveImageUrl(activeImage.url)}
            alt={activeImage.caption ?? ''}
            loading="eager"
            className="max-h-[85vh] max-w-full rounded-lg object-contain"
            fallback={
              <p className="rounded-lg bg-white/10 px-4 py-3 text-sm text-white/80">This image failed to load.</p>
            }
          />
          {imageItems.length > 1 && (
            <button
              type="button"
              aria-label="Next image"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex((i) => (i === null ? null : (i + 1) % imageItems.length));
              }}
              className="absolute right-2 rounded-full bg-white/10 p-1.5 text-white hover:bg-white/20 sm:right-4"
            >
              <ChevronRightIcon aria-hidden className="h-8 w-8" />
            </button>
          )}
          {activeImage.caption && (
            <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-sm text-white/90">
              {activeImage.caption}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
