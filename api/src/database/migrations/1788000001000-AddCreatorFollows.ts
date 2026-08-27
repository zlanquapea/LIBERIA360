import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCreatorFollows1788000001000 implements MigrationInterface {
  name = "AddCreatorFollows1788000001000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "creator_follows" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "creator_id" uuid NOT NULL, "user_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_creator_follows" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_creator_follows_creator_id" ON "creator_follows" ("creator_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_creator_follows_user_id" ON "creator_follows" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_creator_follows_creator_id_user_id_unique" ON "creator_follows" ("creator_id", "user_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "creator_follows" ADD CONSTRAINT "FK_creator_follows_creator_id" FOREIGN KEY ("creator_id") REFERENCES "creators"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "creator_follows" ADD CONSTRAINT "FK_creator_follows_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "creator_follows" DROP CONSTRAINT "FK_creator_follows_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "creator_follows" DROP CONSTRAINT "FK_creator_follows_creator_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_creator_follows_creator_id_user_id_unique"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_creator_follows_user_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_creator_follows_creator_id"`,
    );
    await queryRunner.query(`DROP TABLE "creator_follows"`);
  }
}
