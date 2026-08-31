import {
  createCreatorFeedAdSession,
  mergeCreatorPostsWithAds,
  randomAdInterval,
} from "./creator-feed-ads";
import type { Ad, CreatorPost } from "./types";

function post(id: string): CreatorPost {
  return {
    id,
    creatorId: "creator-1",
    mediaType: "text",
    mediaUrl: "",
    caption: `Post ${id}`,
    status: "published",
    likeCount: 0,
    commentCount: 0,
    saveCount: 0,
    shareCount: 0,
    creator: {
      id: "creator-1",
      name: "Creator",
      username: "creator",
      profileImage: null,
      verificationStatus: "unverified",
      availabilityStatus: "accepting_requests",
      category: "other",
      county: null,
    },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const ads: Ad[] = [
  {
    id: "ad-1",
    sponsorLabel: "Sponsored",
    image: null,
    title: "First ad",
    description: "First description",
    ctaType: "learn_more",
    ctaUrl: "/ads/ad-1",
  },
  {
    id: "ad-2",
    sponsorLabel: "Sponsored",
    image: null,
    title: "Second ad",
    description: "Second description",
    ctaType: "learn_more",
    ctaUrl: "/ads/ad-2",
  },
];

describe("creator feed ad merge", () => {
  it("generates only 4-to-6 post intervals", () => {
    expect(randomAdInterval(() => 0)).toBe(4);
    expect(randomAdInterval(() => 0.5)).toBe(5);
    expect(randomAdInterval(() => 0.999)).toBe(6);
  });

  it("skips ads when the feed has fewer posts than the first interval", () => {
    const session = createCreatorFeedAdSession();
    session.intervals = [5];

    const items = mergeCreatorPostsWithAds(
      ["1", "2", "3", "4"].map(post),
      ads,
      session,
    );

    expect(items.every((item) => item.kind === "post")).toBe(true);
  });

  it("keeps the interval across pagination and rotates ads without consecutive ads", () => {
    const session = createCreatorFeedAdSession();
    session.intervals = [5, 4];

    const firstPage = mergeCreatorPostsWithAds(
      ["1", "2", "3", "4", "5", "6"].map(post),
      ads,
      session,
    );
    expect(firstPage.map((item) => item.kind)).toEqual([
      "post",
      "post",
      "post",
      "post",
      "post",
      "ad",
      "post",
    ]);

    const allItems = mergeCreatorPostsWithAds(
      ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"].map(post),
      ads,
      session,
    );
    const adItems = allItems.filter(
      (item): item is Extract<typeof item, { kind: "ad" }> =>
        item.kind === "ad",
    );

    expect(adItems.map((item) => item.ad.id)).toEqual(["ad-1", "ad-2"]);
    expect(allItems.findIndex((item) => item.kind === "ad")).toBe(5);
    expect(allItems[10]?.kind).toBe("ad");
    expect(
      allItems.every(
        (item, index) =>
          item.kind !== "ad" || allItems[index - 1]?.kind !== "ad",
      ),
    ).toBe(true);
  });

  it("never inserts an ad before the first organic post", () => {
    const session = createCreatorFeedAdSession();
    session.intervals = [4];
    const items = mergeCreatorPostsWithAds(
      ["1", "2", "3", "4"].map(post),
      ads,
      session,
    );

    expect(items[0]?.kind).toBe("post");
  });
});
