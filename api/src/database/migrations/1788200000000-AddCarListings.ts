import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCarListings1788200000000 implements MigrationInterface {
  name = "AddCarListings1788200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Widen the business type enum — ADD VALUE can't run inside the same
    // transaction that goes on to use the new value, but this migration
    // never writes a 'car_rental' row itself, so that's not a concern
    // here (same reasoning as AddBusinessProfileExpansion's widening).
    await queryRunner.query(
      `ALTER TYPE "public"."businesses_type_enum" ADD VALUE IF NOT EXISTS 'car_rental'`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."car_listings_category_enum" AS ENUM('economy', 'compact', 'sedan', 'suv', 'van', 'minibus', 'pickup', 'luxury')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."car_listings_transmission_enum" AS ENUM('automatic', 'manual')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."car_listings_fuel_type_enum" AS ENUM('petrol', 'diesel', 'hybrid', 'electric')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."car_listings_review_status_enum" AS ENUM('draft', 'submitted_for_review', 'approved', 'rejected', 'suspended')`,
    );

    await queryRunner.query(`
      CREATE TABLE "car_listings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "business_id" uuid NOT NULL,
        "title" character varying(150) NOT NULL,
        "make" character varying(60) NOT NULL,
        "model" character varying(60) NOT NULL,
        "year" smallint NOT NULL,
        "category" "public"."car_listings_category_enum" NOT NULL,
        "transmission" "public"."car_listings_transmission_enum" NOT NULL,
        "fuel_type" "public"."car_listings_fuel_type_enum" NOT NULL,
        "seats" smallint NOT NULL,
        "price_per_day" numeric(10,2) NOT NULL,
        "with_driver_available" boolean NOT NULL DEFAULT false,
        "driver_fee_per_day" numeric(10,2),
        "min_rental_days" smallint NOT NULL DEFAULT 1,
        "security_deposit" numeric(10,2),
        "features" text array NOT NULL DEFAULT '{}',
        "images" text array NOT NULL DEFAULT '{}',
        "description" text,
        "pickup_location" character varying(200),
        "is_active" boolean NOT NULL DEFAULT true,
        "review_status" "public"."car_listings_review_status_enum" NOT NULL DEFAULT 'draft',
        "rejection_reason" text,
        "submitted_at" TIMESTAMP WITH TIME ZONE,
        "reviewed_at" TIMESTAMP WITH TIME ZONE,
        "reviewed_by_user_id" uuid,
        "rating" numeric(3,2) NOT NULL DEFAULT 0,
        "review_count" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_car_listings_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "car_listings" ADD CONSTRAINT "FK_car_listings_business" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_car_listings_business" ON "car_listings" ("business_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_car_listings_review_status" ON "car_listings" ("review_status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_car_listings_review_status"`);
    await queryRunner.query(`DROP INDEX "IDX_car_listings_business"`);
    await queryRunner.query(
      `ALTER TABLE "car_listings" DROP CONSTRAINT "FK_car_listings_business"`,
    );
    await queryRunner.query(`DROP TABLE "car_listings"`);
    await queryRunner.query(
      `DROP TYPE "public"."car_listings_review_status_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."car_listings_fuel_type_enum"`);
    await queryRunner.query(
      `DROP TYPE "public"."car_listings_transmission_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."car_listings_category_enum"`);
    // Postgres has no ALTER TYPE ... DROP VALUE — reverting the widened
    // businesses_type_enum would mean rebuilding the type and every
    // column/constraint that depends on it. Left as a documented no-op,
    // same precedent as AddBusinessProfileExpansion's down().
  }
}
