import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTripGuidesHosts1791000000000 implements MigrationInterface {
  name = "AddTripGuidesHosts1791000000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "guide_type_enum" AS ENUM ('tour_guide','cultural_host','nature_guide','adventure_guide','food_host')`,
    );
    await queryRunner.query(
      `CREATE TYPE "guide_verification_status_enum" AS ENUM ('pending','verified','rejected')`,
    );
    await queryRunner.query(
      `CREATE TYPE "experience_category_enum" AS ENUM ('city','culture','nature','food')`,
    );
    await queryRunner.query(
      `CREATE TYPE "experience_group_type_enum" AS ENUM ('private','small_group','group')`,
    );
    await queryRunner.query(
      `CREATE TYPE "experience_status_enum" AS ENUM ('draft','published')`,
    );
    await queryRunner.query(
      `CREATE TYPE "guide_booking_status_enum" AS ENUM ('requested','confirmed','declined','cancelled','completed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "guide_payment_status_enum" AS ENUM ('unpaid','pending','paid','refunded')`,
    );

    await queryRunner.query(`CREATE TABLE "guide_profiles" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "user_id" uuid NOT NULL,
      "guide_type" "guide_type_enum" NOT NULL,
      "bio" text NOT NULL,
      "county_id" uuid,
      "city" varchar(120) NOT NULL,
      "languages" text[] NOT NULL DEFAULT '{}',
      "verification_status" "guide_verification_status_enum" NOT NULL DEFAULT 'pending',
      "verified_at" timestamptz,
      "verified_by" uuid,
      "lta_license_number" varchar(100),
      "verification_document_key" varchar(500),
      "whatsapp_number" varchar(40),
      "slug" varchar(180) NOT NULL,
      "profile_image_url" varchar(1000),
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_guide_profiles" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_guide_profiles_user" UNIQUE ("user_id"),
      CONSTRAINT "UQ_guide_profiles_slug" UNIQUE ("slug"),
      CONSTRAINT "FK_guide_profiles_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_guide_profiles_county" FOREIGN KEY ("county_id") REFERENCES "counties"("id") ON DELETE SET NULL
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_guide_profiles_status" ON "guide_profiles" ("verification_status")`,
    );

    await queryRunner.query(`CREATE TABLE "experiences" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "guide_id" uuid NOT NULL,
      "title" varchar(180) NOT NULL,
      "description" text NOT NULL,
      "category" "experience_category_enum" NOT NULL,
      "county" varchar(120) NOT NULL,
      "place_id" uuid,
      "duration_minutes" smallint NOT NULL,
      "group_type" "experience_group_type_enum" NOT NULL,
      "max_group_size" smallint NOT NULL,
      "price_usd" numeric(10,2) NOT NULL,
      "price_lrd" numeric(12,2),
      "meeting_point_text" varchar(300) NOT NULL,
      "meeting_lat" numeric(10,7),
      "meeting_lng" numeric(10,7),
      "includes" text[] NOT NULL DEFAULT '{}',
      "cancellation_policy" text NOT NULL,
      "cover_image_url" varchar(1000),
      "status" "experience_status_enum" NOT NULL DEFAULT 'draft',
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_experiences" PRIMARY KEY ("id"),
      CONSTRAINT "FK_experiences_guide" FOREIGN KEY ("guide_id") REFERENCES "guide_profiles"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_experiences_place" FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE SET NULL
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_experiences_status_category" ON "experiences" ("status", "category")`,
    );

    await queryRunner.query(`CREATE TABLE "guide_bookings" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "experience_id" uuid NOT NULL,
      "traveler_id" uuid NOT NULL,
      "requested_date" date NOT NULL,
      "group_size" smallint NOT NULL,
      "note" text,
      "status" "guide_booking_status_enum" NOT NULL DEFAULT 'requested',
      "price_usd_snapshot" numeric(10,2) NOT NULL,
      "price_lrd_snapshot" numeric(12,2),
      "payment_status" "guide_payment_status_enum" NOT NULL DEFAULT 'unpaid',
      "guide_response" text,
      "responded_at" timestamptz,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_guide_bookings" PRIMARY KEY ("id"),
      CONSTRAINT "FK_guide_bookings_experience" FOREIGN KEY ("experience_id") REFERENCES "experiences"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_guide_bookings_traveler" FOREIGN KEY ("traveler_id") REFERENCES "users"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_guide_bookings_traveler" ON "guide_bookings" ("traveler_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_guide_bookings_experience" ON "guide_bookings" ("experience_id", "status")`,
    );

    await queryRunner.query(`CREATE TABLE "guide_reviews" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "booking_id" uuid NOT NULL,
      "traveler_id" uuid NOT NULL,
      "guide_id" uuid NOT NULL,
      "rating" smallint NOT NULL,
      "comment" text,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_guide_reviews" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_guide_reviews_booking" UNIQUE ("booking_id"),
      CONSTRAINT "CHK_guide_reviews_rating" CHECK ("rating" >= 1 AND "rating" <= 5),
      CONSTRAINT "FK_guide_reviews_booking" FOREIGN KEY ("booking_id") REFERENCES "guide_bookings"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_guide_reviews_traveler" FOREIGN KEY ("traveler_id") REFERENCES "users"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_guide_reviews_guide" FOREIGN KEY ("guide_id") REFERENCES "guide_profiles"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_guide_reviews_guide" ON "guide_reviews" ("guide_id", "created_at")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "guide_reviews"`);
    await queryRunner.query(`DROP TABLE "guide_bookings"`);
    await queryRunner.query(`DROP TABLE "experiences"`);
    await queryRunner.query(`DROP TABLE "guide_profiles"`);
    await queryRunner.query(`DROP TYPE "guide_payment_status_enum"`);
    await queryRunner.query(`DROP TYPE "guide_booking_status_enum"`);
    await queryRunner.query(`DROP TYPE "experience_status_enum"`);
    await queryRunner.query(`DROP TYPE "experience_group_type_enum"`);
    await queryRunner.query(`DROP TYPE "experience_category_enum"`);
    await queryRunner.query(`DROP TYPE "guide_verification_status_enum"`);
    await queryRunner.query(`DROP TYPE "guide_type_enum"`);
  }
}
