'use client';

import { useEffect } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, XMarkIcon } from '@heroicons/react/24/solid';
import { SafeImage } from './SafeImage';

// "Make it amazing" pass, item 5/5: CreatorPortfolioGallery already has a
// real full-screen lightbox (keyboard nav, prev/next, close) — this is
// that same pattern factored out so PlaceGallery (place + business detail
// pages) can get it too, rather than a second bespoke copy or a new
// dependency. CreatorPortfolioGallery keeps its own inline version rather
// than being refactored onto this — it interleaves video items into the
// same grid in a way this simpler images-only component doesn't need to
// handle, and it already works; no reason to risk it for a rename.
export function PhotoLightbox({
  images,
  index,
  alt,
  onClose,
  onNavigate,
}: {
  images: string[];
  index: number | null;
  alt: string;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  useEffect(() => {
    if (index === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onNavigate(((index ?? 0) + 1) % images.length);
      if (e.key === 'ArrowLeft') onNavigate(((index ?? 0) - 1 + images.length) % images.length);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-registering per index change is intentional, matching CreatorPortfolioGallery's own lightbox effect
  }, [index, images.length]);

  if (index === null) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${alt} photo viewer`}
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white/10 p-1.5 text-white hover:bg-white/20"
      >
        <XMarkIcon aria-hidden className="h-7 w-7" />
      </button>
      {images.length > 1 && (
        <button
          type="button"
          aria-label="Previous photo"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate((index - 1 + images.length) % images.length);
          }}
          className="absolute left-2 rounded-full bg-white/10 p-1.5 text-white hover:bg-white/20 sm:left-4"
        >
          <ChevronLeftIcon aria-hidden className="h-8 w-8" />
        </button>
      )}
      <SafeImage
        src={images[index]}
        alt={`${alt} — photo ${index + 1} of ${images.length}`}
        loading="eager"
        className="max-h-[85vh] max-w-full rounded-lg object-contain"
        fallback={
          <p className="rounded-lg bg-white/10 px-4 py-3 text-sm text-white/80">This photo failed to load.</p>
        }
      />
      {images.length > 1 && (
        <button
          type="button"
          aria-label="Next photo"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate((index + 1) % images.length);
          }}
          className="absolute right-2 rounded-full bg-white/10 p-1.5 text-white hover:bg-white/20 sm:right-4"
        >
          <ChevronRightIcon aria-hidden className="h-8 w-8" />
        </button>
      )}
      {images.length > 1 && (
        <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-sm text-white/90">
          {index + 1} / {images.length}
        </p>
      )}
    </div>
  );
}
