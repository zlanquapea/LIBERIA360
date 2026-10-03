import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCreatorPostListing1791400000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "creator_posts" ADD COLUMN "related_path" varchar(240), ADD COLUMN "related_label" varchar(100)',
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "creator_posts" DROP COLUMN "related_label", DROP COLUMN "related_path"',
    );
  }
}
