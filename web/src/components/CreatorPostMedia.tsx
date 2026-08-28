"use client";

import { useState } from "react";
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
      {open && (
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
        />
      )}
    </>
  );
}
