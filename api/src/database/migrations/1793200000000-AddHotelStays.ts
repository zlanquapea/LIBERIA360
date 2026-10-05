import { MigrationInterface, QueryRunner } from "typeorm";

/** Rooms, availability and front-desk bookings for hotels and lodges. */
export class AddHotelStays1793200000000 implements MigrationInterface {
  name = "AddHotelStays1793200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "room_reservations_status_enum" AS ENUM
        ('requested','confirmed','checked_in','checked_out','declined','cancelled','no_show')`);
    await queryRunner.query(`
      CREATE TYPE "room_reservations_source_enum" AS ENUM ('online','walk_in')`);
    await queryRunner.query(`
      CREATE TYPE "room_reservations_payment_method_enum" AS ENUM
        ('pay_at_property','mtn_momo','orange_money')`);
    await queryRunner.query(`
      CREATE TYPE "room_reservations_payment_status_enum" AS ENUM
        ('pay_at_property','awaiting_verification','paid','failed','refund_due','refunded')`);

    await queryRunner.query(`
      CREATE TABLE "room_types" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "business_id" uuid NOT NULL,
        "name" varchar(80) NOT NULL,
        "description" text,
        "images" text array NOT NULL DEFAULT '{}',
        "max_guests" smallint NOT NULL DEFAULT 2,
        "bed_summary" varchar(80),
        "price_per_night" numeric(10,2) NOT NULL,
        "total_rooms" smallint NOT NULL,
        "amenities" text array NOT NULL DEFAULT '{}',
        "is_active" boolean NOT NULL DEFAULT true,
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_room_types" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_room_types_counts" CHECK ("total_rooms" > 0 AND "max_guests" > 0 AND "price_per_night" >= 0),
        CONSTRAINT "FK_room_types_business" FOREIGN KEY ("business_id")
          REFERENCES "businesses"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_room_types_business" ON "room_types" ("business_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "room_blocks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "room_type_id" uuid NOT NULL,
        "start_date" date NOT NULL,
        "end_date" date NOT NULL,
        "rooms" smallint NOT NULL DEFAULT 1,
        "reason" varchar(200),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_room_blocks" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_room_blocks_range" CHECK ("end_date" >= "start_date" AND "rooms" > 0),
        CONSTRAINT "FK_room_blocks_room_type" FOREIGN KEY ("room_type_id")
          REFERENCES "room_types"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_room_blocks_room_type_start" ON "room_blocks" ("room_type_id", "start_date")`,
    );

    await queryRunner.query(`
      CREATE TABLE "stay_settings" (
        "business_id" uuid NOT NULL,
        "currency" varchar(3) NOT NULL DEFAULT 'USD',
        "check_in_time" varchar(5) NOT NULL DEFAULT '14:00',
        "check_out_time" varchar(5) NOT NULL DEFAULT '11:00',
        "instant_confirm" boolean NOT NULL DEFAULT false,
        "pay_at_property_enabled" boolean NOT NULL DEFAULT true,
        "mtn_momo_number" varchar(40),
        "orange_money_number" varchar(40),
        "mobile_money_account_name" varchar(120),
        "cancellation_policy" text,
        "house_rules" text,
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_stay_settings" PRIMARY KEY ("business_id"),
        CONSTRAINT "FK_stay_settings_business" FOREIGN KEY ("business_id")
          REFERENCES "businesses"("id") ON DELETE CASCADE
      )`);

    await queryRunner.query(`
      CREATE TABLE "room_reservations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" varchar(8) NOT NULL,
        "business_id" uuid NOT NULL,
        "guest_user_id" uuid,
        "room_type_id" uuid,
        "source" "room_reservations_source_enum" NOT NULL DEFAULT 'online',
        "check_in" date NOT NULL,
        "check_out" date NOT NULL,
        "nights" smallint NOT NULL,
        "rooms" smallint NOT NULL DEFAULT 1,
        "adults" smallint NOT NULL DEFAULT 1,
        "children" smallint NOT NULL DEFAULT 0,
        "guest_name" varchar(120) NOT NULL,
        "guest_phone" varchar(40),
        "arrival_time" varchar(60),
        "special_requests" text,
        "room_name" varchar(80) NOT NULL,
        "price_per_night" numeric(10,2) NOT NULL,
        "total_amount" numeric(12,2) NOT NULL,
        "currency" varchar(3) NOT NULL DEFAULT 'USD',
        "status" "room_reservations_status_enum" NOT NULL DEFAULT 'requested',
        "payment_method" "room_reservations_payment_method_enum" NOT NULL,
        "payment_status" "room_reservations_payment_status_enum" NOT NULL,
        "payment_reference" varchar(80),
        "payment_account" varchar(40),
        "property_note" text,
        "room_numbers" varchar(60),
        "confirmed_at" TIMESTAMP WITH TIME ZONE,
        "checked_in_at" TIMESTAMP WITH TIME ZONE,
        "checked_out_at" TIMESTAMP WITH TIME ZONE,
        "cancelled_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_room_reservations" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_room_reservations_stay" CHECK ("check_out" > "check_in" AND "rooms" > 0 AND "nights" > 0),
        CONSTRAINT "FK_room_reservations_business" FOREIGN KEY ("business_id")
          REFERENCES "businesses"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_room_reservations_guest" FOREIGN KEY ("guest_user_id")
          REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_room_reservations_room_type" FOREIGN KEY ("room_type_id")
          REFERENCES "room_types"("id") ON DELETE SET NULL
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_room_reservations_code" ON "room_reservations" ("code")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_room_reservations_guest" ON "room_reservations" ("guest_user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_room_reservations_business_check_in" ON "room_reservations" ("business_id", "check_in")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_room_reservations_room_type_check_in" ON "room_reservations" ("room_type_id", "check_in")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_room_reservations_payment_reference" ON "room_reservations" ("payment_method", "payment_reference") WHERE payment_reference IS NOT NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "reservation_messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "reservation_id" uuid NOT NULL,
        "sender_user_id" uuid NOT NULL,
        "body" text NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "read_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_reservation_messages" PRIMARY KEY ("id"),
        CONSTRAINT "FK_reservation_messages_reservation" FOREIGN KEY ("reservation_id")
          REFERENCES "room_reservations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_reservation_messages_sender" FOREIGN KEY ("sender_user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_reservation_messages_reservation" ON "reservation_messages" ("reservation_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "reservation_messages"`);
    await queryRunner.query(`DROP TABLE "room_reservations"`);
    await queryRunner.query(`DROP TABLE "stay_settings"`);
    await queryRunner.query(`DROP TABLE "room_blocks"`);
    await queryRunner.query(`DROP TABLE "room_types"`);
    await queryRunner.query(
      `DROP TYPE "room_reservations_payment_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "room_reservations_payment_method_enum"`,
    );
    await queryRunner.query(`DROP TYPE "room_reservations_source_enum"`);
    await queryRunner.query(`DROP TYPE "room_reservations_status_enum"`);
  }
}
