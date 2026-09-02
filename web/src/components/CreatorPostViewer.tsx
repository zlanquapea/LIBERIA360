"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  BookmarkIcon,
  ChatBubbleOvalLeftIcon,
  ChevronLeftIcon,
  HeartIcon,
  PlayIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  BookmarkIcon as BookmarkSolidIcon,
  HeartIcon as HeartSolidIcon,
} from "@heroicons/react/24/solid";
import {
  creatorVideoEmbedUrl,
  creatorVideoPosterUrl,
  isDirectVideoFile,
} from "@/lib/creator-media";
import type { CreatorPost } from "@/lib/types";
import { ShareMenu } from "./ShareMenu";
import { VerificationBadge } from "./VerificationBadge";
import { CreatorVideoThumbnail } from "./CreatorVideoThumbnail";

function formatCount(value: number): string {
  if (value < 1000) return String(value);
  if (value < 10000) return `${(value / 1000).toFixed(1).replace(".0", "")}K`;
  if (value < 1000000) return `${Math.round(value / 1000)}K`;
  return `${(value / 1000000).toFixed(1).replace(".0", "")}M`;
}

function timeAgo(value: string): string {
  const date = new Date(value);
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

type ViewerActionsProps = {
  post: CreatorPost;
  shareUrl: string;
  liked: boolean;
  saved: boolean;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  onLike: () => void;
  onComment: () => void;
  onSave: () => void;
  onShare: () => void;
  layout: "rail" | "row";
};

function ViewerActions({
  post,
  shareUrl,
  liked,
  saved,
  likeCount,
  commentCount,
  shareCount,
  onLike,
  onComment,
  onSave,
  onShare,
  layout,
}: ViewerActionsProps) {
  const isRail = layout === "rail";
  const itemClass = isRail
    ? "flex flex-col items-center gap-1 text-white drop-shadow-md"
    : "flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-2 text-sm font-semibold text-white hover:bg-white/10";
  const iconClass = isRail ? "h-7 w-7" : "h-6 w-6";

  return (
    <div
      className={
        isRail ? "flex flex-col items-center gap-5" : "flex items-center gap-1"
      }
    >
      <button
        type="button"
        onClick={onLike}
        aria-pressed={liked}
        aria-label={liked ? "Unlike post" : "Like post"}
        className={itemClass}
      >
        {liked ? (
          <HeartSolidIcon
            aria-hidden
            className={`${iconClass} text-rose-400`}
          />
        ) : (
          <HeartIcon aria-hidden className={iconClass} />
        )}
        <span className={isRail ? "text-xs font-semibold" : "truncate"}>
          {formatCount(likeCount)}
          {!isRail && " Like"}
        </span>
      </button>
      <button
        type="button"
        onClick={onComment}
        aria-label="View comments"
        className={itemClass}
      >
        <ChatBubbleOvalLeftIcon aria-hidden className={iconClass} />
        <span className={isRail ? "text-xs font-semibold" : "truncate"}>
          {formatCount(commentCount)}
          {!isRail && " Comment"}
        </span>
      </button>
      <ShareMenu
        placeName={post.creator.name}
        shareUrl={shareUrl}
        contentType="post"
        variant={isRail ? "viewer" : "viewer-action"}
        onShare={onShare}
      />
      {isRail ? (
        <button
          type="button"
          onClick={onSave}
          aria-pressed={saved}
          aria-label={saved ? "Remove from saved posts" : "Save post"}
          className={itemClass}
        >
          {saved ? (
            <BookmarkSolidIcon aria-hidden className="h-7 w-7 text-gold-300" />
          ) : (
            <BookmarkIcon aria-hidden className="h-7 w-7" />
          )}
          <span className="text-xs font-semibold">
            {formatCount(post.saveCount)}
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={onSave}
          aria-pressed={saved}
          aria-label={saved ? "Remove from saved posts" : "Save post"}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-xl px-2 text-white hover:bg-white/10"
        >
          {saved ? (
            <BookmarkSolidIcon aria-hidden className="h-6 w-6 text-gold-300" />
          ) : (
            <BookmarkIcon aria-hidden className="h-6 w-6" />
          )}
        </button>
      )}
      {!isRail && shareCount > 0 && (
        <span className="sr-only">{formatCount(shareCount)} shares</span>
      )}
    </div>
  );
}

function CreatorIdentity({ post }: { post: CreatorPost }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Link
        href={`/creators/${post.creator.username}`}
        aria-label={`View ${post.creator.name}'s profile`}
        className="shrink-0"
      >
        {post.creator.profileImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.creator.profileImage}
            alt=""
            className="h-11 w-11 rounded-full object-cover ring-2 ring-white/30"
          />
        ) : (
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-500 text-lg font-bold text-white ring-2 ring-white/30">
            {post.creator.name.trim().charAt(0).toUpperCase() || "?"}
          </span>
        )}
      </Link>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <Link
            href={`/creators/${post.creator.username}`}
            className="truncate text-sm font-bold text-white hover:underline"
          >
            {post.creator.name}
          </Link>
          <VerificationBadge
            compact
            status={
              post.creator.verificationStatus === "verified"
                ? "verified"
                : "unverified"
            }
          />
        </div>
        <p className="text-xs text-white/70">
          {timeAgo(post.createdAt)} <span aria-hidden>·</span> Public
        </p>
      </div>
    </div>
  );
}

