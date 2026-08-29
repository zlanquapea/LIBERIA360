import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAssistantFeedback1788200000000 implements MigrationInterface {
  name = "AddAssistantFeedback1788200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."assistant_feedback_type_enum" AS ENUM('helpful', 'not_helpful', 'incorrect', 'unanswered')`,
    );
    await queryRunner.query(
      `CREATE TABLE "assistant_feedback" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" "public"."assistant_feedback_type_enum" NOT NULL, "question" character varying(600) NOT NULL, "answer" character varying(1600) NOT NULL, "source" character varying(32) NOT NULL, "current_path" character varying(160), "details" character varying(600), "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_assistant_feedback" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_assistant_feedback_type_created_at" ON "assistant_feedback" ("type", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_assistant_feedback_question" ON "assistant_feedback" ("question")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_assistant_feedback_question"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_assistant_feedback_type_created_at"`,
    );
    await queryRunner.query(`DROP TABLE "assistant_feedback"`);
    await queryRunner.query(
      `DROP TYPE "public"."assistant_feedback_type_enum"`,
    );
  }
}
