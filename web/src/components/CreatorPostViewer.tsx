"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type { CreatorPost, CreatorPostComment } from "@/lib/types";
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
  const [floatingHearts, setFloatingHearts] = useState<number[]>([]);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartIdRef = useRef(0);
  const holdStartedRef = useRef(false);
  const suppressClickRef = useRef(false);
  const itemClass = isRail
    ? "flex flex-col items-center gap-1 text-white drop-shadow-md"
    : "flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-2 text-sm font-semibold text-white hover:bg-white/10";
  const iconClass = isRail ? "h-7 w-7" : "h-6 w-6";

  const clearHoldTimers = useCallback(() => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    holdTimerRef.current = null;
    holdIntervalRef.current = null;
  }, []);

  function emitFloatingHeart() {
    const id = ++heartIdRef.current;
    setFloatingHearts((hearts) => [...hearts.slice(-5), id]);
    window.setTimeout(() => {
      setFloatingHearts((hearts) => hearts.filter((heartId) => heartId !== id));
    }, 1100);
  }

  function sendHoldLike() {
    if (!liked) onLike();
    emitFloatingHeart();
  }

  function startHold() {
    clearHoldTimers();
    holdStartedRef.current = false;
    holdTimerRef.current = setTimeout(() => {
      holdStartedRef.current = true;
      suppressClickRef.current = true;
      sendHoldLike();
      holdIntervalRef.current = setInterval(sendHoldLike, 260);
    }, 280);
  }

  function endHold() {
    clearHoldTimers();
  }

  useEffect(() => clearHoldTimers, [clearHoldTimers]);

  return (
    <div
      className={
        isRail ? "flex flex-col items-center gap-5" : "flex items-center gap-1"
      }
    >
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            if (suppressClickRef.current) {
              suppressClickRef.current = false;
              return;
            }
            onLike();
          }}
          onPointerDown={startHold}
          onPointerUp={endHold}
          onPointerCancel={endHold}
          onPointerLeave={endHold}
          onContextMenu={(event) => event.preventDefault()}
          aria-pressed={liked}
          aria-label={liked ? "Unlike post. Hold to send hearts" : "Like post. Hold to send hearts"}
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
        <div className="pointer-events-none absolute bottom-1/2 left-1/2 z-40 h-2 w-2" aria-hidden="true">
          {floatingHearts.map((heartId, index) => (
            <HeartSolidIcon
              key={heartId}
              className="creator-floating-heart absolute h-7 w-7 fill-rose-400 text-rose-200"
              style={{ left: `${(index % 3) * 10 - 10}px` }}
            />
          ))}
        </div>
      </div>
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

