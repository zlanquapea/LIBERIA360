import { shuffleCreatorPosts } from "./creator-feed-shuffle";

beforeEach(() => sessionStorage.clear());
afterEach(() => jest.restoreAllMocks());
it("preserves every post without mutating the fetched page", () => {
  jest.spyOn(Math, "random").mockReturnValue(0);
  const posts = Array.from({ length: 20 }, (_, id) => ({ id: String(id) }));
  const before = [...posts];
  const result = shuffleCreatorPosts(posts, "discover");
  expect(posts).toEqual(before);
  expect(result).not.toEqual(posts);
  expect(result.map((p) => p.id).sort()).toEqual(posts.map((p) => p.id).sort());
});
it("changes the first post across reloads even when random order repeats", () => {
  jest.spyOn(Math, "random").mockReturnValue(0.999);
  const posts = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const first = shuffleCreatorPosts(posts, "discover");
  const refreshed = shuffleCreatorPosts(posts, "discover");
  expect(refreshed[0].id).not.toBe(first[0].id);
});
it("uses the currently displayed first post for a manual refresh", () => {
  jest.spyOn(Math, "random").mockReturnValue(0.999);
  expect(
    shuffleCreatorPosts([{ id: "a" }, { id: "b" }], "following", "a")[0].id,
  ).toBe("b");
});
it("handles empty and single-post feeds and unavailable storage", () => {
  jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  expect(shuffleCreatorPosts([], "discover")).toEqual([]);
  expect(shuffleCreatorPosts([{ id: "a" }], "discover")).toEqual([{ id: "a" }]);
});
