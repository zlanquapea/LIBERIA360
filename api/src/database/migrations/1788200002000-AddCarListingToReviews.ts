import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCarListingToReviews1788200002000 implements MigrationInterface {
  name = "AddCarListingToReviews1788200002000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reviews" ADD COLUMN "car_listing_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" ADD CONSTRAINT "FK_reviews_car_listing" FOREIGN KEY ("car_listing_id") REFERENCES "car_listings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reviews_car_listing" ON "reviews" ("car_listing_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" ADD CONSTRAINT "UQ_reviews_user_car_listing" UNIQUE ("user_id", "car_listing_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reviews" DROP CONSTRAINT "UQ_reviews_user_car_listing"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_reviews_car_listing"`);
    await queryRunner.query(
      `ALTER TABLE "reviews" DROP CONSTRAINT "FK_reviews_car_listing"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" DROP COLUMN "car_listing_id"`,
    );
  }
}
