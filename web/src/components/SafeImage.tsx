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
 * - A pulse skeleton shows while the image is still loading, so photos
 *   don't just pop in with no loading state.
 * - Native lazy-loading by default (`loading="lazy"`) — pass `loading="eager"`
 *   for above-the-fold images (e.g. a hero).
 *
 * `fallback` is deliberately caller-supplied rather than baked in here, so
 * each surface keeps its own look (PlaceCard's category gradient,
 * CreatorCard's initial-letter avatar, PhotoManager's generic broken-photo
 * icon) — this component only owns the load/error state machine.
 */
export function SafeImage({
  src,
  alt,
  className,
  fallback,
  skeletonClassName,
  loading = 'lazy',
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallback: React.ReactNode;
  /** Defaults to `className` — pass a different value if the skeleton needs
   * different sizing than the loaded image (rare). */
  skeletonClassName?: string;
  loading?: 'lazy' | 'eager';
}) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(src ? 'loading' : 'error');

  // A new src (e.g. the user replaces a photo) needs its own fresh
  // loading/error cycle — otherwise a previous error/loaded state would
  // stick around and either hide the new image or skip its skeleton.
  useEffect(() => {
    setStatus(src ? 'loading' : 'error');
  }, [src]);

  if (!src || status === 'error') {
    return <>{fallback}</>;
  }

  return (
    <>
      {status === 'loading' && (
        <div
          aria-hidden
          className={`animate-pulse bg-slate-200 dark:bg-slate-800 ${skeletonClassName ?? className ?? ''}`}
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading={loading}
        className={`${className ?? ''} ${status === 'loading' ? 'hidden' : ''}`}
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus('error')}
      />
    </>
  );
}
