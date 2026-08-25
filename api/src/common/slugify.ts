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
