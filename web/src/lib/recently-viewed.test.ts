import {
  addRecentlyViewed,
  clearRecentlyViewed,
  getRecentlyViewed,
  subscribeToRecentlyViewed,
} from "./recently-viewed";

const PLACE = {
  id: "place-1",
  kind: "place" as const,
  href: "/places/place-1",
  title: "Test Beach",
  subtitle: "Monrovia, Montserrado",
  imageUrl: "/uploads/test.jpg",
};

describe("recently-viewed", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("starts empty and stores a real viewed item", () => {
    expect(getRecentlyViewed()).toEqual([]);

    addRecentlyViewed(PLACE);

    expect(getRecentlyViewed()).toEqual([expect.objectContaining(PLACE)]);
    expect(typeof getRecentlyViewed()[0]?.viewedAt).toBe("string");
  });

  it("moves a repeated item to the front instead of duplicating it", () => {
    addRecentlyViewed(PLACE);
    addRecentlyViewed({ ...PLACE, title: "Updated Test Beach" });

    expect(getRecentlyViewed()).toHaveLength(1);
    expect(getRecentlyViewed()[0]?.title).toBe("Updated Test Beach");
  });

  it("keeps the history bounded", () => {
    for (let i = 0; i < 15; i += 1) {
      addRecentlyViewed({
        ...PLACE,
        id: `place-${i}`,
        href: `/places/place-${i}`,
        title: `Place ${i}`,
      });
    }

    expect(getRecentlyViewed(20)).toHaveLength(12);
    expect(getRecentlyViewed()[0]?.id).toBe("place-14");
  });

  it("notifies subscribers and clears the history", () => {
    addRecentlyViewed(PLACE);
    const callback = jest.fn();
    const unsubscribe = subscribeToRecentlyViewed(callback);

    clearRecentlyViewed();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(getRecentlyViewed()).toEqual([]);
    unsubscribe();
  });
});
