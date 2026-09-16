"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { CreatorPost, CreatorPostComment } from "@/lib/types";
import {
  addCreatorPostComment,
  getCreatorPostComments,
  toggleCreatorPostCommentLike,
} from "@/lib/creator-feed-api";
import { useAuth } from "@/hooks/useAuth";
import {
  CreatorPostViewer,
  CreatorPostViewerImagePreview,
  CreatorPostViewerVideoPreview,
} from "./CreatorPostViewer";

type CreatorPostMediaProps = {
  post: CreatorPost;
  videoPosts?: CreatorPost[];
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
  comments?: CreatorPostComment[];
  onSave: () => void;
  onShare: () => void;
};

/**
 * Feed media opens a post-focused viewer. Video posts can optionally share a
 * Reels-style playlist supplied by the feed, while image posts remain single
 * item viewers.
 */
export function CreatorPostMedia({
  post,
  videoPosts = [],
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
  comments,
  onSave,
  onShare,
}: CreatorPostMediaProps) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [activePostId, setActivePostId] = useState(post.id);
  const [viewerComments, setViewerComments] = useState<CreatorPostComment[]>(comments ?? []);
  const activePost = useMemo(
    () => videoPosts.find((item) => item.id === activePostId) ?? post,
    [activePostId, post, videoPosts],
  );
  const activeIndex = videoPosts.findIndex((item) => item.id === activePost.id);
  const hasPlaylist = post.mediaType === "video" && videoPosts.length > 1;
  const mode = activePost.mediaType === "video" ? "video" : "image";
  const isInitialPost = activePost.id === post.id;

  useEffect(() => {
    if (isInitialPost) setViewerComments(comments ?? []);
  }, [comments, isInitialPost]);

  useEffect(() => {
    if (!open) setActivePostId(post.id);
  }, [open, post.id]);

  function openViewer() {
    setActivePostId(post.id);
    setOpen(true);
  }

  function navigateTo(index: number) {
    if (!hasPlaylist || index < 0 || index >= videoPosts.length) return;
    setActivePostId(videoPosts[index].id);
  }

  async function loadViewerComments() {
    const loaded = await getCreatorPostComments(activePost.id, token ?? undefined);
    if (isInitialPost) setViewerComments(loaded);
    return loaded;
  }

  async function submitViewerComment(body: string, parentId?: string) {
    if (isInitialPost) {
      await onCommentSubmit?.(body, parentId);
      return;
    }
    if (!token) return;
    await addCreatorPostComment(token, activePost.id, body, parentId);
  }

  async function likeViewerComment(commentId: string) {
    if (isInitialPost) {
      await onCommentLike?.(commentId);
      return;
    }
    if (!token) return;
    await toggleCreatorPostCommentLike(token, activePost.id, commentId);
  }

  if (post.mediaType === "text") {
    return (
      <div className="flex min-h-52 items-center justify-center bg-gradient-to-br from-brand-950 via-brand-800 to-brand-600 px-6 py-10 text-center text-white">
        <p className="max-w-xl whitespace-pre-wrap text-lg font-semibold leading-8 sm:text-xl">
          {post.caption}
        </p>
      </div>
    );
  }

  return (
    <>
      {post.mediaType === "video" ? (
        <CreatorPostViewerVideoPreview post={post} onOpen={openViewer} />
      ) : (
        <CreatorPostViewerImagePreview post={post} onOpen={openViewer} />
      )}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <CreatorPostViewer
            post={activePost}
            videoPosts={videoPosts}
            mode={mode}
            shareUrl={
              typeof window !== "undefined"
                ? `${window.location.origin}/creators/${activePost.creator.username}#post-${activePost.id}`
                : `/creators/${activePost.creator.username}#post-${activePost.id}`
            }
            liked={isInitialPost ? liked : Boolean(activePost.viewerLiked)}
            saved={isInitialPost ? saved : Boolean(activePost.viewerSaved)}
            likeCount={isInitialPost ? likeCount : activePost.likeCount}
            commentCount={
              isInitialPost ? commentCount : activePost.commentCount
            }
            shareCount={isInitialPost ? shareCount : activePost.shareCount}
            onLike={isInitialPost ? onLike : () => undefined}
            onComment={() => {
              onComment();
            }}
            onCommentSubmit={submitViewerComment}
            onCommentLike={likeViewerComment}
            onCommentReply={isInitialPost ? onCommentReply : undefined}
            onCommentsOpen={loadViewerComments}
            comments={isInitialPost ? viewerComments : undefined}
            onSave={isInitialPost ? onSave : () => undefined}
            onShare={isInitialPost ? onShare : () => undefined}
            onClose={() => setOpen(false)}
            onPrevious={
              hasPlaylist && activeIndex > 0
                ? () => navigateTo(activeIndex - 1)
                : undefined
            }
            onNext={
              hasPlaylist &&
              activeIndex >= 0 &&
              activeIndex < videoPosts.length - 1
                ? () => navigateTo(activeIndex + 1)
                : undefined
            }
          />,
          document.body,
        )}
    </>
  );
}
