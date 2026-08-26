/** Same transform BusinessesService.buildBusinessSlug uses to generate a
 * business's slug from its name — pulled out here so anything that needs
 * to compute "what would this name's slug look like" (without the
 * DB-uniqueness dedup loop, which only makes sense at creation time) can
 * share the one definition instead of re-deriving it. */
export function slugify(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || ""
  );
}

/** `slugify(name)`, deduped against `exists(slug)` by appending -2, -3,
 * ... until a free one is found — the rename-time sibling of
 * PlacesService.buildPlaceSlug/BusinessesService.buildBusinessSlug (which
 * only cover slug generation at creation). Takes a predicate instead of a
 * repository so one implementation works across every entity that has this
 * problem: a place or category corrected after a data-entry mistake (e.g.
 * "Kpatawee Waterfall" retitled "Nimba Ecolodge") kept the old slug
 * forever, because a rename only ever *changed the slug's name column,
 * not its slug* — the row went on being served, filtered, and linked to
 * under a URL that named the wrong place. `exists` should report whether
 * some OTHER row already holds a candidate slug — a caller renaming row
 * `id` should exclude that same id from the check, or an unchanged name
 * would "conflict" with itself and get a pointless "-2" suffix. */
export async function buildUniqueSlug(
  name: string,
  exists: (slug: string) => Promise<boolean>,
  fallback = "item",
): Promise<string> {
  const base = slugify(name) || fallback;
  let slug = base;
  let suffix = 2;
  while (await exists(slug)) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  return slug;
}
