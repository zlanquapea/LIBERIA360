import { buildUniqueSlug, slugify } from "./slugify";

describe("slugify", () => {
  it("lowercases, trims, and dashes non-alphanumeric runs", () => {
    expect(slugify("  Nimba Ecolodge & Spa  ")).toBe("nimba-ecolodge-spa");
  });

  it("returns an empty string for a name with no alphanumeric characters", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("buildUniqueSlug", () => {
  it("returns the plain slug when nothing else holds it", async () => {
    const slug = await buildUniqueSlug("Nimba Ecolodge", async () => false);
    expect(slug).toBe("nimba-ecolodge");
  });

  it("appends -2, -3, ... until it finds a free slug", async () => {
    const taken = new Set(["nimba-ecolodge", "nimba-ecolodge-2"]);
    const slug = await buildUniqueSlug("Nimba Ecolodge", async (candidate) =>
      taken.has(candidate),
    );
    expect(slug).toBe("nimba-ecolodge-3");
  });

  it("falls back to the given default when the name has no usable characters", async () => {
    const slug = await buildUniqueSlug("!!!", async () => false, "place");
    expect(slug).toBe("place");
  });
});
