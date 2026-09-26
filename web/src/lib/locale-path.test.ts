import { localePath, routeWithoutLocale } from "./locale-path";

describe("localePath", () => {
  it("preserves the selected non-English locale", () => {
    expect(localePath("/events", "fr")).toBe("/fr/events");
    expect(localePath("/", "ar")).toBe("/ar");
    expect(localePath("/search?q=beach", "zh")).toBe("/zh/search?q=beach");
  });

  it("does not double-prefix or alter English and external links", () => {
    expect(localePath("/fr/events", "fr")).toBe("/fr/events");
    expect(localePath("/events", "en")).toBe("/events");
    expect(localePath("https://example.com", "fr")).toBe("https://example.com");
  });
});

describe("routeWithoutLocale", () => {
  it("normalizes localized routes for active-navigation matching", () => {
    expect(routeWithoutLocale("/fr")).toBe("/");
    expect(routeWithoutLocale("/ar/trips/123")).toBe("/trips/123");
    expect(routeWithoutLocale("/events")).toBe("/events");
  });
});
