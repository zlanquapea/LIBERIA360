import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDeviceInfoToAdminActions1786910000000 implements MigrationInterface {
  name = "AddDeviceInfoToAdminActions1786910000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "admin_actions"
      ADD "ip_address" character varying(64),
      ADD "user_agent" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "admin_actions"
      DROP COLUMN "user_agent",
      DROP COLUMN "ip_address"
    `);
  }
}
