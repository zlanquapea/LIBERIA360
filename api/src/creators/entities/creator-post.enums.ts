export enum CreatorPostMediaType {
  IMAGE = "image",
  VIDEO = "video",
  TEXT = "text",
}

// Creator posts are published immediately after the creator submits them;
// moderation/reporting can be added later without blocking the core feed.
export enum CreatorPostStatus {
  PUBLISHED = "published",
  HIDDEN = "hidden",
}
