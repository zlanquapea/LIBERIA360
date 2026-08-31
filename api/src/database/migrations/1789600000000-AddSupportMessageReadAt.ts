import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSupportMessageReadAt1789600000000 implements MigrationInterface {
  name = "AddSupportMessageReadAt1789600000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "support_messages" ADD "read_at" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "support_messages" DROP COLUMN "read_at"`,
    );
  }
}
