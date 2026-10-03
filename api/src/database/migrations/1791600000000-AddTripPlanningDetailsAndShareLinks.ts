import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTripPlanningDetailsAndShareLinks1791600000000 implements MigrationInterface {
  name = "AddTripPlanningDetailsAndShareLinks1791600000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."itineraries_transport_mode_enum" AS ENUM('own_car', 'taxi', 'public_transport', 'tour_operator', 'mixed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."itineraries_pace_enum" AS ENUM('relaxed', 'balanced', 'packed')`,
    );
    // All nullable: existing trips simply have no planning details yet.
    await queryRunner.query(`
      ALTER TABLE "itineraries"
        ADD "starting_location" character varying(120),
        ADD "transport_mode" "public"."itineraries_transport_mode_enum",
        ADD "pace" "public"."itineraries_pace_enum",
        ADD "share_token" character varying(64),
        ADD CONSTRAINT "UQ_itineraries_share_token" UNIQUE ("share_token")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "itineraries"
        DROP CONSTRAINT "UQ_itineraries_share_token",
        DROP COLUMN "share_token",
        DROP COLUMN "pace",
        DROP COLUMN "transport_mode",
        DROP COLUMN "starting_location"
    `);
    await queryRunner.query(`DROP TYPE "public"."itineraries_pace_enum"`);
    await queryRunner.query(
      `DROP TYPE "public"."itineraries_transport_mode_enum"`,
    );
  }
}
