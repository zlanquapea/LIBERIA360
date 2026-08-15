import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBookings1786821581540 implements MigrationInterface {
  name = "AddBookings1786821581540";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."bookings_status_enum" AS ENUM('pending', 'confirmed', 'declined', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bookings_payment_provider_enum" AS ENUM('mtn_momo')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bookings_payment_status_enum" AS ENUM('unpaid', 'pending', 'paid', 'refunded')`,
    );
    await queryRunner.query(
      `CREATE TABLE "bookings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "guest_user_id" uuid NOT NULL, "requested_date" date NOT NULL, "requested_end_date" date, "party_size" smallint, "notes" text, "status" "public"."bookings_status_enum" NOT NULL DEFAULT 'pending', "business_response" text, "responded_at" TIMESTAMP WITH TIME ZONE, "payment_provider" "public"."bookings_payment_provider_enum" NOT NULL DEFAULT 'mtn_momo', "payment_status" "public"."bookings_payment_status_enum" NOT NULL DEFAULT 'unpaid', "payment_reference" character varying(255), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_bee6805982cc1e248e94ce94957" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_272c637acac69fc055b6cc5d74" ON "bookings" ("business_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_29c64df9cd4235652acebdc058" ON "bookings" ("guest_user_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD CONSTRAINT "FK_272c637acac69fc055b6cc5d746" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD CONSTRAINT "FK_29c64df9cd4235652acebdc0583" FOREIGN KEY ("guest_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT "FK_29c64df9cd4235652acebdc0583"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT "FK_272c637acac69fc055b6cc5d746"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_29c64df9cd4235652acebdc058"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_272c637acac69fc055b6cc5d74"`,
    );
    await queryRunner.query(`DROP TABLE "bookings"`);
    await queryRunner.query(
      `DROP TYPE "public"."bookings_payment_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."bookings_payment_provider_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."bookings_status_enum"`);
  }
}
