'use client';

import { useEffect, useRef, useState } from 'react';
import { MagnifyingGlassPlusIcon } from '@heroicons/react/24/outline';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid';
import { gradientForCategory } from '@/lib/category-colors';
import { resolveThumbUrl } from '@/lib/images';
import { CategoryIcon } from '@/lib/icons';
import { SafeImage } from './SafeImage';
import { PhotoLightbox } from './PhotoLightbox';

const SWIPE_THRESHOLD_PX = 40;
const TAP_THRESHOLD_PX = 6;
const TRANSITION_DURATION_MS = 300;

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
//
// Swipe-to-browse (Sep 2026): user feedback — visitors were reaching for
// the hero photo itself and trying to swipe it, then falling back to
// tapping thumbnails below when nothing happened. The hero was a single
// static `<button>` (tap-to-zoom only); it's now a real slide track —
// every photo sits side by side and the whole track slides on a swipe,
// the same left/right-drag interaction AdvertisementBanner already ships
// (see that component's own pointerdown/pointerup threshold logic, mirrored
// here) rather than a new pattern. Unlike that banner this doesn't loop
// past the ends — a fixed-length photo set reads more predictably as
// "you've reached the last photo" than wrapping back to the first. A tap
// that isn't a drag still opens the full-screen lightbox, so nothing a
// visitor already knew how to do stopped working.
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
  const [reducedMotion, setReducedMotion] = useState(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReducedMotion(media.matches);
    updatePreference();
    media.addEventListener?.('change', updatePreference);
    return () => media.removeEventListener?.('change', updatePreference);
  }, []);

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

  function goTo(index: number) {
    setActive(Math.min(Math.max(index, 0), images.length - 1));
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) >= SWIPE_THRESHOLD_PX && Math.abs(deltaX) > Math.abs(deltaY)) {
      goTo(active + (deltaX < 0 ? 1 : -1));
    } else if (Math.hypot(deltaX, deltaY) < TAP_THRESHOLD_PX) {
      // Barely moved at all — a tap/click, not a swipe attempt. Keeps the
      // pre-existing "tap the photo to zoom" behavior working unchanged.
      setLightboxIndex(active);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      goTo(active + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goTo(active - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setLightboxIndex(active);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-100 shadow-sm dark:border-slate-800 dark:bg-slate-800">
        <div
          role="group"
          aria-roledescription="carousel"
          aria-label={`${alt} photos`}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => {
            pointerStartRef.current = null;
          }}
          className="flex cursor-grab touch-pan-y select-none active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          style={{
            transform: `translate3d(-${active * 100}%, 0, 0)`,
            transition: reducedMotion ? 'none' : `transform ${TRANSITION_DURATION_MS}ms ease-in-out`,
          }}
        >
          {images.map((image, index) => (
            <div key={image} className="w-full shrink-0" aria-hidden={index !== active}>
              <SafeImage
                src={image}
                alt={index === active ? alt : ''}
                loading={index === 0 ? 'eager' : 'lazy'}
                // pointer-events-none: an <img> is natively draggable, and
                // the browser starting its own drag-and-drop gesture over
                // one mid-swipe fires `pointercancel` instead of
                // `pointerup` — silently swallowing the swipe before
                // handlePointerUp ever sees it. Removing the image itself
                // from hit-testing means the swipe-region ancestor below
                // gets the pointer events directly; nothing here needs the
                // image to be interactive on its own.
                className="pointer-events-none h-72 w-full object-cover sm:h-[30rem]"
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
            </div>
          ))}
        </div>
        <span className="sr-only" aria-live="polite">
          Photo {active + 1} of {images.length}
        </span>

        <button
          type="button"
          onClick={() => setLightboxIndex(active)}
          aria-label={`View ${alt} photo full-screen`}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white opacity-0 backdrop-blur-sm transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:opacity-100"
        >
          <MagnifyingGlassPlusIcon className="h-4.5 w-4.5" />
        </button>

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => goTo(active - 1)}
              disabled={active === 0}
              aria-label="Previous photo"
              className="absolute left-2 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-md transition-opacity hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:pointer-events-none disabled:opacity-0 sm:flex dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              <ChevronLeftIcon aria-hidden className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => goTo(active + 1)}
              disabled={active === images.length - 1}
              aria-label="Next photo"
              className="absolute right-2 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-md transition-opacity hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:pointer-events-none disabled:opacity-0 sm:flex dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              <ChevronRightIcon aria-hidden className="h-5 w-5" />
            </button>

            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
              {images.map((image, index) => (
                <button
                  key={image}
                  type="button"
                  onClick={() => goTo(index)}
                  aria-label={`Show photo ${index + 1} of ${images.length}`}
                  aria-current={index === active}
                  className={`pointer-events-auto h-2.5 w-2.5 rounded-full border border-white/80 transition-colors ${
                    index === active ? 'bg-white' : 'bg-white/45'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {images.map((img, i) => (
            <button
              key={img}
              type="button"
              onClick={() => goTo(i)}
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
