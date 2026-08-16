import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAdminActions1786890000000 implements MigrationInterface {
  name = "AddAdminActions1786890000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "admin_actions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "admin_user_id" uuid NOT NULL,
        "action" character varying(100) NOT NULL,
        "target_type" character varying(50) NOT NULL,
        "target_id" uuid,
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_admin_actions_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "admin_actions"
      ADD CONSTRAINT "FK_admin_actions_admin_user_id"
      FOREIGN KEY ("admin_user_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    // The audit log's own read endpoint always orders by createdAt DESC —
    // an index here keeps that cheap as the table grows.
    await queryRunner.query(`
      CREATE INDEX "IDX_admin_actions_created_at" ON "admin_actions" ("created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_admin_actions_created_at"`);
    await queryRunner.query(
      `ALTER TABLE "admin_actions" DROP CONSTRAINT "FK_admin_actions_admin_user_id"`,
    );
    await queryRunner.query(`DROP TABLE "admin_actions"`);
  }
}
