import { MigrationInterface, QueryRunner } from "typeorm";

// The migration that introduced `ticket_number` (AddEventTicketInstanceType
// AndNumber) had to give existing rows *some* value to satisfy the new
// NOT NULL column, and used '' — which is exactly the "Ticket ID:" label
// with nothing after it that this migration exists to fix. Any ticket
// instance issued before that migration ran is still sitting on an empty
// ticket_number today; this backfills a real one for every such row, then
// locks the column so it can never happen again.
export class BackfillEventTicketInstanceNumbers1789400000000 implements MigrationInterface {
  name = "BackfillEventTicketInstanceNumbers1789400000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const blank: Array<{
      id: string;
      event_id: string;
      ticket_type_id: string | null;
      ticket_type_name: string;
    }> = await queryRunner.query(`
      SELECT "id", "event_id", "ticket_type_id", "ticket_type_name"
      FROM "event_ticket_instances"
      WHERE "ticket_number" = ''
      ORDER BY "event_id" ASC, "ticket_type_id" ASC NULLS FIRST, "sequence" ASC, "created_at" ASC
    `);
    // Numbering must continue after any tickets already issued for the same
    // (event, ticket type) under the new code, rather than restart at 1 and
    // collide with a real ticket number already in use.
    const alreadyNumbered: Array<{
      event_id: string;
      ticket_type_id: string | null;
      count: string;
    }> = await queryRunner.query(`
      SELECT "event_id", "ticket_type_id", COUNT(*) AS count
      FROM "event_ticket_instances"
      WHERE "ticket_number" <> ''
      GROUP BY "event_id", "ticket_type_id"
    `);
    const nextNumber = new Map<string, number>();
    for (const row of alreadyNumbered) {
      nextNumber.set(
        `${row.event_id}::${row.ticket_type_id ?? ""}`,
        Number(row.count),
      );
    }

    // Same abbreviation rule as EventTicketsService#ticketTypeCode — kept
    // in sync deliberately since both produce the same "L360-VIP-00291"
    // style ticket number.
    const ticketTypeCode = (name: string): string => {
      const cleaned = name
        .toUpperCase()
        .replace(/[^A-Z0-9\s]/g, "")
        .trim();
      if (!cleaned) return "GEN";
      const words = cleaned.split(/\s+/).filter(Boolean);
      if (words.length > 1)
        return words
          .map((word) => word[0])
          .join("")
          .slice(0, 4);
      return words[0].slice(0, 3);
    };

    for (const row of blank) {
      const key = `${row.event_id}::${row.ticket_type_id ?? ""}`;
      const number = (nextNumber.get(key) ?? 0) + 1;
      nextNumber.set(key, number);
      const code = ticketTypeCode(row.ticket_type_name);
      const ticketNumber = `L360-${code}-${String(number).padStart(5, "0")}`;
      await queryRunner.query(
        `UPDATE "event_ticket_instances" SET "ticket_number" = $1 WHERE "id" = $2`,
        [ticketNumber, row.id],
      );
    }

    // Runs unconditionally (not just when `blank` was non-empty) so a fresh
    // database — never carrying any blank rows in the first place — still
    // ends up with the same guarantee as one that was backfilled.
    // Belt-and-braces: a ticket without a real ID is, per product
    // requirements, not a fully created ticket — enforce that at the data
    // layer so it can't silently regress again.
    await queryRunner.query(`
      ALTER TABLE "event_ticket_instances"
      ADD CONSTRAINT "CHK_event_ticket_instances_ticket_number_set"
      CHECK ("ticket_number" <> '')
    `);
    await queryRunner.query(`
      ALTER TABLE "event_ticket_instances" ALTER COLUMN "ticket_number" DROP DEFAULT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "event_ticket_instances" ALTER COLUMN "ticket_number" SET DEFAULT ''
    `);
    await queryRunner.query(`
      ALTER TABLE "event_ticket_instances"
      DROP CONSTRAINT IF EXISTS "CHK_event_ticket_instances_ticket_number_set"
    `);
    // Backfilled values are real ticket numbers now potentially shown to
    // customers — restoring blanks would recreate the exact bug this
    // migration fixes, so the data itself is left in place on rollback.
  }
}
