import { MigrationInterface, QueryRunner } from "typeorm";

export class AddContentReports1786895000000 implements MigrationInterface {
  name = "AddContentReports1786895000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."content_reports_target_type_enum" AS ENUM('review', 'event')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."content_reports_reason_enum" AS ENUM('spam', 'inappropriate', 'fake', 'other')
    `);
    await queryRunner.query(`
      CREATE TABLE "content_reports" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "reporter_user_id" uuid NOT NULL,
        "target_type" "public"."content_reports_target_type_enum" NOT NULL,
        "target_id" uuid NOT NULL,
        "reason" "public"."content_reports_reason_enum" NOT NULL,
        "details" character varying(500),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_content_reports_reporter_target" UNIQUE ("reporter_user_id", "target_type", "target_id"),
        CONSTRAINT "PK_content_reports_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "content_reports"
      ADD CONSTRAINT "FK_content_reports_reporter_user_id"
      FOREIGN KEY ("reporter_user_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    // The moderation queue aggregates reports per target — this is the
    // query that index serves.
    await queryRunner.query(`
      CREATE INDEX "IDX_content_reports_target" ON "content_reports" ("target_type", "target_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_content_reports_target"`);
    await queryRunner.query(
      `ALTER TABLE "content_reports" DROP CONSTRAINT "FK_content_reports_reporter_user_id"`,
    );
    await queryRunner.query(`DROP TABLE "content_reports"`);
    await queryRunner.query(`DROP TYPE "public"."content_reports_reason_enum"`);
    await queryRunner.query(
      `DROP TYPE "public"."content_reports_target_type_enum"`,
    );
  }
}
