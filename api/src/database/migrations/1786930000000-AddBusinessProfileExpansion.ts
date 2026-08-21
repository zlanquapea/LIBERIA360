import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBusinessProfileExpansion1786930000000 implements MigrationInterface {
  name = "AddBusinessProfileExpansion1786930000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Widen the business type enum — the original 4 values only covered
    // whoever claimed first, not the actual range of tourism-economy
    // operators (guides, agencies, resorts, attractions, event organizers,
    // shops, cultural/creative orgs). ADD VALUE can't run inside the same
    // transaction that goes on to use the new value, but this migration
    // only ever writes literal old-enum values ('hotel' etc.) itself, so
    // that's not a concern here.
    for (const value of [
      "travel_agency",
      "beach_resort",
      "attraction",
      "event_organizer",
      "shop",
      "cultural_org",
      "creative_business",
      "other",
    ]) {
      await queryRunner.query(
        `ALTER TYPE "public"."businesses_type_enum" ADD VALUE IF NOT EXISTS '${value}'`,
      );
    }

    await queryRunner.query(`
      CREATE TYPE "public"."businesses_review_status_enum" AS ENUM(
        'draft', 'submitted_for_review', 'under_review', 'approved', 'rejected', 'suspended'
      )
    `);

    // Business becomes a reportable ContentReport target, and the reason
    // list gains the tourist-facing categories from the Business Profiles
    // spec (fake_info is already covered by the existing 'fake' value).
    await queryRunner.query(
      `ALTER TYPE "public"."content_reports_target_type_enum" ADD VALUE IF NOT EXISTS 'business'`,
    );
    for (const value of ["fraudulent", "misleading_offer", "copyright"]) {
      await queryRunner.query(
        `ALTER TYPE "public"."content_reports_reason_enum" ADD VALUE IF NOT EXISTS '${value}'`,
      );
    }

    await queryRunner.query(`
      ALTER TABLE "businesses"
      ADD COLUMN "slug" character varying(220),
      ADD COLUMN "logo_image" text,
      ADD COLUMN "videos" text array NOT NULL DEFAULT '{}',
      ADD COLUMN "opening_hours" text,
      ADD COLUMN "price_range_min" numeric(10,2),
      ADD COLUMN "price_range_max" numeric(10,2),
      ADD COLUMN "services_offered" text array NOT NULL DEFAULT '{}',
      ADD COLUMN "review_status" "public"."businesses_review_status_enum" NOT NULL DEFAULT 'draft',
      ADD COLUMN "rejection_reason" text,
      ADD COLUMN "submitted_at" TIMESTAMP WITH TIME ZONE,
      ADD COLUMN "reviewed_at" TIMESTAMP WITH TIME ZONE,
      ADD COLUMN "reviewed_by_user_id" uuid
    `);

    // Backfill slugs for existing rows — name, lowercased and
    // hyphenated, deduped with the first 8 chars of the row's own id
    // (already unique, so this can never collide).
    await queryRunner.query(`
      UPDATE "businesses"
      SET "slug" = lower(regexp_replace(regexp_replace(trim("name"), '[^a-zA-Z0-9]+', '-', 'g'), '^-+|-+$', '', 'g'))
        || '-' || substr("id"::text, 1, 8)
      WHERE "slug" IS NULL
    `);
    await queryRunner.query(
      `ALTER TABLE "businesses" ALTER COLUMN "slug" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "businesses" ADD CONSTRAINT "UQ_businesses_slug" UNIQUE ("slug")`,
    );

    // Every business that already existed before this migration was live
    // under the old no-review-gate model — backfilling them to APPROVED
    // preserves that (the new SUBMITTED_FOR_REVIEW gate only applies to
    // claims made from here on; this migration must not silently de-list
    // every already-live business).
    await queryRunner.query(`
      UPDATE "businesses" SET "review_status" = 'approved' WHERE "owner_user_id" IS NOT NULL
    `);
    // Existing unclaimed, admin-seeded shells (no owner yet) were also
    // publicly visible before this migration — keep them that way; a
    // future claim (BusinessesService.claimExisting) leaves review_status
    // untouched, so this is the only place that needs to set it for them.
    await queryRunner.query(`
      UPDATE "businesses" SET "review_status" = 'approved' WHERE "owner_user_id" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "businesses" DROP CONSTRAINT "UQ_businesses_slug"`,
    );
    await queryRunner.query(`
      ALTER TABLE "businesses"
      DROP COLUMN "reviewed_by_user_id",
      DROP COLUMN "reviewed_at",
      DROP COLUMN "submitted_at",
      DROP COLUMN "rejection_reason",
      DROP COLUMN "review_status",
      DROP COLUMN "services_offered",
      DROP COLUMN "price_range_max",
      DROP COLUMN "price_range_min",
      DROP COLUMN "opening_hours",
      DROP COLUMN "videos",
      DROP COLUMN "logo_image",
      DROP COLUMN "slug"
    `);
    await queryRunner.query(
      `DROP TYPE "public"."businesses_review_status_enum"`,
    );
    // Postgres has no ALTER TYPE ... DROP VALUE — reverting the widened
    // businesses_type_enum / content_reports_target_type_enum /
    // content_reports_reason_enum would mean rebuilding each type and
    // every column/constraint that depends on it. Left as a documented
    // no-op rather than a risky type rebuild; down() still undoes
    // everything else in this migration (verified locally: up → down → up).
  }
}
