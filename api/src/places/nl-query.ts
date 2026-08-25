import { CATEGORY_ALIASES, singularize } from "./places.service";

/**
 * Product review readout (Aug 25, 2026): "users should ... even use
 * natural-language searches such as 'Find me a restaurant in Sinkor' or
 * 'Things to do in Monrovia this weekend.'" A rule-based parser was chosen
 * over an LLM-backed one (see the decision recorded alongside opening
 * hours) — zero cost, no external dependency, no per-search latency.
 *
 * This deliberately only fires on a small number of recognized sentence
 * *patterns* — "<category> in <place>" and "things to do in <place>" —
 * rather than scanning a free-text query for any category-alias word
 * anywhere in it. That's the same conservatism findMatchingCategory
 * already applies for multi-word queries (see "does not apply category
 * matching to a multi-word query" in places-catalog.e2e-spec.ts): "beach
 * vacation" has no reliable signal for what's actually wanted, but
 * "restaurant in Sinkor" has an explicit locative preposition marking
 * genuine search intent. Filters extracted here only ever *fill in* gaps
 * — findAll never lets this override a filter the caller explicitly set.
 */
export interface ParsedNaturalQuery {
  category?: string; // category slug
  county?: string; // county slug
  priceMin?: number;
  priceMax?: number;
  openNow?: boolean;
}

// "<intent phrase>? <category words> in|near|at|around <location phrase>",
// e.g. "Find me a restaurant in Sinkor", "hotels near Robertsport",
// "cheap beach around Monrovia".
const INTENT_PATTERN =
  /^(?:find me|show me|i want|i need|looking for|find|get me|search for)?\s*(?:a|an|some)?\s*([a-z][a-z\s]*?)\s+(?:in|near|at|around)\s+(.+)$/i;

// "things/stuff/places/activities to do in <location> (this weekend|today|tonight)?",
// e.g. "Things to do in Monrovia this weekend".
const THINGS_TO_DO_PATTERN =
  /^(?:things|stuff|places|activities|what)\s+to\s+do\s+in\s+(.+?)(?:\s+(this\s+weekend|this\s+week|today|tonight))?$/i;

// Heuristic, not a literal fact about any place — same spirit as the
// "Any price" buckets already offered in the search UI (SearchFilters.tsx).
const PRICE_HINTS: Array<{
  words: string[];
  priceMin?: number;
  priceMax?: number;
}> = [
  { words: ["free"], priceMin: 0, priceMax: 0 },
  { words: ["cheap", "budget", "affordable", "inexpensive"], priceMax: 10 },
  {
    words: ["expensive", "luxury", "upscale", "high-end", "pricey"],
    priceMin: 50,
  },
];

const OPEN_NOW_WORDS = ["open now", "right now", "tonight", "today"];

function findCategoryInPhrase<T extends { name: string; slug: string }>(
  phrase: string,
  categories: T[],
): T | null {
  const tokens = phrase
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(singularize);
  if (tokens.length === 0) return null;

  for (const category of categories) {
    const words = `${category.name} ${category.slug}`
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
      .map(singularize);
    const aliases = (CATEGORY_ALIASES[category.slug] ?? []).map(singularize);
    if (tokens.some((t) => words.includes(t) || aliases.includes(t))) {
      return category;
    }
  }
  return null;
}

function findCountyInPhrase<T extends { name: string; slug: string }>(
  phrase: string,
  counties: T[],
): T | null {
  const normalized = phrase.toLowerCase();
  for (const county of counties) {
    // Whole-word match against the county name — "Sinkor" (a Monrovia
    // neighborhood, not a seeded county) intentionally doesn't match
    // anything here; that's correct, not a gap this function should paper
    // over by guessing.
    const nameWords = county.name.toLowerCase();
    if (
      new RegExp(
        `\\b${nameWords.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      ).test(normalized)
    ) {
      return county;
    }
  }
  return null;
}

export function parseNaturalLanguageQuery<
  C extends { name: string; slug: string },
  Y extends { name: string; slug: string },
>(q: string | undefined, categories: C[], counties: Y[]): ParsedNaturalQuery {
  const trimmed = (q ?? "").trim().toLowerCase();
  if (!trimmed) return {};

  const result: ParsedNaturalQuery = {};

  const thingsMatch = trimmed.match(THINGS_TO_DO_PATTERN);
  const intentMatch = !thingsMatch && trimmed.match(INTENT_PATTERN);

  let locationPhrase: string | undefined;
  let timeWord: string | undefined;

  if (thingsMatch) {
    locationPhrase = thingsMatch[1];
    timeWord = thingsMatch[2];
  } else if (intentMatch) {
    const categoryPhrase = intentMatch[1];
    locationPhrase = intentMatch[2];
    const category = findCategoryInPhrase(categoryPhrase, categories);
    if (category) result.category = category.slug;
  }

  if (locationPhrase) {
    const county = findCountyInPhrase(locationPhrase, counties);
    if (county) result.county = county.slug;
  }

  for (const hint of PRICE_HINTS) {
    if (hint.words.some((w) => new RegExp(`\\b${w}\\b`).test(trimmed))) {
      if (hint.priceMin !== undefined) result.priceMin = hint.priceMin;
      if (hint.priceMax !== undefined) result.priceMax = hint.priceMax;
      break;
    }
  }

  if (
    (timeWord && /today|tonight/.test(timeWord)) ||
    OPEN_NOW_WORDS.some((w) => trimmed.includes(w))
  ) {
    result.openNow = true;
  }

  return result;
}
