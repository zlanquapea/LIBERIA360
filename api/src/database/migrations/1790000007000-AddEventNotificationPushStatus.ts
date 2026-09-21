import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEventNotificationPushStatus1790000007000 implements MigrationInterface {
  name = "AddEventNotificationPushStatus1790000007000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "event_notification_deliveries"
      ADD COLUMN "push_sent" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "event_notification_deliveries" DROP COLUMN "push_sent"`,
    );
  }
}
