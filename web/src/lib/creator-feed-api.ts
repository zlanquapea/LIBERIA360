import type {
  CreatorPost,
  CreatorPostComment,
  CreatorPostMediaType,
  PaginatedCreatorPosts,
} from "./types";
import { apiRequest, authHeader } from "./http";

export interface CreatorFeedQuery {
  page?: number;
  limit?: number;
}

export interface CreatorPostInput {
  mediaType: CreatorPostMediaType;
  mediaUrl: string;
  caption?: string;
}

export function getCreatorFeed(
  query: { page?: number; limit?: number } = {},
): Promise<PaginatedCreatorPosts> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));
  return apiRequest<PaginatedCreatorPosts>(
    `/creators/feed${params.size ? `?${params.toString()}` : ""}`,
  );
}

export function getFollowedCreatorFeed(
  token: string,
  query: CreatorFeedQuery = {},
): Promise<PaginatedCreatorPosts> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));
  return apiRequest<PaginatedCreatorPosts>(
    `/creators/feed/following${params.size ? `?${params.toString()}` : ""}`,
    {
      headers: authHeader(token),
    },
  );
}

export function getCreatorFeedForCreator(
  username: string,
  query: CreatorFeedQuery = {},
): Promise<PaginatedCreatorPosts> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));
  return apiRequest<PaginatedCreatorPosts>(
    `/creators/feed/creator/${encodeURIComponent(username)}${params.size ? `?${params.toString()}` : ""}`,
  );
}

export function getMyCreatorPosts(token: string): Promise<CreatorPost[]> {
  return apiRequest<CreatorPost[]>("/creators/feed/me", {
    headers: authHeader(token),
  });
}

export function createCreatorPost(
  token: string,
  input: CreatorPostInput,
): Promise<CreatorPost> {
  return apiRequest<CreatorPost>("/creators/me/posts", {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export function updateCreatorPost(
  token: string,
  postId: string,
  input: Partial<CreatorPostInput>,
): Promise<CreatorPost> {
  return apiRequest<CreatorPost>(`/creators/me/posts/${postId}`, {
    method: "PATCH",
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export function removeCreatorPost(
  token: string,
  postId: string,
): Promise<void> {
  return apiRequest<void>(`/creators/me/posts/${postId}`, {
    method: "DELETE",
    headers: authHeader(token),
  });
}

export function toggleCreatorPostLike(
  token: string,
  postId: string,
): Promise<{ liked: boolean; likeCount: number }> {
  return apiRequest<{ liked: boolean; likeCount: number }>(
    `/creators/posts/${postId}/like`,
    {
      method: "POST",
      headers: authHeader(token),
    },
  );
}

export function toggleCreatorPostSave(
  token: string,
  postId: string,
): Promise<{ saved: boolean; saveCount: number }> {
  return apiRequest<{ saved: boolean; saveCount: number }>(
    `/creators/posts/${postId}/save`,
    {
      method: "POST",
      headers: authHeader(token),
    },
  );
}

export function recordCreatorPostShare(
  postId: string,
): Promise<{ shareCount: number }> {
  return apiRequest<{ shareCount: number }>(`/creators/posts/${postId}/share`, {
    method: "POST",
  });
}

export function getCreatorPostComments(
  postId: string,
  token?: string,
): Promise<CreatorPostComment[]> {
  return apiRequest<CreatorPostComment[]>(`/creators/posts/${postId}/comments`, {
    headers: token ? authHeader(token) : undefined,
  });
}

export function addCreatorPostComment(
  token: string,
  postId: string,
  body: string,
  parentId?: string,
): Promise<CreatorPostComment> {
  return apiRequest<CreatorPostComment>(`/creators/posts/${postId}/comments`, {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify({ body, ...(parentId ? { parentId } : {}) }),
  });
}

export function toggleCreatorPostCommentLike(
  token: string,
  postId: string,
  commentId: string,
): Promise<{ liked: boolean; likeCount: number }> {
  return apiRequest<{ liked: boolean; likeCount: number }>(
    `/creators/posts/${postId}/comments/${commentId}/like`,
    {
      method: "POST",
      headers: authHeader(token),
    },
  );
}

export function removeCreatorPostComment(
  token: string,
  postId: string,
  commentId: string,
): Promise<void> {
  return apiRequest<void>(`/creators/posts/${postId}/comments/${commentId}`, {
    method: "DELETE",
    headers: authHeader(token),
  });
}


import type { CreatorStory, CreatorStoryMediaType, CreatorStoryVisibility } from "./types";

export interface CreatorStoryInput {
  mediaType: CreatorStoryMediaType;
  mediaUrl: string;
  caption?: string;
  visibility?: CreatorStoryVisibility;
  placeId?: string;
  eventId?: string;
  tripId?: string;
  creatorProfileId?: string;
}

export function getActiveCreatorStories(token?: string): Promise<CreatorStory[]> {
  return apiRequest<CreatorStory[]>("/creators/stories", {
    headers: token ? authHeader(token) : undefined,
  });
}

export function getMyCreatorStories(token: string): Promise<CreatorStory[]> {
  return apiRequest<CreatorStory[]>("/creators/stories/me", { headers: authHeader(token) });
}

export function createCreatorStory(token: string, input: CreatorStoryInput): Promise<CreatorStory> {
  return apiRequest<CreatorStory>("/creators/stories", {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export function recordCreatorStoryView(token: string, storyId: string) {
  return apiRequest<{ viewed: boolean; viewCount: number }>(`/creators/stories/${storyId}/view`, {
    method: "POST",
    headers: authHeader(token),
  });
}

export function reportCreatorStory(token: string, storyId: string, reason: string) {
  return apiRequest<{ reported: boolean }>(`/creators/stories/${storyId}/report`, {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify({ reason }),
  });
}

export function deleteCreatorStory(token: string, storyId: string) {
  return apiRequest<void>(`/creators/stories/${storyId}`, {
    method: "DELETE",
    headers: authHeader(token),
  });
}


export function getCreatorStoryEligibility(token: string): Promise<{ eligible: boolean }> {
  return apiRequest<{ eligible: boolean }>("/creators/stories/eligibility", {
    headers: authHeader(token),
  });
}
