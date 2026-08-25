import type { Category } from './types';

// Frontend counterpart to the backend's category-alias matching
// (api/src/places/places.service.ts's findMatchingCategory) — used here
// only to power the zero-results "did you mean" suggestion on /search,
// not to change what actually gets searched (the API already applies its
// own version of this server-side). Kept as an intentionally simple,
// independent implementation rather than shared code across the
// Nest/Next boundary — a slight drift between the two only ever means a
// slightly-less-perfect suggestion, never a wrong search result.
const CATEGORY_ALIASES: Record<string, string[]> = {
  beaches: ['beach', 'coast', 'coastal', 'seaside', 'swimming', 'surf', 'surfing'],
  'waterfalls-nature': ['waterfall', 'nature', 'outdoors', 'scenic'],
  'hiking-adventure': ['hiking', 'hike', 'adventure', 'trek', 'trekking'],
  'culture-heritage': ['culture', 'heritage', 'history', 'historic', 'museum'],
  'food-dining': ['food', 'restaurant', 'dining', 'eat', 'cuisine'],
  nightlife: ['nightlife', 'bar', 'club', 'party'],
  'wildlife-eco-tourism': ['wildlife', 'eco', 'safari', 'animal'],
  'hotels-lodges': ['hotel', 'lodge', 'stay', 'accommodation', 'lodging'],
  'city-shopping': ['shopping', 'mall', 'market', 'city'],
  'islands-boat-trips': ['island', 'boat', 'sailing', 'ferry'],
};

function singularize(word: string): string {
  return word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word;
}

// Only matches a single-word query — a genuine multi-word search phrase
// shouldn't get hijacked into "browse this whole category" just because
// one of its words happens to overlap.
export function findMatchingCategory(categories: Category[], query: string): Category | null {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed || /\s/.test(trimmed)) return null;
  const q = singularize(trimmed);

  for (const category of categories) {
    const words = `${category.name} ${category.slug}`
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
      .map(singularize);
    if (words.includes(q)) return category;

    const aliases = CATEGORY_ALIASES[category.slug] ?? [];
    if (aliases.map(singularize).includes(q)) return category;
  }
  return null;
}
