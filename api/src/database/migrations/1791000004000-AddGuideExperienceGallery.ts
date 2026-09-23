import { MigrationInterface, QueryRunner } from "typeorm";

export class AddGuideExperienceGallery1791000004000 implements MigrationInterface {
  name = "AddGuideExperienceGallery1791000004000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "experiences" ADD "image_urls" text[] NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "experiences" ADD "is_featured" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_experiences_guide_featured" ON "experiences" ("guide_id", "is_featured", "created_at")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_experiences_guide_featured"`);
    await queryRunner.query(
      `ALTER TABLE "experiences" DROP COLUMN "is_featured"`,
    );
    await queryRunner.query(
      `ALTER TABLE "experiences" DROP COLUMN "image_urls"`,
    );
  }
}
