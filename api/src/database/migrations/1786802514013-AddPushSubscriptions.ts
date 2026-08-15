import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPushSubscriptions1786802514013 implements MigrationInterface {
  name = "AddPushSubscriptions1786802514013";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "push_subscriptions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "endpoint" text NOT NULL, "p256dh" character varying(255) NOT NULL, "auth" character varying(255) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_0008bdfd174e533a3f98bf9af16" UNIQUE ("endpoint"), CONSTRAINT "PK_757fc8f00c34f66832668dc2e53" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6771f119f1c06d2ccf38f23866" ON "push_subscriptions" ("user_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "push_subscriptions" ADD CONSTRAINT "FK_6771f119f1c06d2ccf38f238664" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "push_subscriptions" DROP CONSTRAINT "FK_6771f119f1c06d2ccf38f238664"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6771f119f1c06d2ccf38f23866"`,
    );
    await queryRunner.query(`DROP TABLE "push_subscriptions"`);
  }
}
