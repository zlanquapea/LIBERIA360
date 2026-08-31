import type { Ad, CreatorPost } from "./types";

export type CreatorFeedItem =
  { kind: "post"; post: CreatorPost } | { kind: "ad"; ad: Ad };

export interface CreatorFeedAdSession {
  intervals: number[];
  adIds: string[];
  nextAdCursor: number;
}

export function createCreatorFeedAdSession(): CreatorFeedAdSession {
  return { intervals: [], adIds: [], nextAdCursor: 0 };
}

export function randomAdInterval(random = Math.random): number {
  return 4 + Math.floor(random() * 3);
}

function nextAd(
  ads: Ad[],
  session: CreatorFeedAdSession,
  adIndex: number,
): Ad | null {
  if (ads.length === 0) return null;

  const existingId = session.adIds[adIndex];
  const existing = existingId ? ads.find((ad) => ad.id === existingId) : null;
  if (existing) return existing;

  const previousId = session.adIds[adIndex - 1];
  const candidates =
    ads.length > 1 ? ads.filter((ad) => ad.id !== previousId) : ads;
  const ad =
    candidates[session.nextAdCursor % candidates.length] ?? candidates[0];
  session.nextAdCursor += 1;
  if (ad) session.adIds[adIndex] = ad.id;
  return ad ?? null;
}

/**
 * Merges only at presentation time. Organic posts and active ads remain separate
 * API sources, while the session object preserves interval and ad-rotation state
 * as additional pages are appended.
 */
export function mergeCreatorPostsWithAds(
  posts: CreatorPost[],
  ads: Ad[],
  session: CreatorFeedAdSession,
): CreatorFeedItem[] {
  const organicItems: CreatorFeedItem[] = posts.map((post) => ({
    kind: "post",
    post,
  }));
  if (posts.length === 0 || ads.length === 0) return organicItems;

  if (session.intervals.length === 0) {
    session.intervals.push(randomAdInterval());
  }

  // Never force an ad into a feed that has fewer organic posts than the first
  // randomized interval. This also protects sparse/empty feeds.
  if (posts.length < session.intervals[0]) return organicItems;

  const items: CreatorFeedItem[] = [];
  let postsSinceAd = 0;
  let intervalIndex = 0;
  let adIndex = 0;

  for (const post of posts) {
    items.push({ kind: "post", post });
    postsSinceAd += 1;

    const interval = session.intervals[intervalIndex];
    if (interval === undefined || postsSinceAd < interval) continue;

    const ad = nextAd(ads, session, adIndex);
    if (ad) {
      items.push({ kind: "ad", ad });
      adIndex += 1;
    }
    postsSinceAd = 0;
    intervalIndex += 1;
    session.intervals[intervalIndex] ??= randomAdInterval();
  }

  return items;
}
