import { MigrationInterface, QueryRunner } from "typeorm";
import { parseOpeningHoursText } from "../../places/opening-hours";

export class AddPlaceStructuredHours1787010000000 implements MigrationInterface {
  name = "AddPlaceStructuredHours1787010000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "places" ADD "structured_hours" jsonb`,
    );

    // One-time best-effort backfill: parse whatever free-text opening_hours
    // already exists into the new structured column, using the exact same
    // parser the app uses going forward (see opening-hours.ts's doc
    // comment on why this is deliberately conservative — an unrecognized
    // phrasing is left null, not guessed at).
    const rows: { id: string; opening_hours: string }[] =
      await queryRunner.query(
        `SELECT id, opening_hours FROM "places" WHERE opening_hours IS NOT NULL`,
      );
    for (const row of rows) {
      const parsed = parseOpeningHoursText(row.opening_hours);
      if (parsed) {
        await queryRunner.query(
          `UPDATE "places" SET structured_hours = $1 WHERE id = $2`,
          [JSON.stringify(parsed), row.id],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "places" DROP COLUMN "structured_hours"`,
    );
  }
}
