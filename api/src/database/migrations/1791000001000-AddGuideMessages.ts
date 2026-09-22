import { MigrationInterface, QueryRunner } from "typeorm";

export class AddGuideMessages1791000001000 implements MigrationInterface {
  name = "AddGuideMessages1791000001000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "guide_messages" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "guide_id" uuid NOT NULL,
      "visitor_id" uuid NOT NULL,
      "sender_id" uuid NOT NULL,
      "body" text NOT NULL,
      "read_at" timestamptz,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_guide_messages" PRIMARY KEY ("id"),
      CONSTRAINT "FK_guide_messages_guide" FOREIGN KEY ("guide_id") REFERENCES "guide_profiles"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_guide_messages_visitor" FOREIGN KEY ("visitor_id") REFERENCES "users"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_guide_messages_sender" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_guide_messages_conversation" ON "guide_messages" ("guide_id", "visitor_id", "created_at")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "guide_messages"`);
  }
}
