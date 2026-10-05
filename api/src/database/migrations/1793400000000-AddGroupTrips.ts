import { MigrationInterface, QueryRunner } from "typeorm";

/** Organised group trips: hosting details, spot bookings and payments. */
export class AddGroupTrips1793400000000 implements MigrationInterface {
  name = "AddGroupTrips1793400000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "trip_booking_status_enum" AS ENUM
        ('pending','confirmed','waitlisted','declined','cancelled')`);
    await queryRunner.query(
      `CREATE TYPE "trip_payment_plan_enum" AS ENUM ('full','deposit')`,
    );
    await queryRunner.query(`
      CREATE TYPE "trip_payment_method_enum" AS ENUM
        ('cash','mtn_momo','orange_money')`);
    await queryRunner.query(`
      CREATE TYPE "trip_booking_payment_status_enum" AS ENUM
        ('free','unpaid','part_paid','paid','refund_due','refunded')`);
    await queryRunner.query(`
      CREATE TYPE "trip_payment_record_status_enum" AS ENUM
        ('awaiting_verification','received','rejected')`);

    await queryRunner.query(`
      CREATE TABLE "hosted_trips" (
        "itinerary_id" uuid NOT NULL,
        "open" boolean NOT NULL DEFAULT true,
        "tagline" varchar(140),
        "price" numeric(10,2) NOT NULL DEFAULT 0,
        "currency" varchar(3) NOT NULL DEFAULT 'USD',
        "deposit_amount" numeric(10,2),
        "balance_due_date" date,
        "booking_deadline" date,
        "spots" smallint NOT NULL,
        "max_per_booking" smallint NOT NULL DEFAULT 6,
        "require_approval" boolean NOT NULL DEFAULT false,
        "includes" text[] NOT NULL DEFAULT '{}',
        "excludes" text[] NOT NULL DEFAULT '{}',
        "activities" text[] NOT NULL DEFAULT '{}',
        "meeting_point" varchar(200),
        "departure_time" varchar(5),
        "organisers" jsonb NOT NULL DEFAULT '[]',
        "gallery" text[] NOT NULL DEFAULT '{}',
        "good_to_know" text,
        "contact_phone" varchar(30),
        "cash_enabled" boolean NOT NULL DEFAULT true,
        "mtn_momo_number" varchar(20),
        "orange_money_number" varchar(20),
        "account_name" varchar(120),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_hosted_trips" PRIMARY KEY ("itinerary_id"),
        CONSTRAINT "FK_hosted_trips_itinerary" FOREIGN KEY ("itinerary_id")
          REFERENCES "itineraries"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_hosted_trips_spots" CHECK ("spots" > 0),
        CONSTRAINT "CHK_hosted_trips_price" CHECK ("price" >= 0)
      )`);

    await queryRunner.query(`
      CREATE TABLE "trip_bookings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" varchar(12) NOT NULL,
        "itinerary_id" uuid NOT NULL,
        "host_user_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "status" "trip_booking_status_enum" NOT NULL,
        "seats" smallint NOT NULL,
        "travellers" jsonb NOT NULL DEFAULT '[]',
        "contact_name" varchar(120) NOT NULL,
        "phone" varchar(30) NOT NULL,
        "notes" text,
        "unit_price" numeric(10,2) NOT NULL,
        "total_amount" numeric(10,2) NOT NULL,
        "currency" varchar(3) NOT NULL DEFAULT 'USD',
        "deposit_amount" numeric(10,2),
        "payment_plan" "trip_payment_plan_enum" NOT NULL DEFAULT 'full',
        "payment_method" "trip_payment_method_enum",
        "amount_paid" numeric(10,2) NOT NULL DEFAULT 0,
        "payment_status" "trip_booking_payment_status_enum" NOT NULL,
        "host_note" text,
        "added_as_member" boolean NOT NULL DEFAULT false,
        "confirmed_at" TIMESTAMP WITH TIME ZONE,
        "cancelled_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_trip_bookings" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_trip_bookings_code" UNIQUE ("code"),
        CONSTRAINT "FK_trip_bookings_itinerary" FOREIGN KEY ("itinerary_id")
          REFERENCES "itineraries"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_trip_bookings_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_trip_bookings_seats" CHECK ("seats" > 0)
      )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_trip_bookings_itinerary_status" ON "trip_bookings" ("itinerary_id","status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_trip_bookings_host" ON "trip_bookings" ("host_user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_trip_bookings_user" ON "trip_bookings" ("user_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "trip_booking_payments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "booking_id" uuid NOT NULL,
        "amount" numeric(10,2) NOT NULL,
        "method" "trip_payment_method_enum" NOT NULL,
        "reference" varchar(80),
        "account" varchar(20),
        "status" "trip_payment_record_status_enum" NOT NULL,
        "recorded_by_host" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "verified_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_trip_booking_payments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_trip_booking_payments_booking" FOREIGN KEY ("booking_id")
          REFERENCES "trip_bookings"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_trip_booking_payments_amount" CHECK ("amount" > 0)
      )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_trip_booking_payments_booking" ON "trip_booking_payments" ("booking_id")`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_trip_booking_payments_reference"
        ON "trip_booking_payments" ("method","reference")
        WHERE reference IS NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "trip_booking_payments"`);
    await queryRunner.query(`DROP TABLE "trip_bookings"`);
    await queryRunner.query(`DROP TABLE "hosted_trips"`);
    await queryRunner.query(`DROP TYPE "trip_payment_record_status_enum"`);
    await queryRunner.query(`DROP TYPE "trip_booking_payment_status_enum"`);
    await queryRunner.query(`DROP TYPE "trip_payment_method_enum"`);
    await queryRunner.query(`DROP TYPE "trip_payment_plan_enum"`);
    await queryRunner.query(`DROP TYPE "trip_booking_status_enum"`);
  }
}
