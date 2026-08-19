import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLoginActivity1786910100000 implements MigrationInterface {
  name = "AddLoginActivity1786910100000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "login_activity" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid,
        "email_attempted" character varying(255) NOT NULL,
        "success" boolean NOT NULL,
        "reason" character varying(40) NOT NULL,
        "ip_address" character varying(64),
        "user_agent" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_login_activity_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "login_activity"
      ADD CONSTRAINT "FK_login_activity_user_id"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    // The security overview's brute-force checks (failed attempts in the
    // last 1h/24h) and the login-activity list both filter/sort on this.
    await queryRunner.query(`
      CREATE INDEX "IDX_login_activity_created_at" ON "login_activity" ("created_at")
    `);
    // "Who else has tried this email recently" — the account-enumeration
    // / credential-stuffing check.
    await queryRunner.query(`
      CREATE INDEX "IDX_login_activity_email_attempted" ON "login_activity" ("email_attempted")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_login_activity_email_attempted"`);
    await queryRunner.query(`DROP INDEX "IDX_login_activity_created_at"`);
    await queryRunner.query(
      `ALTER TABLE "login_activity" DROP CONSTRAINT "FK_login_activity_user_id"`,
    );
    await queryRunner.query(`DROP TABLE "login_activity"`);
  }
}
