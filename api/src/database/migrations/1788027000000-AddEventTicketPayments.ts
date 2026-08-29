import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEventTicketPayments1788027000000 implements MigrationInterface {
  name = "AddEventTicketPayments1788027000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "events"
      ADD COLUMN "ticket_price" numeric(12,2),
      ADD COLUMN "ticket_currency" character varying(3) NOT NULL DEFAULT 'LRD',
      ADD COLUMN "ticket_capacity" integer,
      ADD COLUMN "payment_instructions" text
    `);
    await queryRunner.query(
      `CREATE TYPE "public"."event_ticket_orders_status_enum" AS ENUM('pending_payment_review', 'approved', 'rejected', 'cancelled')`,
    );
    await queryRunner.query(`
      CREATE TABLE "event_ticket_orders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "event_id" uuid NOT NULL,
        "buyer_user_id" uuid NOT NULL,
        "quantity" smallint NOT NULL,
        "unit_price" numeric(12,2) NOT NULL,
        "currency" character varying(3) NOT NULL DEFAULT 'LRD',
        "total_amount" numeric(12,2) NOT NULL,
        "payment_reference" character varying(255) NOT NULL,
        "payment_note" text,
        "status" "public"."event_ticket_orders_status_enum" NOT NULL DEFAULT 'pending_payment_review',
        "ticket_code" character varying(40),
        "review_note" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_event_ticket_orders" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_event_ticket_orders_payment_reference" UNIQUE ("event_id", "payment_reference"),
        CONSTRAINT "UQ_event_ticket_orders_ticket_code" UNIQUE ("ticket_code"),
        CONSTRAINT "FK_event_ticket_orders_event" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_event_ticket_orders_buyer" FOREIGN KEY ("buyer_user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_event_ticket_orders_event" ON "event_ticket_orders" ("event_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_event_ticket_orders_buyer" ON "event_ticket_orders" ("buyer_user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_event_ticket_orders_buyer"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_event_ticket_orders_event"`,
    );
    await queryRunner.query(`DROP TABLE "event_ticket_orders"`);
    await queryRunner.query(
      `DROP TYPE "public"."event_ticket_orders_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN "payment_instructions"`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN "ticket_capacity"`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN "ticket_currency"`,
    );
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "ticket_price"`);
  }
}
