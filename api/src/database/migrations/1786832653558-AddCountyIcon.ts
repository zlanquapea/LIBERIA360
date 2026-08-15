import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCountyIcon1786832653558 implements MigrationInterface {
  name = "AddCountyIcon1786832653558";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "counties" ADD "icon" character varying(50)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "counties" DROP COLUMN "icon"`);
  }
}
