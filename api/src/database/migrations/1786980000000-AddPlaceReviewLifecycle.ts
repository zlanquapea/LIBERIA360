import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPlaceReviewLifecycle1786980000000
  implements MigrationInterface
{
  name = "AddPlaceReviewLifecycle1786980000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."places_review_status_enum" AS ENUM(
        'draft', 'submitted_for_review', 'under_review', 'approved', 'rejected', 'suspended'
      )
    `);

    // DEFAULT 'approved' (not 'draft', unlike businesses_review_status)
    // is deliberate — every place already in the catalog before this
    // migration was already public, and Postgres backfills that default
    // into every existing row for a NOT NULL ADD COLUMN, so this migration
    // alone can't hide anything that was visible yesterday. Only the new
    // self-submission path (PlacesService.submitPlace) explicitly sets
    // SUBMITTED_FOR_REVIEW; every other place-creation call site (admin
    // CRUD, the seed script) keeps working unchanged by relying on this
    // default. See PlaceReviewStatus's doc comment.
    await queryRunner.query(`
      ALTER TABLE "places"
      ADD COLUMN "owner_user_id" uuid,
      ADD COLUMN "review_status" "public"."places_review_status_enum" NOT NULL DEFAULT 'approved',
      ADD COLUMN "rejection_reason" text,
      ADD COLUMN "submitted_at" TIMESTAMP WITH TIME ZONE,
      ADD COLUMN "reviewed_at" TIMESTAMP WITH TIME ZONE,
      ADD COLUMN "reviewed_by_user_id" uuid
    `);

    // Moderation queue filters by status ("show me every pending
    // submission") — same reasoning as any other reviewStatus index in
    // this codebase.
    await queryRunner.query(
      `CREATE INDEX "IDX_places_review_status" ON "places" ("review_status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_places_owner_user_id" ON "places" ("owner_user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_places_owner_user_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_places_review_status"`);
    await queryRunner.query(`
      ALTER TABLE "places"
      DROP COLUMN "reviewed_by_user_id",
      DROP COLUMN "reviewed_at",
      DROP COLUMN "submitted_at",
      DROP COLUMN "rejection_reason",
      DROP COLUMN "review_status",
      DROP COLUMN "owner_user_id"
    `);
    await queryRunner.query(`DROP TYPE "public"."places_review_status_enum"`);
  }
}
