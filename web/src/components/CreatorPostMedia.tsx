"use client";

import { useEffect, useRef, useState } from "react";
import {
  PlayIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import {
  creatorVideoEmbedUrl,
  creatorVideoPosterUrl,
  isDirectVideoFile,
} from "@/lib/creator-media";
import type { CreatorPost } from "@/lib/types";

// Feed media redesign (product ask: "full Facebook UI and UX for the
// creator feed"): the two pieces of that experience that actually matter
// here — a photo you tap to see full-size without leaving the feed, and a
// video that plays inside the card instead of routing you away from it —
// rebuilt on this app's own single-media-per-post model rather than
// lifted wholesale. Previously both media types routed through an
// outbound `<Link>` (photos to the raw image URL, videos to a new tab) —
// about as un-"social feed"-like as a photo/video card gets.

// Direct-file video: autoplay-on-scroll, muted-by-default (autoplay
// policy — every browser blocks unmuted autoplay), tap the frame to
// play/pause, a small corner button to toggle sound. Not currently
// reachable from real data — the composer only ever produces a
// YouTube/Vimeo link (see CreatorPostComposer) — but kept ready for a
// future direct-upload path, since it's the one media shape a native
// <video> element can actually play. `muted` is also set imperatively in
// an effect, not just via the JSX attribute — React doesn't reliably sync
// the `muted` *property* from the attribute on `<video>` in every
// browser, and an unmuted-by-default video that fails to autoplay looks
// broken.
function FeedFileVideo({ post }: { post: CreatorPost }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.muted = true;
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          video.play().then(
            () => setPlaying(true),
            () => {
              // Autoplay can still be refused (e.g. data-saver mode) — the
              // tap-to-play button below covers that case.
            },
          );
        } else if (!video.paused) {
          video.pause();
          setPlaying(false);
        }
      },
      { threshold: [0, 0.6, 1] },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => setPlaying(true));
    } else {
      video.pause();
      setPlaying(false);
    }
  }

  function toggleMute(event: React.MouseEvent) {
    event.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }

  const label = `${post.creator.name}'s video post`;

  return (
    <div
      ref={containerRef}
      className="relative aspect-[4/3] w-full overflow-hidden bg-slate-950"
    >
      <video
        ref={videoRef}
        src={post.mediaUrl}
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={label}
        onClick={togglePlay}
        onLoadedData={() => setReady(true)}
        className={`h-full w-full cursor-pointer object-cover transition-opacity duration-200 ${ready ? "opacity-100" : "opacity-0"}`}
      />
      {!ready && (
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-br from-slate-950 via-brand-950 to-slate-800"
        />
      )}
      {!playing && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Play video"
          className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-brand-900 shadow-lg transition-transform hover:scale-105"
        >
          <PlayIcon aria-hidden className="h-8 w-8 translate-x-0.5" />
        </button>
      )}
      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? "Unmute video" : "Mute video"}
        className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/75"
      >
        {muted ? (
          <SpeakerXMarkIcon aria-hidden className="h-5 w-5" />
        ) : (
          <SpeakerWaveIcon aria-hidden className="h-5 w-5" />
        )}
      </button>
    </div>
  );
}

// YouTube/Vimeo link (what the composer actually produces today): shows
// the provider's own thumbnail with a play button, and only mounts the
// iframe once someone taps it — never loading a third-party embed for
// every card that scrolls past, only the one someone actually wants to
// watch. Once tapped it plays right there in the feed instead of handing
// the visitor off to a new tab, same outcome the file-video path above
// gives for a change a direct upload would produce.
function FeedEmbedVideo({
  post,
  embedUrl,
}: {
  post: CreatorPost;
  embedUrl: string;
}) {
  const [playing, setPlaying] = useState(false);
  const poster = creatorVideoPosterUrl(post.mediaUrl);
  const label = `${post.creator.name}'s video post`;

  if (playing) {
    return (
      <div className="aspect-[4/3] w-full overflow-hidden bg-slate-950">
        <iframe
          src={embedUrl}
          title={label}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={`Play ${label}`}
      className="group relative block aspect-[4/3] w-full overflow-hidden bg-slate-950"
    >
      {poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={poster}
          alt=""
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
      ) : (
        <div
          aria-hidden
          className="h-full w-full bg-gradient-to-br from-slate-950 via-brand-950 to-slate-800"
        />
      )}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10"
      />
      <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-brand-900 shadow-lg transition-transform group-hover:scale-105">
        <PlayIcon aria-hidden className="h-8 w-8 translate-x-0.5" />
      </span>
      <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">
        Video
      </span>
    </button>
  );
}

// A video link this app doesn't recognize as YouTube/Vimeo (and isn't a
// direct file either) — the one case with no way to play it in place, so
// it keeps the original "open it yourself" behavior rather than pretend
// otherwise.
function FeedUnknownVideo({ post }: { post: CreatorPost }) {
  return (
    <a
      href={post.mediaUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 bg-slate-950 text-white"
    >
      <PlayIcon aria-hidden className="h-10 w-10" />
      <span className="text-sm font-semibold">Watch video</span>
    </a>
  );
}

// Photo: tap opens a full-screen lightbox over the feed (Escape/backdrop
// tap/× to close) instead of navigating away to the raw image URL.
function FeedPhoto({ post }: { post: CreatorPost }) {
  const [open, setOpen] = useState(false);
  const label = `${post.creator.name}'s photo post`;

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative block aspect-[4/3] w-full overflow-hidden bg-slate-100 dark:bg-slate-800"
        aria-label={`Open ${label}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={post.mediaUrl}
          alt={label}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={label}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/90 p-4"
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close photo"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <XMarkIcon aria-hidden className="h-6 w-6" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.mediaUrl}
            alt=""
            onClick={(event) => event.stopPropagation()}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </div>
      )}
    </>
  );
}

export function CreatorPostMedia({ post }: { post: CreatorPost }) {
  if (post.mediaType !== "video") return <FeedPhoto post={post} />;

  if (isDirectVideoFile(post.mediaUrl)) return <FeedFileVideo post={post} />;

  const embedUrl = creatorVideoEmbedUrl(post.mediaUrl);
  return embedUrl ? (
    <FeedEmbedVideo post={post} embedUrl={embedUrl} />
  ) : (
    <FeedUnknownVideo post={post} />
  );
}
