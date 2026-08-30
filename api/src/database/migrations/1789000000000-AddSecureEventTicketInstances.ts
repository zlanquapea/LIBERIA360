import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSecureEventTicketInstances1789000000000 implements MigrationInterface {
  name = "AddSecureEventTicketInstances1789000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."event_ticket_instances_status_enum" AS ENUM('issued', 'redeemed', 'void')
    `);
    await queryRunner.query(`
      CREATE TABLE "event_ticket_instances" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "order_id" uuid NOT NULL,
        "sequence" smallint NOT NULL,
        "token_hash" character varying(64) NOT NULL,
        "token_ciphertext" text NOT NULL,
        "status" "public"."event_ticket_instances_status_enum" NOT NULL DEFAULT 'issued',
        "redeemed_at" TIMESTAMP,
        "redeemed_by_user_id" uuid,
        "scan_count" integer NOT NULL DEFAULT 0,
        "last_scanned_at" TIMESTAMP,
        "last_scanned_by_user_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_event_ticket_instances" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_event_ticket_instances_token_hash" UNIQUE ("token_hash"),
        CONSTRAINT "UQ_event_ticket_instances_order_sequence" UNIQUE ("order_id", "sequence"),
        CONSTRAINT "FK_event_ticket_instances_order" FOREIGN KEY ("order_id") REFERENCES "event_ticket_orders"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_event_ticket_instances_redeemed_by" FOREIGN KEY ("redeemed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_event_ticket_instances_scanned_by" FOREIGN KEY ("last_scanned_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_event_ticket_instances_order" ON "event_ticket_instances" ("order_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_event_ticket_instances_status" ON "event_ticket_instances" ("status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_event_ticket_instances_status"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_event_ticket_instances_order"`,
    );
    await queryRunner.query(`DROP TABLE "event_ticket_instances"`);
    await queryRunner.query(
      `DROP TYPE "public"."event_ticket_instances_status_enum"`,
    );
  }
}
