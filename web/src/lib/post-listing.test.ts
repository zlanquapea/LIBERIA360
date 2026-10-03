import { parsePostListing } from "./post-listing";
it("normalizes public listing links and strips tracking parameters", () => {
  expect(parsePostListing("https://liberia360.net/en/places/robertsport?utm_source=post")?.path).toBe("/places/robertsport");
  expect(parsePostListing("/experiences/abc-123")?.action).toBe("View & book");
  expect(parsePostListing("https://www.liberia360.net/guides/sam/")?.kind).toBe("guides");
});
it.each(["javascript:alert(1)", "https://evil.test/places/a", "//evil.test/places/a", "https://liberia360.net.evil.test/places/a", "/admin/users", "/guides/me", "/places/a/b", "https://user:pass@liberia360.net/places/a"])("rejects unsafe or non-listing link %s", value => {
  expect(parsePostListing(value)).toBeNull();
});
