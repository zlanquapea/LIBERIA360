import { MigrationInterface, QueryRunner } from "typeorm";

// Trip group chat (Section 9-12 of the Aug 2026 social-trip spec):
// messages (text and/or image, optional reply-to, soft-deletable and
// text-editable), reactions, and a per-member read cursor for computing
// each message's Sent/Delivered/Read status — see each entity's doc
// comment for why the shapes are what they are.
export class AddTripChat1789900000000 implements MigrationInterface {
  name = "AddTripChat1789900000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."trip_messages_type_enum" AS ENUM('user', 'system')`,
    );
    await queryRunner.query(`
      CREATE TABLE "trip_messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "itinerary_id" uuid NOT NULL,
        "sender_user_id" uuid,
        "type" "public"."trip_messages_type_enum" NOT NULL DEFAULT 'user',
        "body" text,
        "image_url" character varying(500),
        "client_id" character varying(100),
        "reply_to_message_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "edited_at" TIMESTAMP,
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_trip_messages_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_trip_messages_itinerary_id" ON "trip_messages" ("itinerary_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "trip_messages" ADD CONSTRAINT "FK_trip_messages_itinerary" FOREIGN KEY ("itinerary_id") REFERENCES "itineraries"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "trip_messages" ADD CONSTRAINT "FK_trip_messages_sender" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "trip_messages" ADD CONSTRAINT "FK_trip_messages_reply_to" FOREIGN KEY ("reply_to_message_id") REFERENCES "trip_messages"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(`
      CREATE TABLE "trip_message_reactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "message_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "emoji" character varying(16) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_trip_message_reactions_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_trip_message_reactions_message_user_emoji" UNIQUE ("message_id", "user_id", "emoji")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_trip_message_reactions_message_id" ON "trip_message_reactions" ("message_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "trip_message_reactions" ADD CONSTRAINT "FK_trip_message_reactions_message" FOREIGN KEY ("message_id") REFERENCES "trip_messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "trip_message_reactions" ADD CONSTRAINT "FK_trip_message_reactions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(`
      CREATE TABLE "trip_chat_read_states" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "itinerary_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "last_delivered_at" TIMESTAMP WITH TIME ZONE,
        "last_read_at" TIMESTAMP WITH TIME ZONE,
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_trip_chat_read_states_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_trip_chat_read_states_itinerary_user" UNIQUE ("itinerary_id", "user_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_trip_chat_read_states_itinerary_id" ON "trip_chat_read_states" ("itinerary_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "trip_chat_read_states" ADD CONSTRAINT "FK_trip_chat_read_states_itinerary" FOREIGN KEY ("itinerary_id") REFERENCES "itineraries"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "trip_chat_read_states" ADD CONSTRAINT "FK_trip_chat_read_states_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "trip_chat_read_states" DROP CONSTRAINT "FK_trip_chat_read_states_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "trip_chat_read_states" DROP CONSTRAINT "FK_trip_chat_read_states_itinerary"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_trip_chat_read_states_itinerary_id"`,
    );
    await queryRunner.query(`DROP TABLE "trip_chat_read_states"`);

    await queryRunner.query(
      `ALTER TABLE "trip_message_reactions" DROP CONSTRAINT "FK_trip_message_reactions_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "trip_message_reactions" DROP CONSTRAINT "FK_trip_message_reactions_message"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_trip_message_reactions_message_id"`,
    );
    await queryRunner.query(`DROP TABLE "trip_message_reactions"`);

    await queryRunner.query(
      `ALTER TABLE "trip_messages" DROP CONSTRAINT "FK_trip_messages_reply_to"`,
    );
    await queryRunner.query(
      `ALTER TABLE "trip_messages" DROP CONSTRAINT "FK_trip_messages_sender"`,
    );
    await queryRunner.query(
      `ALTER TABLE "trip_messages" DROP CONSTRAINT "FK_trip_messages_itinerary"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_trip_messages_itinerary_id"`,
    );
    await queryRunner.query(`DROP TABLE "trip_messages"`);
    await queryRunner.query(`DROP TYPE "public"."trip_messages_type_enum"`);
  }
}