function DirectVideoViewer({ post }: { post: CreatorPost }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    video.play().then(
      () => setPlaying(true),
      () => setPlaying(false),
    );
    return () => video.pause();
  }, []);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().then(
        () => setPlaying(true),
        () => setPlaying(false),
      );
    } else {
      video.pause();
      setPlaying(false);
    }
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }

  return (
    <div className="relative flex h-full w-full items-center justify-center bg-black">
      <video
        ref={videoRef}
        src={post.mediaUrl}
        preload="auto"
        muted
        loop
        playsInline
        autoPlay
        controls={false}
        aria-label={`${post.creator.name}'s video post`}
        onClick={togglePlay}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        className="h-full w-full object-contain"
      />
      {!playing && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Play video"
          className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-brand-950 shadow-xl"
        >
          <PlayIcon aria-hidden className="h-9 w-9 translate-x-0.5" />
        </button>
      )}
      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? "Unmute video" : "Mute video"}
        className="absolute bottom-28 left-4 flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm"
      >
        {muted ? (
          <SpeakerXMarkIcon aria-hidden className="h-6 w-6" />
        ) : (
          <SpeakerWaveIcon aria-hidden className="h-6 w-6" />
        )}
      </button>
    </div>
  );
}

function EmbedVideoViewer({ post }: { post: CreatorPost }) {
  const [loaded, setLoaded] = useState(false);
  const embedUrl = creatorVideoEmbedUrl(post.mediaUrl);
  const poster = creatorVideoPosterUrl(post.mediaUrl);
  if (!embedUrl) {
    return (
      <div className="flex h-full items-center justify-center bg-gradient-to-br from-brand-950 via-slate-950 to-black p-8 text-center text-white">
        <a
          href={post.mediaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-brand-950"
        >
          Watch video
        </a>
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full items-center justify-center bg-black">
      {poster && !loaded && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={poster}
          alt=""
          className="absolute inset-0 h-full w-full object-contain opacity-90"
        />
      )}
      <iframe
        src={embedUrl}
        title={`${post.creator.name}'s video post`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        onLoad={() => setLoaded(true)}
        className={`relative aspect-video w-full max-w-3xl ${loaded ? "opacity-100" : "opacity-0"}`}
      />
      {!loaded && !poster && (
        <span className="absolute bottom-6 rounded-full bg-white/10 px-3 py-2 text-xs text-white/75">
          Loading video…
        </span>
      )}
    </div>
  );
}

export function CreatorPostViewer({
  post,
  mode,
  shareUrl,
  liked,
  saved,
  likeCount,
  commentCount,
  shareCount,
  onLike,
  onComment,
  onSave,
  onShare,
  onClose,
}: {
  post: CreatorPost;
  mode: "video" | "image";
  shareUrl: string;
  liked: boolean;
  saved: boolean;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  onLike: () => void;
  onComment: () => void;
  onSave: () => void;
  onShare: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (mode === "image") {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${post.creator.name}'s photo post`}
        className="fixed inset-0 z-[2000] flex min-h-[100dvh] flex-col bg-[#101010] text-white"
      >
        <div className="flex items-center justify-between px-4 pb-2 pt-[calc(0.75rem+env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close photo post"
            className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10"
          >
            <XMarkIcon aria-hidden className="h-7 w-7" />
          </button>
          <p className="text-sm font-semibold text-white/80">Photo post</p>
          <div className="h-11 w-11" aria-hidden />
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center px-3 py-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.mediaUrl}
            alt={`${post.creator.name}'s photo post`}
            className="max-h-full max-w-full object-contain"
          />
        </div>
        <div className="shrink-0 bg-[#202020] px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
          <CreatorIdentity post={post} />
          <p className="mt-4 max-h-20 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-white/95">
            {post.caption || "Shared a new story from Liberia."}
          </p>
          <div className="mt-3 border-t border-white/10 pt-2">
            <ViewerActions
              post={post}
              shareUrl={shareUrl}
              liked={liked}
              saved={saved}
              likeCount={likeCount}
              commentCount={commentCount}
              shareCount={shareCount}
              onLike={onLike}
              onComment={onComment}
              onSave={onSave}
              onShare={onShare}
              layout="row"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${post.creator.name}'s video post`}
      className="fixed inset-0 z-[2000] flex min-h-[100dvh] flex-col bg-black text-white"
    >
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {isDirectVideoFile(post.mediaUrl) ? (
          <DirectVideoViewer post={post} />
        ) : (
          <EmbedVideoViewer post={post} />
        )}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-3 bg-gradient-to-b from-black/70 to-transparent px-4 pb-12 pt-[calc(0.75rem+env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close video post"
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full text-white hover:bg-white/10"
          >
            <ChevronLeftIcon aria-hidden className="h-8 w-8" />
          </button>
          <p className="text-base font-bold">Creator video</p>
        </div>
        <div className="absolute bottom-32 right-3">
          <ViewerActions
            post={post}
            shareUrl={shareUrl}
            liked={liked}
            saved={saved}
            likeCount={likeCount}
            commentCount={commentCount}
            shareCount={shareCount}
            onLike={onLike}
            onComment={onComment}
            onSave={onSave}
            onShare={onShare}
            layout="rail"
          />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/75 to-transparent px-4 pb-6 pt-28 pr-20">
          <div className="pointer-events-auto">
            <CreatorIdentity post={post} />
            <p className="mt-3 max-h-24 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-white">
              {post.caption || "Shared a new story from Liberia."}
            </p>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onComment}
        className="mx-4 mb-[calc(0.75rem+env(safe-area-inset-bottom))] mt-2 flex min-h-12 items-center rounded-full bg-[#242424] px-5 text-left text-sm text-white/65"
      >
        Add a comment…
      </button>
    </div>
  );
}

export function CreatorPostViewerImagePreview({
  post,
  onOpen,
}: {
  post: CreatorPost;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open ${post.creator.name}'s photo post`}
      className="group relative block aspect-[4/3] w-full overflow-hidden bg-slate-100 dark:bg-slate-800"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={post.mediaUrl}
        alt={`${post.creator.name}'s photo post`}
        loading="lazy"
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
      />
    </button>
  );
}

export function CreatorPostViewerVideoPreview({
  post,
  onOpen,
}: {
  post: CreatorPost;
  onOpen: () => void;
}) {
  const poster = creatorVideoPosterUrl(post.mediaUrl);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open ${post.creator.name}'s video post`}
      className="group relative block aspect-[4/5] w-full overflow-hidden bg-slate-950"
    >
      {isDirectVideoFile(post.mediaUrl) ? (
        <CreatorVideoThumbnail
          src={post.mediaUrl}
          poster={poster}
          label={`Open ${post.creator.name}'s video post`}
          autoplayOnView
        />
      ) : poster ? (
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
      <span
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/10"
      />
      <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-brand-950 shadow-lg transition-transform group-hover:scale-105">
        <PlayIcon aria-hidden className="h-8 w-8 translate-x-0.5" />
      </span>
      <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">
        Watch video
      </span>
    </button>
  );
}
