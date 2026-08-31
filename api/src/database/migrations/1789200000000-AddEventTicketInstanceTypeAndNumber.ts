import { MigrationInterface, QueryRunner } from "typeorm";

// Each EventTicketInstance already carried its own token/QR (one row per
// purchased pass, not per order) — what it didn't carry was which ticket
// *type* it belonged to, so a 2-VIP + 3-Regular order issued 5
// indistinguishable passes. This adds that identity: which event a pass
// belongs to (denormalized off the order for cheap lookups and the
// wrong-event scan check), which ticket type it was issued for, and a
// human-readable ticket number (e.g. "L360-VIP-00291") for display and
// support lookups — the QR's actual security token is unrelated and
// unaffected by any of this.
export class AddEventTicketInstanceTypeAndNumber1789200000000 implements MigrationInterface {
  name = "AddEventTicketInstanceTypeAndNumber1789200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "event_ticket_instances" ADD "event_id" uuid`,
    );
    await queryRunner.query(`
      UPDATE "event_ticket_instances" AS i
      SET "event_id" = o."event_id"
      FROM "event_ticket_orders" AS o
      WHERE o."id" = i."order_id"
    `);
    await queryRunner.query(
      `ALTER TABLE "event_ticket_instances" ALTER COLUMN "event_id" SET NOT NULL`,
    );
    await queryRunner.query(`
      ALTER TABLE "event_ticket_instances"
      ADD CONSTRAINT "FK_event_ticket_instances_event"
      FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(
      `ALTER TABLE "event_ticket_instances" ADD "ticket_type_id" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_ticket_instances" ADD "ticket_type_name" character varying(120) NOT NULL DEFAULT 'General Admission'`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_ticket_instances" ADD "ticket_number" character varying(40) NOT NULL DEFAULT ''`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_event_ticket_instances_event" ON "event_ticket_instances" ("event_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_event_ticket_instances_event_type" ON "event_ticket_instances" ("event_id", "ticket_type_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_event_ticket_instances_event_type"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_event_ticket_instances_event"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_ticket_instances" DROP COLUMN "ticket_number"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_ticket_instances" DROP COLUMN "ticket_type_name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_ticket_instances" DROP COLUMN "ticket_type_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_ticket_instances" DROP CONSTRAINT "FK_event_ticket_instances_event"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_ticket_instances" DROP COLUMN "event_id"`,
    );
  }
}
