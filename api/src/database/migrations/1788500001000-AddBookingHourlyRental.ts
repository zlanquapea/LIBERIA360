import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBookingHourlyRental1788500001000 implements MigrationInterface {
  name = "AddBookingHourlyRental1788500001000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."bookings_rental_unit_enum" AS ENUM('day', 'hour')`,
    );
    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD COLUMN "rental_unit" "public"."bookings_rental_unit_enum",
      ADD COLUMN "requested_start_time" character varying(5),
      ADD COLUMN "requested_end_time" character varying(5)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings"
      DROP COLUMN "requested_end_time",
      DROP COLUMN "requested_start_time",
      DROP COLUMN "rental_unit"
    `);
    await queryRunner.query(`DROP TYPE "public"."bookings_rental_unit_enum"`);
  }
}
