import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCustomerSupport1789100000000 implements MigrationInterface {
  name = "AddCustomerSupport1789100000000";
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."support_tickets_category_enum" AS ENUM('account','booking','payment','listing','technical','safety','feedback','other')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."support_tickets_status_enum" AS ENUM('open','in_progress','waiting_for_customer','resolved','closed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."support_tickets_priority_enum" AS ENUM('low','medium','high','urgent')`,
    );
    await queryRunner.query(
      `CREATE TABLE "support_tickets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "reference" character varying(20) NOT NULL, "customer_user_id" uuid NOT NULL, "assigned_agent_user_id" uuid, "category" "public"."support_tickets_category_enum" NOT NULL, "subject" character varying(180) NOT NULL, "description" text NOT NULL, "attachments" text array NOT NULL DEFAULT '{}', "status" "public"."support_tickets_status_enum" NOT NULL DEFAULT 'open', "priority" "public"."support_tickets_priority_enum" NOT NULL DEFAULT 'medium', "rating" smallint, "rating_comment" text, "resolved_at" TIMESTAMP WITH TIME ZONE, "closed_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_support_ticket_reference" UNIQUE ("reference"), CONSTRAINT "PK_support_tickets" PRIMARY KEY ("id"), CONSTRAINT "FK_support_customer" FOREIGN KEY ("customer_user_id") REFERENCES "users"("id") ON DELETE CASCADE, CONSTRAINT "FK_support_agent" FOREIGN KEY ("assigned_agent_user_id") REFERENCES "users"("id") ON DELETE SET NULL)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_support_customer_created" ON "support_tickets" ("customer_user_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_support_queue" ON "support_tickets" ("status", "priority", "created_at")`,
    );
    await queryRunner.query(
      `CREATE TABLE "support_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "ticket_id" uuid NOT NULL, "sender_user_id" uuid NOT NULL, "body" text NOT NULL, "attachments" text array NOT NULL DEFAULT '{}', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_support_messages" PRIMARY KEY ("id"), CONSTRAINT "FK_support_message_ticket" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE, CONSTRAINT "FK_support_message_sender" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE CASCADE)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_support_message_thread" ON "support_messages" ("ticket_id", "created_at")`,
    );
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "support_messages"`);
    await queryRunner.query(`DROP TABLE "support_tickets"`);
    await queryRunner.query(
      `DROP TYPE "public"."support_tickets_priority_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."support_tickets_status_enum"`);
    await queryRunner.query(
      `DROP TYPE "public"."support_tickets_category_enum"`,
    );
  }
}
