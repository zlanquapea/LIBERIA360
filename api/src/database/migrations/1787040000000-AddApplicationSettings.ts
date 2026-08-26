import { MigrationInterface, QueryRunner } from "typeorm";

export class AddApplicationSettings1787040000000
  implements MigrationInterface
{
  name = "AddApplicationSettings1787040000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "application_settings" (
        "id" integer NOT NULL,
        "freshness_flag_threshold" integer NOT NULL DEFAULT 3,
        "freshness_window_days" integer NOT NULL DEFAULT 90,
        "report_flag_threshold" integer NOT NULL DEFAULT 3,
        "report_window_days" integer NOT NULL DEFAULT 90,
        "failed_login_alert_threshold_1h" integer NOT NULL DEFAULT 5,
        "failed_login_alert_threshold_24h" integer NOT NULL DEFAULT 20,
        "updated_by_user_id" uuid,
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_application_settings_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "application_settings" ADD CONSTRAINT "FK_application_settings_updated_by" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "application_settings" DROP CONSTRAINT "FK_application_settings_updated_by"`,
    );
    await queryRunner.query(`DROP TABLE "application_settings"`);
  }
}
