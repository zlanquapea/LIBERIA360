import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPlacesFullTextSearchIndex1786881750357 implements MigrationInterface {
  name = "AddPlacesFullTextSearchIndex1786881750357";

  // GIN expression index, not a stored generated column — the expression
  // here has to stay textually in sync with SEARCH_VECTOR_SQL in
  // places.service.ts (see that file's comment) for Postgres's planner to
  // actually use this index instead of a full scan.
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX "places_search_vector_idx" ON "places"
      USING GIN (
        (
          setweight(to_tsvector('english', coalesce("name", '')), 'A') ||
          setweight(to_tsvector('english', coalesce("description", '')), 'B')
        )
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "places_search_vector_idx"`);
  }
}
