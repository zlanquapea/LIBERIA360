import { MigrationInterface, QueryRunner } from "typeorm";

/** Rent-a-car: bookings with handover and return, payments and chat. */
export class AddCarRentals1793300000000 implements MigrationInterface {
  name = "AddCarRentals1793300000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "car_rentals_status_enum" AS ENUM
        ('requested','confirmed','on_trip','returned','declined','cancelled','no_show')`);
    await queryRunner.query(
      `CREATE TYPE "car_rentals_rental_unit_enum" AS ENUM ('day','hour')`,
    );
    await queryRunner.query(`
      CREATE TYPE "car_rentals_payment_method_enum" AS ENUM
        ('cash_at_pickup','mtn_momo','orange_money')`);
    await queryRunner.query(`
      CREATE TYPE "car_rentals_payment_status_enum" AS ENUM
        ('pay_at_pickup','awaiting_verification','paid','failed','refund_due','refunded')`);
    await queryRunner.query(`
      CREATE TYPE "car_rentals_fuel_enum" AS ENUM
        ('empty','quarter','half','three_quarters','full')`);

    await queryRunner.query(`
      CREATE TABLE "rental_settings" (
        "owner_user_id" uuid NOT NULL,
        "cash_at_pickup_enabled" boolean NOT NULL DEFAULT true,
        "mtn_momo_number" varchar(40),
        "orange_money_number" varchar(40),
        "mobile_money_account_name" varchar(120),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rental_settings" PRIMARY KEY ("owner_user_id"),
        CONSTRAINT "FK_rental_settings_owner" FOREIGN KEY ("owner_user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )`);

    await queryRunner.query(`
      CREATE TABLE "car_rentals" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" varchar(8) NOT NULL,
        "car_listing_id" uuid,
        "owner_user_id" uuid NOT NULL,
        "renter_user_id" uuid NOT NULL,
        "status" "car_rentals_status_enum" NOT NULL DEFAULT 'requested',
        "rental_unit" "car_rentals_rental_unit_enum" NOT NULL DEFAULT 'day',
        "pickup_date" date NOT NULL,
        "return_date" date NOT NULL,
        "pickup_time" varchar(5) NOT NULL,
        "return_time" varchar(5) NOT NULL,
        "units" smallint NOT NULL,
        "with_driver" boolean NOT NULL DEFAULT false,
        "additional_driver" boolean NOT NULL DEFAULT false,
        "delivery" boolean NOT NULL DEFAULT false,
        "delivery_address" text,
        "renter_name" varchar(120) NOT NULL,
        "renter_phone" varchar(40) NOT NULL,
        "licence_number" varchar(60),
        "notes" text,
        "car_title" varchar(160) NOT NULL,
        "car_image" text,
        "pickup_location" varchar(200),
        "unit_price" numeric(10,2) NOT NULL,
        "base_amount" numeric(10,2) NOT NULL,
        "driver_fee" numeric(10,2) NOT NULL DEFAULT 0,
        "additional_driver_fee" numeric(10,2) NOT NULL DEFAULT 0,
        "delivery_fee" numeric(10,2) NOT NULL DEFAULT 0,
        "total_amount" numeric(10,2) NOT NULL,
        "deposit_amount" numeric(10,2),
        "mileage_limit_per_day" integer,
        "excess_mileage_fee" numeric(10,2),
        "currency" varchar(3) NOT NULL DEFAULT 'USD',
        "payment_method" "car_rentals_payment_method_enum" NOT NULL,
        "payment_status" "car_rentals_payment_status_enum" NOT NULL,
        "payment_reference" varchar(80),
        "payment_account" varchar(40),
        "owner_note" text,
        "picked_up_at" TIMESTAMP WITH TIME ZONE,
        "pickup_odometer" integer,
        "pickup_fuel" "car_rentals_fuel_enum",
        "pickup_notes" text,
        "licence_checked" boolean NOT NULL DEFAULT false,
        "deposit_collected" numeric(10,2),
        "returned_at" TIMESTAMP WITH TIME ZONE,
        "return_odometer" integer,
        "return_fuel" "car_rentals_fuel_enum",
        "return_notes" text,
        "extra_charges" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "extras_total" numeric(10,2) NOT NULL DEFAULT 0,
        "deposit_returned" numeric(10,2),
        "confirmed_at" TIMESTAMP WITH TIME ZONE,
        "cancelled_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_car_rentals" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_car_rentals_dates" CHECK ("return_date" >= "pickup_date" AND "units" > 0),
        CONSTRAINT "FK_car_rentals_car" FOREIGN KEY ("car_listing_id")
          REFERENCES "car_listings"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_car_rentals_renter" FOREIGN KEY ("renter_user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_car_rentals_code" ON "car_rentals" ("code")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_car_rentals_renter" ON "car_rentals" ("renter_user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_car_rentals_car_pickup" ON "car_rentals" ("car_listing_id", "pickup_date")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_car_rentals_owner_pickup" ON "car_rentals" ("owner_user_id", "pickup_date")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_car_rentals_payment_reference" ON "car_rentals" ("payment_method", "payment_reference") WHERE payment_reference IS NOT NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "rental_messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "rental_id" uuid NOT NULL,
        "sender_user_id" uuid NOT NULL,
        "body" text NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "read_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_rental_messages" PRIMARY KEY ("id"),
        CONSTRAINT "FK_rental_messages_rental" FOREIGN KEY ("rental_id")
          REFERENCES "car_rentals"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_rental_messages_sender" FOREIGN KEY ("sender_user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_rental_messages_rental" ON "rental_messages" ("rental_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "rental_messages"`);
    await queryRunner.query(`DROP TABLE "car_rentals"`);
    await queryRunner.query(`DROP TABLE "rental_settings"`);
    await queryRunner.query(`DROP TYPE "car_rentals_fuel_enum"`);
    await queryRunner.query(`DROP TYPE "car_rentals_payment_status_enum"`);
    await queryRunner.query(`DROP TYPE "car_rentals_payment_method_enum"`);
    await queryRunner.query(`DROP TYPE "car_rentals_rental_unit_enum"`);
    await queryRunner.query(`DROP TYPE "car_rentals_status_enum"`);
  }
}
