import { MigrationInterface, QueryRunner } from "typeorm";

export class AddConversations1791000003000 implements MigrationInterface {
  name = "AddConversations1791000003000";
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "conversations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "context_type" character varying(60) NOT NULL DEFAULT 'direct', "context_id" uuid, "title" character varying(180), "avatar_url" character varying(500), "last_message_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_conversations_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_conversations_context" ON "conversations" ("context_type", "context_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_conversations_last_message" ON "conversations" ("last_message_at")`,
    );
    await queryRunner.query(
      `CREATE TABLE "conversation_participants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "conversation_id" uuid NOT NULL, "user_id" uuid NOT NULL, "role" character varying(30) NOT NULL DEFAULT 'member', "last_read_at" TIMESTAMP WITH TIME ZONE, "muted" boolean NOT NULL DEFAULT false, "archived" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_conversation_participants_id" PRIMARY KEY ("id"), CONSTRAINT "UQ_conversation_participant" UNIQUE ("conversation_id", "user_id"), CONSTRAINT "FK_conversation_participant_conversation" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE, CONSTRAINT "FK_conversation_participant_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_conversation_participant_user_read" ON "conversation_participants" ("user_id", "last_read_at")`,
    );
    await queryRunner.query(
      `CREATE TABLE "conversation_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "conversation_id" uuid NOT NULL, "sender_id" uuid NOT NULL, "body" text NOT NULL, "message_type" character varying(30) NOT NULL DEFAULT 'text', "attachments" jsonb NOT NULL DEFAULT '[]', "reactions" jsonb NOT NULL DEFAULT '{}', "delivered_at" TIMESTAMP WITH TIME ZONE, "read_at" TIMESTAMP WITH TIME ZONE, "edited_at" TIMESTAMP WITH TIME ZONE, "deleted_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_conversation_messages_id" PRIMARY KEY ("id"), CONSTRAINT "FK_conversation_message_conversation" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE, CONSTRAINT "FK_conversation_message_sender" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_conversation_messages_created" ON "conversation_messages" ("conversation_id", "created_at")`,
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "conversation_messages"`);
    await queryRunner.query(`DROP TABLE "conversation_participants"`);
    await queryRunner.query(`DROP TABLE "conversations"`);
  }
}
