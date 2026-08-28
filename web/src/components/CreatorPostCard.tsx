"use client";

import Link from "next/link";
import { useState } from "react";
import {
  BookmarkIcon,
  ChatBubbleOvalLeftIcon,
  GlobeAltIcon,
  HeartIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import {
  BookmarkIcon as BookmarkSolidIcon,
  HeartIcon as HeartSolidIcon,
} from "@heroicons/react/24/solid";
import { useAuth } from "@/hooks/useAuth";
import { HttpError } from "@/lib/http";
import {
  addCreatorPostComment,
  getCreatorPostComments,
  recordCreatorPostShare,
  removeCreatorPostComment,
  toggleCreatorPostLike,
  toggleCreatorPostSave,
} from "@/lib/creator-feed-api";
import type { CreatorPost, CreatorPostComment } from "@/lib/types";
import { VerificationBadge } from "./VerificationBadge";
import { CreatorPostMedia } from "./CreatorPostMedia";
import { ShareMenu } from "./ShareMenu";
import { CreatorFollowButton } from "./CreatorFollowButton";

// Feed card redesign (product ask: "full Facebook UI and UX for the
// creator feed... adjust for our situation"): a recognizable social-feed
// card shape — caption before media, a timestamp + reach indicator in the
// header, an engagement summary line, avatars on comments — reassembled
// from this app's own primitives (heart-based Like, an existing
// ShareMenu, a bookmark-based Save that this platform treats as a first-
// class feature) rather than reproducing Facebook's exact iconography
// (its dual thumbs-up/heart reaction stack, its blue palette, its
// "Facebook" wordmark) — recognizable as the genre, not a copy of the
// brand. Save moves out of the primary action row into a corner icon
// next to the header, Instagram-style, since a 4th button crowded the
// Like/Comment/Share row this platform's own comment convention expects.
function timeAgo(value: string): string {
  const date = new Date(value);
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function displayName(comment: CreatorPostComment): string {
  return comment.user?.name?.trim() || "LIBERIA360 member";
}

function commentInitial(comment: CreatorPostComment): string {
  return displayName(comment).trim().charAt(0).toUpperCase() || "?";
}

// Caption sits above the media, like a real feed post — long ones clamp
// to 3 lines with a "See more" toggle rather than pushing the media
// further down the card.
function PostCaption({ text }: { text: string | null }) {
  const [expanded, setExpanded] = useState(false);

  if (!text) {
    return (
      <p className="text-sm italic text-slate-400">
        Shared a new story from Liberia.
      </p>
    );
  }

  return (
    <div>
      <p
        className={`whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200 ${expanded ? "" : "line-clamp-3"}`}
      >
        {text}
      </p>
      {!expanded && text.length > 160 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-0.5 text-sm font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          See more
        </button>
      )}
    </div>
  );
}

export function CreatorPostCard({ post }: { post: CreatorPost }) {
  const { user, token } = useAuth();
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [saveCount, setSaveCount] = useState(post.saveCount);
  const [shareCount, setShareCount] = useState(post.shareCount);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [liked, setLiked] = useState(Boolean(post.viewerLiked));
  const [saved, setSaved] = useState(Boolean(post.viewerSaved));
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<CreatorPostComment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [busy, setBusy] = useState<"like" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/creators/${post.creator.username}#post-${post.id}`
      : `/creators/${post.creator.username}#post-${post.id}`;

  async function handleLike() {
    if (!token) return;
    setBusy("like");
    setError(null);
    try {
      const result = await toggleCreatorPostLike(token, post.id);
      setLiked(result.liked);
      setLikeCount(result.likeCount);
    } catch (err) {
      setError(
        err instanceof HttpError ? err.message : "Like could not be updated.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleSave() {
    if (!token) return;
    setBusy("save");
    setError(null);
    try {
      const result = await toggleCreatorPostSave(token, post.id);
      setSaved(result.saved);
      setSaveCount(result.saveCount);
    } catch (err) {
      setError(
        err instanceof HttpError ? err.message : "Save could not be updated.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleShare() {
    try {
      const result = await recordCreatorPostShare(post.id);
      setShareCount(result.shareCount);
    } catch {
      // Share links still work when an anonymous counter update is unavailable.
    }
  }

  async function toggleComments() {
    const nextOpen = !commentsOpen;
    setCommentsOpen(nextOpen);
    if (!nextOpen || comments.length > 0) return;
    setLoadingComments(true);
    setError(null);
    try {
      setComments(await getCreatorPostComments(post.id));
    } catch (err) {
      setError(
        err instanceof HttpError
          ? err.message
          : "Comments could not be loaded.",
      );
    } finally {
      setLoadingComments(false);
    }
  }

  async function submitComment() {
    if (!token || !commentBody.trim()) return;
    setSubmittingComment(true);
    setError(null);
    try {
      const comment = await addCreatorPostComment(
        token,
        post.id,
        commentBody.trim(),
      );
      setComments((current) => [...current, comment]);
      setCommentCount((current) => current + 1);
      setCommentBody("");
      setCommentsOpen(true);
    } catch (err) {
      setError(
        err instanceof HttpError ? err.message : "Comment could not be posted.",
      );
    } finally {
      setSubmittingComment(false);
    }
  }

  async function deleteComment(commentId: string) {
    if (!token) return;
    try {
      await removeCreatorPostComment(token, post.id, commentId);
      setComments((current) =>
        current.filter((comment) => comment.id !== commentId),
      );
      setCommentCount((current) => Math.max(0, current - 1));
    } catch (err) {
      setError(
        err instanceof HttpError
          ? err.message
          : "Comment could not be removed.",
      );
    }
  }

  const hasEngagement = likeCount > 0 || commentCount > 0 || shareCount > 0;

  return (
    <article
      id={`post-${post.id}`}
      className="overflow-visible rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-start gap-3 px-4 pt-4 sm:px-5">
        <Link
          href={`/creators/${post.creator.username}`}
          className="shrink-0"
          aria-label={`View ${post.creator.name}'s profile`}
        >
          {post.creator.profileImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.creator.profileImage}
              alt=""
              className="h-12 w-12 rounded-full object-cover ring-2 ring-sky-100 dark:ring-sky-950"
            />
          ) : (
            <span
              aria-hidden
              className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-800 dark:bg-brand-950 dark:text-brand-200"
            >
              {post.creator.name.slice(0, 1).toUpperCase()}
            </span>
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-1.5">
                <Link
                  href={`/creators/${post.creator.username}`}
                  className="min-w-0 truncate font-display text-sm font-bold text-slate-950 hover:text-brand-700 dark:text-white dark:hover:text-brand-300 sm:text-base"
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
              <div className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                <time dateTime={post.createdAt}>{timeAgo(post.createdAt)}</time>
                <span aria-hidden>·</span>
                <GlobeAltIcon
                  aria-hidden
                  className="h-3.5 w-3.5 shrink-0"
                  title="Public"
                />
                <span className="sr-only">Public</span>
                {post.creator.county && (
                  <>
                    <span aria-hidden>·</span>
                    <span className="truncate">{post.creator.county.name}</span>
                  </>
                )}
              </div>
            </div>

            {token ? (
              <button
                type="button"
                onClick={handleSave}
                disabled={busy === "save"}
                aria-pressed={saved}
                aria-label={saved ? "Remove from saved posts" : "Save this post"}
                className={`shrink-0 rounded-full p-2 transition-colors disabled:opacity-50 ${saved ? "text-brand-700 dark:text-brand-300" : "text-slate-400 hover:bg-slate-50 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"}`}
              >
                {saved ? (
                  <BookmarkSolidIcon aria-hidden className="h-5 w-5" />
                ) : (
                  <BookmarkIcon aria-hidden className="h-5 w-5" />
                )}
              </button>
            ) : (
              <Link
                href="/login"
                aria-label="Log in to save this post"
                className="shrink-0 rounded-full p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <BookmarkIcon aria-hidden className="h-5 w-5" />
              </Link>
            )}
          </div>
          <div className="mt-2">
            <CreatorFollowButton
              creatorId={post.creator.id}
              compact
              hideWhenFollowing
            />
          </div>
        </div>
      </div>

      {post.mediaType !== "text" && (
        <div className="px-4 pb-3 pt-3 sm:px-5">
          <PostCaption text={post.caption} />
        </div>
      )}

      <CreatorPostMedia
        post={post}
        liked={liked}
        saved={saved}
        likeCount={likeCount}
        commentCount={commentCount}
        shareCount={shareCount}
        onLike={() => void handleLike()}
        onComment={() => void toggleComments()}
        onSave={() => void handleSave()}
        onShare={() => void handleShare()}
      />

      <div className="px-4 pb-4 pt-3 sm:px-5">
        {hasEngagement && (
          <div className="flex items-center justify-between gap-3 text-sm text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              {likeCount > 0 && (
                <>
                  <span
                    aria-hidden
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-white"
                  >
                    <HeartSolidIcon aria-hidden className="h-3 w-3" />
                  </span>
                  <span>{likeCount}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 truncate">
              {commentCount > 0 && (
                <span>
                  {commentCount} comment{commentCount === 1 ? "" : "s"}
                </span>
              )}
              {shareCount > 0 && (
                <span>
                  {shareCount} share{shareCount === 1 ? "" : "s"}
                </span>
              )}
            </div>
          </div>
        )}

        <div
          className={`grid grid-cols-3 gap-1 py-1 ${hasEngagement ? "mt-2 border-y border-slate-100 dark:border-slate-800" : "border-b border-slate-100 pb-2 dark:border-slate-800"}`}
        >
          {token ? (
            <button
              type="button"
              onClick={handleLike}
              disabled={busy === "like"}
              aria-pressed={liked}
              className={`flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 dark:hover:bg-slate-800 ${liked ? "text-rose-600 dark:text-rose-400" : "text-slate-600 dark:text-slate-300"}`}
            >
              {liked ? (
                <HeartSolidIcon aria-hidden className="h-5 w-5" />
              ) : (
                <HeartIcon aria-hidden className="h-5 w-5" />
              )}
              <span className="truncate">Like</span>
            </button>
          ) : (
            <Link
              href="/login"
              className="flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <HeartIcon aria-hidden className="h-5 w-5" />
              <span className="truncate">Like</span>
            </Link>
          )}
          <button
            type="button"
            onClick={toggleComments}
            aria-expanded={commentsOpen}
            className="flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ChatBubbleOvalLeftIcon aria-hidden className="h-5 w-5" />
            <span className="truncate">Comment</span>
          </button>
          <ShareMenu
            placeName={post.creator.name}
            shareUrl={shareUrl}
            contentType="post"
            variant="feed"
            onShare={handleShare}
          />
        </div>

        {commentsOpen && (
          <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
            {loadingComments ? (
              <p className="text-sm text-slate-500">Loading comments…</p>
            ) : comments.length > 0 ? (
              <div className="space-y-3">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex items-start gap-2">
                    <span
                      aria-hidden
                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                    >
                      {commentInitial(comment)}
                    </span>
                    <div className="min-w-0 flex-1 rounded-2xl bg-slate-50 px-3 py-2 dark:bg-slate-800">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                          {displayName(comment)}
                        </span>
                        <time
                          dateTime={comment.createdAt}
                          className="text-[11px] text-slate-400"
                        >
                          {timeAgo(comment.createdAt)}
                        </time>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">
                        {comment.body}
                      </p>
                    </div>
                    {token && comment.userId === user?.id && (
                      <button
                        type="button"
                        onClick={() => deleteComment(comment.id)}
                        className="mt-0.5 rounded-full p-1 text-slate-400 hover:text-rose-600"
                        aria-label="Delete comment"
                      >
                        <TrashIcon aria-hidden className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No comments yet. Start the conversation.
              </p>
            )}
            <div className="mt-3 flex items-start gap-2">
              {token ? (
                <>
                  <span
                    aria-hidden
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-800 dark:bg-brand-950 dark:text-brand-200"
                  >
                    {(user?.name?.trim().charAt(0) || "?").toUpperCase()}
                  </span>
                  <textarea
                    value={commentBody}
                    onChange={(event) => setCommentBody(event.target.value)}
                    rows={1}
                    maxLength={1000}
                    placeholder="Write a comment…"
                    className="min-h-11 flex-1 resize-none rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-brand-950"
                  />
                  <button
                    type="button"
                    onClick={submitComment}
                    disabled={submittingComment || !commentBody.trim()}
                    className="min-h-11 shrink-0 rounded-2xl bg-brand-700 px-3 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {submittingComment ? "Posting…" : "Post"}
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  className="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
                >
                  Log in to comment
                </Link>
              )}
            </div>
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="mt-3 text-xs text-rose-700 dark:text-rose-300"
          >
            {error}
          </p>
        )}
      </div>
    </article>
  );
}
