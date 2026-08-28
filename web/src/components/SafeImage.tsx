'use client';

import { useEffect, useState } from 'react';

/**
 * Wraps a plain `<img>` (see `lib/images.ts`'s `resolveImageUrl` comment for
 * why this isn't `next/image` — uploaded images live on the API's own
 * origin, which isn't known ahead of time for `next/image`'s
 * `remotePatterns`) with the reliability behavior a raw `<img>` doesn't
 * give you for free:
 *
 * - A caller-supplied fallback renders instead of the browser's native
 *   broken-image icon, both when `src` is empty AND when the URL 404s/fails
 *   to load — previously every surface in the app only handled the first
 *   case (an absent field), never a load failure.
 * - A static skeleton look while the image is still loading, so photos
 *   don't just pop in with no loading state — see the note below on *how*
 *   that's done, which matters more than it sounds like it should.
 * - Native lazy-loading by default (`loading="lazy"`) — pass `loading="eager"`
 *   for above-the-fold images (e.g. a hero). `decoding="async"` always, so
 *   a large image decoding never blocks the main thread/paint.
 * - An optional `thumbSrc` — pass `lib/images.ts`'s `resolveThumbUrl(...)`
 *   for anywhere a photo renders small (a card, a grid cell, a thumbnail
 *   strip): the small pre-shrunk rendition loads first, and this component
 *   transparently retries with the full-size `src` if the thumbnail fails
 *   to load (a pre-thumbnail upload, or a thumbnail save that failed) —
 *   callers never need to know which rendition actually ended up on
 *   screen.
 *
 * `fallback` is deliberately caller-supplied rather than baked in here, so
 * each surface keeps its own look (PlaceCard's category gradient,
 * CreatorCard's initial-letter avatar, PhotoManager's generic broken-photo
 * icon) — this component only owns the load/error state machine.
 *
 * The loading skeleton used to be a *separate* sibling element, with the
 * real `<img>` sitting there `hidden` (`display: none`) until it loaded.
 * That doesn't work: a `loading="lazy"` image only ever starts fetching
 * once the browser's layout engine can measure it against the viewport,
 * and a `display: none` element has no box to measure — so the fetch that
 * would flip it out of "loading" could never fire in the first place. Every
 * lazily-loaded photo in the app (i.e. every card/grid thumbnail — nothing
 * short of scrolling to force a relayout could ever make one appear) was
 * silently stuck behind its own skeleton forever. Instead, the *same* `img`
 * element carries the placeholder look (a flat background color) while
 * `status === 'loading'`, and just sheds that class once it loads — one
 * element, always in real layout, so the browser can always actually
 * decide to fetch it.
 *
 * 2026-08-28: the placeholder used to also carry `animate-pulse` — a
 * continuously looping opacity animation. Removed: across a page with many
 * photos (any card grid/feed), that reads as every image on screen
 * perpetually fading in and out rather than a one-time loading cue, which
 * is exactly the "unprofessional, images keep fading" feedback this was
 * cut for. The flat background color alone still communicates "loading"
 * without animating.
 */
export function SafeImage({
  src,
  thumbSrc,
  alt,
  className,
  fallback,
  loading = 'lazy',
}: {
  src: string | null | undefined;
  /** Small rendition to try first — see the component doc comment. Falls
   * back to `src` on a load error, so it's safe to pass `null` (no
   * thumbnail exists) or a thumbnail URL that might 404. */
  thumbSrc?: string | null;
  alt: string;
  className?: string;
  fallback: React.ReactNode;
  loading?: 'lazy' | 'eager';
}) {
  const firstAttempt = (src && (thumbSrc ?? src)) || null;
  const [current, setCurrent] = useState<string | null>(firstAttempt);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(firstAttempt ? 'loading' : 'error');

  // A new src/thumbSrc (e.g. the user replaces a photo) needs its own
  // fresh loading/error cycle — otherwise a previous error/loaded state
  // would stick around and either hide the new image or skip its
  // skeleton.
  useEffect(() => {
    const next = (src && (thumbSrc ?? src)) || null;
    setCurrent(next);
    setStatus(next ? 'loading' : 'error');
  }, [src, thumbSrc]);

  function handleError() {
    // The thumbnail failed — retry once with the full-size image before
    // giving up to the caller's fallback UI (see the component doc
    // comment). Only fires when thumbSrc was actually the one that just
    // failed and src is a genuinely different URL to retry.
    if (current === thumbSrc && src && src !== current) {
      setCurrent(src);
      setStatus('loading');
      return;
    }
    setStatus('error');
  }

  if (!current || status === 'error') {
    return <>{fallback}</>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={current}
      alt={alt}
      loading={loading}
      decoding="async"
      className={`${className ?? ''} ${status === 'loading' ? 'bg-slate-200 dark:bg-slate-800' : ''}`}
      onLoad={() => setStatus('loaded')}
      onError={handleError}
    />
  );
}
