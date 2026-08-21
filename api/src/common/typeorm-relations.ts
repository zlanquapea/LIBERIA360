/**
 * A gotcha specific to this codebase's "expose the FK as both a plain
 * scalar column and a `@ManyToOne` relation on the same `@JoinColumn`"
 * pattern (Place.category/categoryId, Place.county/countyId,
 * Business.owner/ownerUserId, Event.place/placeId, Event.county/countyId,
 * Creator.county/countyId, ...) — used everywhere so a caller can read an
 * id without loading the relation.
 *
 * The hazard: `repo.findOne()` auto-populates every `eager: true` relation.
 * If you then `repo.merge(entity, dto)` a DTO that only sets the *scalar*
 * FK column (e.g. `dto.countyId`) and `repo.save(entity)`, TypeORM's
 * persistence layer computes the column to write from the *relation
 * object* when one is loaded — not the scalar — so it silently writes back
 * the OLD relation's id and the update appears to do nothing (reproduced
 * and confirmed against a live Postgres instance; this is TypeORM's
 * documented behavior, not a bug in this codebase's SQL).
 *
 * Call this on the stale relation property (with the entity re-fetched
 * with fresh relations after save, as every caller already does) whenever
 * a DTO might reassign that relation's FK column — it clears the loaded
 * object so TypeORM falls back to the merged scalar column instead.
 */
export function clearStaleRelation<T extends object, K extends keyof T>(
  entity: T,
  relationProperty: K,
): void {
  (entity as Record<string, unknown>)[relationProperty as string] = undefined;
}
