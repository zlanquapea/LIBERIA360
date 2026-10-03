import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPlacePracticalInfoReportsAndPlatformAnalytics1791500000000 implements MigrationInterface {
  name = "AddPlacePracticalInfoReportsAndPlatformAnalytics1791500000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Practical details on places, with provenance. Existing places get no
    // source or checked date: unknown is shown as unknown.
    await queryRunner.query(
      `CREATE TYPE "public"."places_practical_info_source_enum" AS ENUM('liberia360_team', 'business_owner', 'community', 'official_source')`,
    );
    await queryRunner.query(`
      ALTER TABLE "places"
        ADD "amenities" text array NOT NULL DEFAULT '{}',
        ADD "accessibility_notes" text,
        ADD "transport_notes" text,
        ADD "practical_info_source" "public"."places_practical_info_source_enum",
        ADD "practical_info_checked_at" TIMESTAMP WITH TIME ZONE
    `);

    // "Report incorrect details" on a place page. Same ADD VALUE caveat as
    // earlier enum migrations: nothing here writes the new values.
    await queryRunner.query(
      `ALTER TYPE "public"."content_reports_target_type_enum" ADD VALUE IF NOT EXISTS 'place'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."content_reports_reason_enum" ADD VALUE IF NOT EXISTS 'incorrect_info'`,
    );

    // Product-usage analytics: searches, trips created, places added to
    // trips. Searches and trip creation have no target, so they carry the
    // search text (searches only) instead.
    for (const value of ["add_to_trip", "search", "trip_create"]) {
      await queryRunner.query(
        `ALTER TYPE "public"."analytics_events_event_type_enum" ADD VALUE IF NOT EXISTS '${value}'`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE "analytics_events" ADD "query" character varying(100)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Enum values can't be dropped in Postgres; rows using them are removed
    // (analytics) or left for an admin to resolve (reports).
    await queryRunner.query(
      `DELETE FROM "analytics_events" WHERE "event_type" IN ('add_to_trip', 'search', 'trip_create')`,
    );
    await queryRunner.query(
      `ALTER TABLE "analytics_events" DROP COLUMN "query"`,
    );
    await queryRunner.query(`
      ALTER TABLE "places"
        DROP COLUMN "practical_info_checked_at",
        DROP COLUMN "practical_info_source",
        DROP COLUMN "transport_notes",
        DROP COLUMN "accessibility_notes",
        DROP COLUMN "amenities"
    `);
    await queryRunner.query(
      `DROP TYPE "public"."places_practical_info_source_enum"`,
    );
  }
}
