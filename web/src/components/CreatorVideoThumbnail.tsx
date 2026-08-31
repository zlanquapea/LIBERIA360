'use client';

import { useEffect, useRef, useState } from 'react';
import { PlayCircleIcon } from '@heroicons/react/24/solid';

export function CreatorVideoThumbnail({
  src,
  poster,
  label,
  autoplayOnView = false,
}: {
  src: string;
  poster?: string | null;
  label: string;
  autoplayOnView?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const isVisibleRef = useRef(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (poster) setReady(true);
    const video = videoRef.current;
    if (!video) return;
    const media = video;

    function showFirstFrame() {
      setReady(true);
    }

    function seekToOpeningFrame() {
      if (media.readyState >= 2 && media.currentTime === 0) {
        try {
          media.currentTime = 0.1;
        } catch {
          // Some remote streams do not allow seeking during metadata load.
        }
      }
    }

    media.addEventListener('loadeddata', showFirstFrame);
    media.addEventListener('loadedmetadata', seekToOpeningFrame);
    media.addEventListener('seeked', showFirstFrame);
    return () => {
      media.removeEventListener('loadeddata', showFirstFrame);
      media.removeEventListener('loadedmetadata', seekToOpeningFrame);
      media.removeEventListener('seeked', showFirstFrame);
    };
  }, [poster]);

  useEffect(() => {
    if (!autoplayOnView || reducedMotion) return;
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container || !video) return;
    video.muted = true;
    const tryPlay = () => {
      if (!isVisibleRef.current || reducedMotion) return;
      void video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting && entry.intersectionRatio >= 0.6;
        isVisibleRef.current = visible;
        if (visible) tryPlay();
        else {
          video.pause();
          setPlaying(false);
        }
      },
      { threshold: [0, 0.25, 0.6, 1], rootMargin: '0px 0px -8% 0px' },
    );
    observer.observe(container);
    return () => {
      observer.disconnect();
      video.pause();
      setPlaying(false);
    };
  }, [autoplayOnView, reducedMotion]);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-slate-950">
      <video
        ref={videoRef}
        src={src}
        preload={autoplayOnView ? 'auto' : 'metadata'}
        poster={poster ?? undefined}
        muted
        loop
        playsInline
        autoPlay={autoplayOnView && !reducedMotion}
        aria-label={label}
        onCanPlay={() => {
          if (autoplayOnView && isVisibleRef.current && !reducedMotion) {
            void videoRef.current?.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
          }
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        className={`h-full w-full object-cover transition-opacity duration-200 ${ready ? 'opacity-100' : 'opacity-0'}`}
      />
      {!ready && <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-slate-950 via-brand-950 to-slate-800" />}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10" />
      {!playing && (
        <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-brand-900 shadow-lg">
          <PlayCircleIcon aria-hidden className="h-10 w-10" />
        </span>
      )}
      <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">{playing ? 'Playing preview' : 'Video'}</span>
    </div>
  );
}
