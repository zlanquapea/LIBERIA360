import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAdminNotificationSettings1790000003000
  implements MigrationInterface
{
  name = "AddAdminNotificationSettings1790000003000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "admin_notification_settings" (
        "id" integer NOT NULL,
        "flagged_content_email_enabled" boolean NOT NULL DEFAULT true,
        "flagged_content_push_enabled" boolean NOT NULL DEFAULT false,
        "flagged_content_recipient_user_ids" text[] NOT NULL DEFAULT '{}',
        "updated_by_user_id" uuid,
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_admin_notification_settings_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "admin_notification_settings" ADD CONSTRAINT "FK_admin_notification_settings_updated_by" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "admin_notification_settings" DROP CONSTRAINT "FK_admin_notification_settings_updated_by"`,
    );
    await queryRunner.query(`DROP TABLE "admin_notification_settings"`);
  }
}
