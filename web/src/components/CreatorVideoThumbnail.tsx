"use client";

import { useEffect, useRef, useState } from "react";
import { PlayCircleIcon } from "@heroicons/react/24/solid";

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
  const [ready, setReady] = useState(Boolean(poster));
  const [playing, setPlaying] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const isVisibleRef = useRef(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const showFirstFrame = () => setReady(true);
    const seekToOpeningFrame = () => {
      if (!poster && video.readyState >= 2 && video.currentTime === 0) {
        try {
          video.currentTime = 0.1;
        } catch {
          // Some remote files do not allow seeking during metadata load.
        }
      }
    };

    video.addEventListener("loadeddata", showFirstFrame);
    video.addEventListener("loadedmetadata", seekToOpeningFrame);
    video.addEventListener("seeked", showFirstFrame);
    return () => {
      video.removeEventListener("loadeddata", showFirstFrame);
      video.removeEventListener("loadedmetadata", seekToOpeningFrame);
      video.removeEventListener("seeked", showFirstFrame);
    };
  }, [poster]);

  useEffect(() => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!autoplayOnView || !container || !video) return;

    video.muted = true;
    const tryPlay = () => {
      if (!isVisibleRef.current || reducedMotion) return;
      void video.play().then(
        () => setPlaying(true),
        () => setPlaying(false),
      );
    };

    if (reducedMotion) {
      video.pause();
      setPlaying(false);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting && entry.intersectionRatio >= 0.6;
        isVisibleRef.current = visible;
        if (visible) {
          tryPlay();
        } else {
          video.pause();
          video.currentTime = 0;
          setPlaying(false);
        }
      },
      { threshold: [0, 0.6, 1] },
    );

    observer.observe(container);
    return () => {
      isVisibleRef.current = false;
      observer.disconnect();
      video.pause();
      video.currentTime = 0;
      setPlaying(false);
    };
  }, [autoplayOnView, reducedMotion]);

  const retryVisiblePlayback = () => {
    if (!autoplayOnView || reducedMotion || !isVisibleRef.current) return;
    const video = videoRef.current;
    if (!video) return;
    void video.play().then(
      () => setPlaying(true),
      () => setPlaying(false),
    );
  };

  return (
    <div
      ref={containerRef}
      className="relative aspect-[4/5] w-full overflow-hidden bg-slate-950"
    >
      <video
        ref={videoRef}
        src={src}
        preload={autoplayOnView ? "metadata" : "metadata"}
        poster={poster ?? undefined}
        muted
        loop={!reducedMotion}
        playsInline
        autoPlay={autoplayOnView && !reducedMotion}
        aria-label={label}
        onLoadedData={() => setReady(true)}
        onCanPlay={retryVisiblePlayback}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        className={`h-full w-full object-cover ${ready ? "opacity-100" : "opacity-0"}`}
      />
      {!ready && (
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-br from-slate-950 via-brand-950 to-slate-800"
        />
      )}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10"
      />
      {!playing && (
        <span
          aria-hidden
          className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-brand-900 shadow-lg"
        >
          <PlayCircleIcon aria-hidden className="h-10 w-10" />
        </span>
      )}
      <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">
        {playing ? "Playing preview" : "Video"}
      </span>
    </div>
  );
}
