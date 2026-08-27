"use client";

import Link from "next/link";
import { useState } from "react";
import {
  BookmarkIcon,
  ChatBubbleOvalLeftIcon,
  HeartIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { HeartIcon as HeartSolidIcon } from "@heroicons/react/24/solid";
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
import type {
  CreatorAvailabilityStatus,
  CreatorPost,
  CreatorPostComment,
} from "@/lib/types";
import { VerificationBadge } from "./VerificationBadge";
import { CreatorPostMedia } from "./CreatorPostMedia";
import { ShareMenu } from "./ShareMenu";
import { CreatorFollowButton } from "./CreatorFollowButton";

function timeAgo(value: string): string {
  const date = new Date(value);
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

function displayName(comment: CreatorPostComment): string {
  return comment.user?.name?.trim() || "LIBERIA360 member";
}

const AVAILABILITY_LABELS: Record<CreatorAvailabilityStatus, string> = {
  accepting_requests: "Accepting requests",
  limited: "Limited availability",
  unavailable: "Currently unavailable",
};

const AVAILABILITY_TONES: Record<CreatorAvailabilityStatus, string> = {
  accepting_requests:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
  limited:
    "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
  unavailable:
    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

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

  return (
    <article
      id={`post-${post.id}`}
      className="overflow-visible rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-center gap-3 px-4 py-4 sm:px-5">
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
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <CreatorFollowButton creatorId={post.creator.id} compact />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              <time
                dateTime={post.createdAt}
                title={new Date(post.createdAt).toLocaleString()}
              >
                {timeAgo(post.createdAt)}
              </time>
            </p>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${AVAILABILITY_TONES[post.creator.availabilityStatus]}`}
            >
              {AVAILABILITY_LABELS[post.creator.availabilityStatus]}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/creators/${post.creator.username}#booking`}
            aria-label={`Request to book ${post.creator.name}`}
            className="rounded-xl bg-brand-700 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-800"
          >
            Book {post.creator.name.split(" ")[0]}
          </Link>
        </div>
      </div>

      <CreatorPostMedia post={post} />

      <div className="px-4 pb-4 pt-3 sm:px-5">
        <div className="flex items-center justify-between gap-3 text-sm text-slate-500 dark:text-slate-400">
          <span>
            {likeCount > 0
              ? `${likeCount} like${likeCount === 1 ? "" : "s"}`
              : "Be the first to like this"}
          </span>
          <span>
            {commentCount > 0
              ? `${commentCount} comment${commentCount === 1 ? "" : "s"}`
              : "No comments yet"}
            {shareCount > 0 &&
              ` · ${shareCount} share${shareCount === 1 ? "" : "s"}`}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-1 border-y border-slate-100 py-2 dark:border-slate-800">
          {token ? (
            <button
              type="button"
              onClick={handleLike}
              disabled={busy === "like"}
              aria-pressed={liked}
              className={`flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-xl px-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 dark:hover:bg-slate-800 ${liked ? "text-rose-600 dark:text-rose-400" : "text-slate-600 dark:text-slate-300"}`}
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
              className="flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-xl px-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <HeartIcon aria-hidden className="h-5 w-5" />
              <span className="truncate">Like</span>
            </Link>
          )}
          <button
            type="button"
            onClick={toggleComments}
            aria-expanded={commentsOpen}
            className="flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-xl px-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ChatBubbleOvalLeftIcon aria-hidden className="h-5 w-5" />
            <span className="truncate">Comment</span>
          </button>
          {token ? (
            <button
              type="button"
              onClick={handleSave}
              disabled={busy === "save"}
              aria-pressed={saved}
              className={`flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-xl px-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 dark:hover:bg-slate-800 ${saved ? "text-brand-700 dark:text-brand-300" : "text-slate-600 dark:text-slate-300"}`}
            >
              <BookmarkIcon aria-hidden className="h-5 w-5" />
              <span className="truncate">Save</span>
            </button>
          ) : (
            <Link
              href="/login"
              className="flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-xl px-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <BookmarkIcon aria-hidden className="h-5 w-5" />
              <span className="truncate">Save</span>
            </Link>
          )}
          <ShareMenu
            placeName={post.creator.name}
            shareUrl={shareUrl}
            contentType="post"
            variant="circle"
            onShare={handleShare}
          />
        </div>

        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200">
          {post.caption || (
            <span className="italic text-slate-400">
              Shared a new story from Liberia.
            </span>
          )}
        </p>

        {commentsOpen && (
          <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
            {loadingComments ? (
              <p className="text-sm text-slate-500">Loading comments…</p>
            ) : comments.length > 0 ? (
              <div className="space-y-3">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex items-start gap-2">
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
                        className="rounded-full p-1 text-slate-400 hover:text-rose-600"
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
            <div className="mt-3 flex items-end gap-2">
              {token ? (
                <>
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
                    className="min-h-11 rounded-2xl bg-brand-700 px-3 text-sm font-semibold text-white disabled:opacity-50"
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
