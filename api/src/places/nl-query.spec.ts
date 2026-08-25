import { parseNaturalLanguageQuery } from "./nl-query";

const CATEGORIES = [
  { name: "Food & Dining", slug: "food-dining" },
  { name: "Beaches", slug: "beaches" },
  { name: "Hotels & Lodges", slug: "hotels-lodges" },
];

const COUNTIES = [
  { name: "Montserrado", slug: "montserrado" },
  { name: "Bong", slug: "bong" },
  { name: "Nimba", slug: "nimba" },
];

describe("parseNaturalLanguageQuery", () => {
  it("returns nothing for empty/missing input", () => {
    expect(parseNaturalLanguageQuery(undefined, CATEGORIES, COUNTIES)).toEqual(
      {},
    );
    expect(parseNaturalLanguageQuery("", CATEGORIES, COUNTIES)).toEqual({});
    expect(parseNaturalLanguageQuery("   ", CATEGORIES, COUNTIES)).toEqual({});
  });

  it("extracts a category from a '<category> in <place>' sentence", () => {
    expect(
      parseNaturalLanguageQuery(
        "Find me a restaurant in Sinkor",
        CATEGORIES,
        COUNTIES,
      ),
    ).toEqual({ category: "food-dining" });
  });

  it("extracts a county when the location phrase names one", () => {
    expect(
      parseNaturalLanguageQuery("hotels near Bong", CATEGORIES, COUNTIES),
    ).toEqual({ category: "hotels-lodges", county: "bong" });
  });

  it("does not invent a county for a neighborhood not in the seeded list", () => {
    // Sinkor is a real Monrovia neighborhood, not a seeded county — no
    // county should be guessed for it.
    const result = parseNaturalLanguageQuery(
      "restaurant in Sinkor",
      CATEGORIES,
      COUNTIES,
    );
    expect(result.county).toBeUndefined();
  });

  it("extracts a location from a 'things to do in <place>' sentence", () => {
    expect(
      parseNaturalLanguageQuery(
        "Things to do in Nimba this weekend",
        CATEGORIES,
        COUNTIES,
      ),
    ).toEqual({ county: "nimba" });
  });

  it("maps 'today'/'tonight' to openNow, but not 'this weekend'", () => {
    expect(
      parseNaturalLanguageQuery(
        "things to do in Bong tonight",
        CATEGORIES,
        COUNTIES,
      ),
    ).toEqual({ county: "bong", openNow: true });
    expect(
      parseNaturalLanguageQuery(
        "things to do in Bong this weekend",
        CATEGORIES,
        COUNTIES,
      ),
    ).toEqual({ county: "bong" });
  });

  it("does not fire on a plain multi-word query with no locative preposition", () => {
    // Same conservatism as findMatchingCategory's multi-word behavior —
    // "beach vacation" isn't a clear enough signal to guess from.
    expect(
      parseNaturalLanguageQuery("beach vacation", CATEGORIES, COUNTIES),
    ).toEqual({});
  });

  it("extracts price hints from anywhere in the query", () => {
    expect(
      parseNaturalLanguageQuery(
        "free things to do in Bong",
        CATEGORIES,
        COUNTIES,
      ),
    ).toEqual({ county: "bong", priceMin: 0, priceMax: 0 });
    expect(
      parseNaturalLanguageQuery(
        "cheap restaurant in Nimba",
        CATEGORIES,
        COUNTIES,
      ),
    ).toEqual({ category: "food-dining", county: "nimba", priceMax: 10 });
    expect(
      parseNaturalLanguageQuery("luxury hotel in Nimba", CATEGORIES, COUNTIES),
    ).toEqual({ category: "hotels-lodges", county: "nimba", priceMin: 50 });
  });

  it("recognizes 'open now' anywhere in the query", () => {
    expect(
      parseNaturalLanguageQuery("beaches open now", CATEGORIES, COUNTIES),
    ).toEqual({ openNow: true });
  });
});
