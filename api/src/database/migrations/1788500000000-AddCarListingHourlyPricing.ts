import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCarListingHourlyPricing1788500000000 implements MigrationInterface {
  name = "AddCarListingHourlyPricing1788500000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "car_listings"
      ADD COLUMN "price_per_hour" numeric(10,2),
      ADD COLUMN "min_rental_hours" smallint,
      ADD COLUMN "driver_fee_per_hour" numeric(10,2)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "car_listings"
      DROP COLUMN "driver_fee_per_hour",
      DROP COLUMN "min_rental_hours",
      DROP COLUMN "price_per_hour"
    `);
  }
}
