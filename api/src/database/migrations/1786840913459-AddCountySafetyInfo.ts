import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCountySafetyInfo1786840913459 implements MigrationInterface {
  name = "AddCountySafetyInfo1786840913459";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "counties" ADD "emergency_number" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "counties" ADD "safety_tips" text array NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(`ALTER TABLE "counties" ADD "local_customs" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "counties" DROP COLUMN "local_customs"`,
    );
    await queryRunner.query(`ALTER TABLE "counties" DROP COLUMN "safety_tips"`);
    await queryRunner.query(
      `ALTER TABLE "counties" DROP COLUMN "emergency_number"`,
    );
  }
}
