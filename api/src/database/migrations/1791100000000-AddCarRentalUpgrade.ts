import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCarRentalUpgrade1791100000000 implements MigrationInterface {
  name = "AddCarRentalUpgrade1791100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."car_listings_fuel_policy_enum" AS ENUM('full_to_full', 'prepaid', 'same_to_same')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."car_listings_cancellation_policy_enum" AS ENUM('flexible', 'moderate', 'strict')`,
    );

    await queryRunner.query(`
      ALTER TABLE "car_listings"
      ADD "color" character varying(60),
      ADD "mileage_limit_per_day" integer,
      ADD "excess_mileage_fee" numeric(10,2),
      ADD "fuel_policy" "public"."car_listings_fuel_policy_enum",
      ADD "min_driver_age" smallint,
      ADD "additional_driver_allowed" boolean NOT NULL DEFAULT false,
      ADD "additional_driver_fee" numeric(10,2),
      ADD "insurance_included" boolean NOT NULL DEFAULT false,
      ADD "insurance_notes" text,
      ADD "cancellation_policy" "public"."car_listings_cancellation_policy_enum",
      ADD "delivery_available" boolean NOT NULL DEFAULT false,
      ADD "delivery_fee" numeric(10,2),
      ADD "instant_book_enabled" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      CREATE TABLE "car_listing_blocked_dates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "car_listing_id" uuid NOT NULL,
        "start_date" date NOT NULL,
        "end_date" date NOT NULL,
        "reason" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_car_listing_blocked_dates_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_car_listing_blocked_dates_range" CHECK ("end_date" >= "start_date")
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "car_listing_blocked_dates" ADD CONSTRAINT "FK_car_listing_blocked_dates_listing" FOREIGN KEY ("car_listing_id") REFERENCES "car_listings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_car_listing_blocked_dates_listing" ON "car_listing_blocked_dates" ("car_listing_id", "start_date")`,
    );

    await queryRunner.query(
      `ALTER TABLE "bookings" ADD "wants_additional_driver" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP COLUMN "wants_additional_driver"`,
    );

    await queryRunner.query(
      `DROP INDEX "public"."IDX_car_listing_blocked_dates_listing"`,
    );
    await queryRunner.query(
      `ALTER TABLE "car_listing_blocked_dates" DROP CONSTRAINT "FK_car_listing_blocked_dates_listing"`,
    );
    await queryRunner.query(`DROP TABLE "car_listing_blocked_dates"`);

    await queryRunner.query(`
      ALTER TABLE "car_listings"
      DROP COLUMN "instant_book_enabled",
      DROP COLUMN "delivery_fee",
      DROP COLUMN "delivery_available",
      DROP COLUMN "cancellation_policy",
      DROP COLUMN "insurance_notes",
      DROP COLUMN "insurance_included",
      DROP COLUMN "additional_driver_fee",
      DROP COLUMN "additional_driver_allowed",
      DROP COLUMN "min_driver_age",
      DROP COLUMN "fuel_policy",
      DROP COLUMN "excess_mileage_fee",
      DROP COLUMN "mileage_limit_per_day",
      DROP COLUMN "color"
    `);

    await queryRunner.query(
      `DROP TYPE "public"."car_listings_cancellation_policy_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."car_listings_fuel_policy_enum"`,
    );
  }
}
