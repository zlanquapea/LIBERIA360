import { MigrationInterface, QueryRunner } from "typeorm";

// Social travel experience (Aug 2026 product spec): turns a saved
// itinerary into a shareable, joinable "trip" — a real catalog
// destination instead of free text, public/private visibility, dates, a
// cover image, a cancellable status, and (new table) requests from
// strangers to join a public trip, the counterpart to the existing
// trip_invitations table's "owner reaches out" direction.
export class AddTripSocialFeatures1789800000000 implements MigrationInterface {
  name = "AddTripSocialFeatures1789800000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."itineraries_visibility_enum" AS ENUM('private', 'public')`,
    );
    await queryRunner.query(
      `ALTER TABLE "itineraries" ADD "destination_place_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "itineraries" ADD "visibility" "public"."itineraries_visibility_enum" NOT NULL DEFAULT 'private'`,
    );
    await queryRunner.query(`ALTER TABLE "itineraries" ADD "description" text`);
    await queryRunner.query(
      `ALTER TABLE "itineraries" ADD "cover_image" character varying(500)`,
    );
    await queryRunner.query(
      `ALTER TABLE "itineraries" ADD "start_date" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "itineraries" ADD "end_date" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "itineraries" ADD "cancelled_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itineraries_destination_place_id" ON "itineraries" ("destination_place_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itineraries_visibility" ON "itineraries" ("visibility")`,
    );
    await queryRunner.query(
      `ALTER TABLE "itineraries" ADD CONSTRAINT "FK_itineraries_destination" FOREIGN KEY ("destination_place_id") REFERENCES "places"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."trip_join_requests_status_enum" AS ENUM('pending', 'approved', 'declined')`,
    );
    await queryRunner.query(`
      CREATE TABLE "trip_join_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "itinerary_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "status" "public"."trip_join_requests_status_enum" NOT NULL DEFAULT 'pending',
        "responded_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_trip_join_requests_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_trip_join_requests_itinerary_user" UNIQUE ("itinerary_id", "user_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_trip_join_requests_itinerary_id" ON "trip_join_requests" ("itinerary_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_trip_join_requests_user_id" ON "trip_join_requests" ("user_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "trip_join_requests" ADD CONSTRAINT "FK_trip_join_requests_itinerary" FOREIGN KEY ("itinerary_id") REFERENCES "itineraries"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "trip_join_requests" ADD CONSTRAINT "FK_trip_join_requests_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "trip_join_requests" DROP CONSTRAINT "FK_trip_join_requests_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "trip_join_requests" DROP CONSTRAINT "FK_trip_join_requests_itinerary"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_trip_join_requests_user_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_trip_join_requests_itinerary_id"`,
    );
    await queryRunner.query(`DROP TABLE "trip_join_requests"`);
    await queryRunner.query(
      `DROP TYPE "public"."trip_join_requests_status_enum"`,
    );

    await queryRunner.query(
      `ALTER TABLE "itineraries" DROP CONSTRAINT "FK_itineraries_destination"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_itineraries_visibility"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_itineraries_destination_place_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "itineraries" DROP COLUMN "cancelled_at"`,
    );
    await queryRunner.query(`ALTER TABLE "itineraries" DROP COLUMN "end_date"`);
    await queryRunner.query(
      `ALTER TABLE "itineraries" DROP COLUMN "start_date"`,
    );
    await queryRunner.query(
      `ALTER TABLE "itineraries" DROP COLUMN "cover_image"`,
    );
    await queryRunner.query(
      `ALTER TABLE "itineraries" DROP COLUMN "description"`,
    );
    await queryRunner.query(
      `ALTER TABLE "itineraries" DROP COLUMN "visibility"`,
    );
    await queryRunner.query(
      `ALTER TABLE "itineraries" DROP COLUMN "destination_place_id"`,
    );
    await queryRunner.query(`DROP TYPE "public"."itineraries_visibility_enum"`);
  }
}
