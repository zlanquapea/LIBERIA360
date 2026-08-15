import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCreatorFeatured1786822370755 implements MigrationInterface {
  name = "AddCreatorFeatured1786822370755";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "creators" ADD "featured" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "creators" DROP COLUMN "featured"`);
  }
}
