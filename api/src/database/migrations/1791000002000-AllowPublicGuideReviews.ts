import { MigrationInterface, QueryRunner } from "typeorm";

export class AllowPublicGuideReviews1791000002000 implements MigrationInterface {
  name = "AllowPublicGuideReviews1791000002000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "guide_reviews" ALTER COLUMN "booking_id" DROP NOT NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "guide_reviews" WHERE "booking_id" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "guide_reviews" ALTER COLUMN "booking_id" SET NOT NULL`,
    );
  }
}