function DirectVideoViewer({
  post,
  active = true,
  preload = "auto",
  onEnded,
  onDoubleTap,
}: {
  post: CreatorPost;
  active?: boolean;
  preload?: "none" | "metadata" | "auto";
  onEnded?: () => void;
  onDoubleTap?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setLoadError(false);
    setLoaded(false);
    video.preload = preload;
    if (!active) {
      video.pause();
      video.currentTime = 0;
      setPlaying(false);
      if (preload !== "none") video.load();
      return;
    }
    video.muted = true;
    video.load();
    video.play().then(
      () => setPlaying(true),
      () => setPlaying(false),
    );
    return () => {
      video.pause();
      video.currentTime = 0;
    };
  }, [active, preload]);

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

  function retryLoad() {
    const video = videoRef.current;
    if (!video) return;
    setLoadError(false);
    setLoaded(false);
    video.load();
    if (active) {
      void video.play().then(
        () => setPlaying(true),
        () => setPlaying(false),
      );
    }
  }

  return (
    <div className="relative flex h-full w-full items-center justify-center bg-black">
      <video
        ref={videoRef}
        src={post.mediaUrl}
        preload={preload}
        poster={post.thumbnailUrl ?? creatorVideoPosterUrl(post.mediaUrl) ?? undefined}
        muted
        loop={false}
        playsInline
        autoPlay={active}
        controls={false}
        aria-label={`${post.creator.name}'s video post`}
        onClick={togglePlay}
        onDoubleClick={onDoubleTap}
        onLoadedData={() => setLoaded(true)}
        onLoadedMetadata={() => setLoaded(true)}
        onError={() => {
          setLoadError(true);
          setPlaying(false);
        }}
        onCanPlay={() => {
          if (active && videoRef.current?.paused) {
            void videoRef.current.play().then(
              () => setPlaying(true),
              () => setPlaying(false),
            );
          }
        }}
        onEnded={() => {
          if (active) onEnded?.();
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        className="h-full w-full object-contain"
      />
      {!loaded && !loadError && (
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/55 px-4 py-2 text-xs font-semibold text-white backdrop-blur-sm" role="status">
          Loading video…
        </span>
      )}
      {loadError && (
        <div className="absolute inset-x-6 top-1/2 flex -translate-y-1/2 flex-col items-center gap-3 text-center" role="alert">
          <p className="rounded-full bg-black/65 px-4 py-2 text-xs font-semibold text-white">
            This video could not be loaded.
          </p>
          <button
            type="button"
            onClick={retryLoad}
            className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-brand-950"
          >
            Try again
          </button>
        </div>
      )}
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
  videoPosts = [],
  mode,
  shareUrl,
  liked,
  saved,
  likeCount,
  commentCount,
  shareCount,
  onLike,
  onComment,
  onCommentSubmit,
  onCommentLike,
  onCommentReply,
  onCommentsOpen,
  comments = [],
  onSave,
  onShare,
  onClose,
  onPrevious,
  onNext,
}: {
  post: CreatorPost;
  videoPosts?: CreatorPost[];
  mode: "video" | "image";
  shareUrl: string;
  liked: boolean;
  saved: boolean;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  onLike: () => void;
  onComment: () => void;
  onCommentSubmit?: (body: string, parentId?: string) => void | Promise<void>;
  onCommentLike?: (commentId: string) => void | Promise<void>;
  onCommentReply?: (commentId: string) => void;
  onCommentsOpen?: () => Promise<CreatorPostComment[]>;
  comments?: CreatorPostComment[];
  onSave: () => void;
  onShare: () => void;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [heartBurstId, setHeartBurstId] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [loadedComments, setLoadedComments] = useState<CreatorPostComment[] | null>(null);
  const reelStageRef = useRef<HTMLDivElement>(null);
  const navigationLockRef = useRef(false);

  const playlist = useMemo(
    () => (videoPosts.length > 0 ? videoPosts : [post]),
    [post, videoPosts],
  );
  const currentIndex = Math.max(0, playlist.findIndex((item) => item.id === post.id));
  const windowStart = Math.max(0, Math.min(currentIndex - 1, playlist.length - 3));
  const reelWindow = playlist.slice(windowStart, windowStart + 3);

  useEffect(() => {
    if (mode !== "video" || !reelStageRef.current) return;
    const localIndex = Math.max(0, currentIndex - windowStart);
    setActiveIndex(localIndex);
    reelStageRef.current.scrollTop = reelStageRef.current.clientHeight * localIndex;
    navigationLockRef.current = false;
  }, [currentIndex, mode, post.id, reelWindow.length, windowStart]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowUp" || event.key === "PageUp") {
        event.preventDefault();
        onPrevious?.();
      }
      if (event.key === "ArrowDown" || event.key === "PageDown") {
        event.preventDefault();
        onNext?.();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, onNext, onPrevious]);

  function handleReelScroll() {
    const stage = reelStageRef.current;
    if (!stage || reelWindow.length < 2 || navigationLockRef.current) return;
    const nextVisibleIndex = Math.round(stage.scrollTop / stage.clientHeight);
    if (nextVisibleIndex === activeIndex) return;
    setActiveIndex(nextVisibleIndex);
    if (nextVisibleIndex === 0 && currentIndex > 0) {
      navigationLockRef.current = true;
      onPrevious?.();
    } else if (nextVisibleIndex === reelWindow.length - 1 && currentIndex < playlist.length - 1) {
      navigationLockRef.current = true;
      onNext?.();
    }
  }

  function handleDoubleTap() {
    if (!liked) onLike();
    setHeartBurstId((id) => id + 1);
  }

  async function openComments() {
    setCommentsOpen(true);
    if (!onCommentsOpen) return;
    setCommentsLoading(true);
    try {
      setLoadedComments(await onCommentsOpen());
    } finally {
      setCommentsLoading(false);
    }
  }

  async function refreshComments() {
    if (!onCommentsOpen) return;
    setLoadedComments(await onCommentsOpen());
  }

  async function handleViewerCommentLike(commentId: string) {
    await onCommentLike?.(commentId);
    await refreshComments();
  }

  async function handleViewerCommentSubmit(body: string, parentId?: string) {
    await onCommentSubmit?.(body, parentId);
    await refreshComments();
  }

  const visibleComments = loadedComments ?? comments;

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
      className="creator-video-viewer fixed inset-0 z-[2000] flex min-h-[100dvh] flex-col overscroll-contain bg-black text-white"
    >
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div ref={reelStageRef} onScroll={handleReelScroll} className="creator-video-snap-stage h-full overflow-y-auto overscroll-contain" aria-live="polite">
        {reelWindow.map((item) => (
          (() => {
            const isActive = item.id === post.id;
            return (
              <div
                key={item.id}
                data-reel-post-id={item.id}
                className="creator-video-snap-slide creator-video-reel-slide"
              >
                {isDirectVideoFile(item.mediaUrl) ? (
                  <DirectVideoViewer
                    post={item}
                    active={isActive}
                    preload={isActive ? "auto" : "metadata"}
                    onDoubleTap={isActive ? handleDoubleTap : undefined}
                    onEnded={
                      isActive && currentIndex < playlist.length - 1
                        ? onNext
                        : undefined
                    }
                  />
                ) : (
                  <EmbedVideoViewer post={item} />
                )}
              </div>
            );
          })()
        ))}
        </div>
        {heartBurstId > 0 && (
          <div
            key={heartBurstId}
            className="creator-reel-heart-burst pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2"
            aria-hidden="true"
          >
            <HeartSolidIcon className="h-28 w-28 fill-rose-500 text-white drop-shadow-[0_8px_20px_rgba(0,0,0,0.45)]" />
          </div>
        )}
        <div className="pointer-events-none absolute inset-0">
          {onPrevious && (
            <button
              type="button"
              onClick={onPrevious}
              aria-label="Previous video"
              className="pointer-events-auto absolute left-1/2 top-4 z-20 hidden -translate-x-1/2 rounded-full bg-black/45 px-4 py-2 text-xs font-semibold text-white backdrop-blur-sm hover:bg-black/65 sm:block"
            >
              Previous video
            </button>
          )}
          {onNext && (
            <button
              type="button"
              onClick={onNext}
              aria-label="Next video"
              className="pointer-events-auto absolute bottom-4 left-1/2 z-20 hidden -translate-x-1/2 rounded-full bg-black/45 px-4 py-2 text-xs font-semibold text-white backdrop-blur-sm hover:bg-black/65 sm:block"
            >
              Next video
            </button>
          )}
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-3 bg-gradient-to-b from-black/70 to-transparent px-4 pb-12 pt-[calc(0.75rem+env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close video post"
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full text-white hover:bg-white/10"
          >
            <ChevronLeftIcon aria-hidden className="h-8 w-8" />
          </button>
          <div>
            <p className="text-base font-bold">Creator video</p>
            {(onPrevious || onNext) && (
              <p className="text-xs text-white/65">
                Swipe up or down for more videos
              </p>
            )}
          </div>
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
            onComment={openComments}
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
        {commentsOpen && (
          <div className="creator-reels-comments-sheet absolute inset-x-0 bottom-0 z-50 flex max-h-[68%] flex-col rounded-t-[1.75rem] bg-white text-slate-900 shadow-2xl dark:bg-slate-950 dark:text-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-white/10">
              <div>
                <h2 className="text-base font-bold">Comments</h2>
                <p className="text-xs text-slate-500 dark:text-white/55">{formatCount(loadedComments?.length ?? commentCount)} comments</p>
              </div>
              <button type="button" onClick={() => setCommentsOpen(false)} aria-label="Close comments" className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:text-white/70 dark:hover:bg-white/10">
                <XMarkIcon aria-hidden className="h-6 w-6" />
              </button>
            </div>
            <div className="min-h-24 flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm">
              {commentsLoading ? (
                <p className="py-6 text-center text-slate-500 dark:text-white/60">Loading comments…</p>
              ) : visibleComments.length === 0 ? (
                <p className="py-6 text-center text-slate-500 dark:text-white/60">Be the first to comment on this Reel.</p>
              ) : visibleComments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-800 dark:bg-brand-900/50 dark:text-brand-200">
                    {(comment.user?.name?.trim().charAt(0) || "L").toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold">{comment.user?.name?.trim() || "LIBERIA360 member"}</p>
                    <p className="break-words text-slate-700 dark:text-white/80">{comment.body}</p>
                    <p className="mt-1 text-xs text-slate-400">{timeAgo(comment.createdAt)}</p>
                    <div className="mt-2 flex items-center gap-4 text-xs font-semibold text-slate-500 dark:text-white/60">
                      <button type="button" onClick={() => void handleViewerCommentLike(comment.id)} aria-pressed={Boolean(comment.viewerLiked)} className={comment.viewerLiked ? "text-rose-600 dark:text-rose-400" : "hover:text-rose-600 dark:hover:text-rose-400"}>
                        {comment.viewerLiked ? "Liked" : "Like"} · {comment.likeCount}
                      </button>
                      <button type="button" onClick={() => { setReplyingTo(comment.id); onCommentReply?.(comment.id); }} className="hover:text-brand-700 dark:hover:text-brand-300">
                        Reply
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-200 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] dark:border-white/10">
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  {replyingTo && <p className="mb-1 flex items-center justify-between px-2 text-xs text-brand-700 dark:text-brand-300"><span>Replying to comment</span><button type="button" onClick={() => setReplyingTo(null)} className="font-semibold">Cancel</button></p>}
                  <textarea value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} rows={1} maxLength={1000} placeholder={replyingTo ? "Write a reply…" : "Write a comment…"} aria-label={replyingTo ? "Write a reply" : "Write a comment"} className="min-h-11 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 sm:text-sm dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/45" />
                </div>
                <button type="button" onClick={() => { if (!commentDraft.trim()) return; void handleViewerCommentSubmit(commentDraft.trim(), replyingTo ?? undefined); setCommentsOpen(false); setCommentDraft(""); setReplyingTo(null); }} disabled={!commentDraft.trim()} className="min-h-11 rounded-2xl bg-brand-700 px-4 text-sm font-bold text-white disabled:opacity-40">
                  Post
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={openComments}
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
  const poster = post.thumbnailUrl ?? creatorVideoPosterUrl(post.mediaUrl);
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
      <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">
        Video preview
      </span>
    </button>
  );
}
