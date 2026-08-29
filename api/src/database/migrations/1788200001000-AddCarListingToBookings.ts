import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCarListingToBookings1788200001000 implements MigrationInterface {
  name = "AddCarListingToBookings1788200001000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD COLUMN "car_listing_id" uuid,
      ADD COLUMN "with_driver" boolean NOT NULL DEFAULT false,
      ADD COLUMN "pickup_location" character varying(200),
      ADD COLUMN "estimated_total" numeric(10,2)
    `);
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD CONSTRAINT "FK_bookings_car_listing" FOREIGN KEY ("car_listing_id") REFERENCES "car_listings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bookings_car_listing" ON "bookings" ("car_listing_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_bookings_car_listing"`);
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT "FK_bookings_car_listing"`,
    );
    await queryRunner.query(`
      ALTER TABLE "bookings"
      DROP COLUMN "estimated_total",
      DROP COLUMN "pickup_location",
      DROP COLUMN "with_driver",
      DROP COLUMN "car_listing_id"
    `);
  }
}
