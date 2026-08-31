"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import type { CreatorPost } from "@/lib/types";
import {
  CreatorPostViewer,
  CreatorPostViewerImagePreview,
  CreatorPostViewerVideoPreview,
} from "./CreatorPostViewer";

type CreatorPostMediaProps = {
  post: CreatorPost;
  liked: boolean;
  saved: boolean;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  onLike: () => void;
  onComment: () => void;
  onSave: () => void;
  onShare: () => void;
};

/**
 * The feed keeps a compact preview, but tapping that preview opens a
 * post-focused viewer. Video uses a full-screen Reels-style surface; image
 * uses a dark Facebook-style photo surface. The viewer receives the card's
 * current engagement state so actions remain synchronized with the post card.
 */
export function CreatorPostMedia({
  post,
  liked,
  saved,
  likeCount,
  commentCount,
  shareCount,
  onLike,
  onComment,
  onSave,
  onShare,
}: CreatorPostMediaProps) {
  const [open, setOpen] = useState(false);
  const mode = post.mediaType === "video" ? "video" : "image";

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
      {mode === "video" ? (
        <CreatorPostViewerVideoPreview
          post={post}
          onOpen={() => setOpen(true)}
        />
      ) : (
        <CreatorPostViewerImagePreview
          post={post}
          onOpen={() => setOpen(true)}
        />
      )}
      {open && typeof document !== "undefined" && createPortal(
        <CreatorPostViewer
          post={post}
          mode={mode}
          shareUrl={
            typeof window !== "undefined"
              ? `${window.location.origin}/creators/${post.creator.username}#post-${post.id}`
              : `/creators/${post.creator.username}#post-${post.id}`
          }
          liked={liked}
          saved={saved}
          likeCount={likeCount}
          commentCount={commentCount}
          shareCount={shareCount}
          onLike={onLike}
          onComment={() => {
            setOpen(false);
            onComment();
          }}
          onSave={onSave}
          onShare={onShare}
          onClose={() => setOpen(false)}
        />,
        document.body,
      )}
    </>
  );
}
