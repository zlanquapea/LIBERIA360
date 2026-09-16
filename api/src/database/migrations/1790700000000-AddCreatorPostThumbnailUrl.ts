import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCreatorPostThumbnailUrl1790700000000 implements MigrationInterface {
  name = "AddCreatorPostThumbnailUrl1790700000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "creator_posts"
      ADD COLUMN "thumbnail_url" varchar(500)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "creator_posts"
      DROP COLUMN IF EXISTS "thumbnail_url"
    `);
  }
}
