import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEventAnalytics1788400000000 implements MigrationInterface {
  name = "AddEventAnalytics1788400000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // An event now targets exactly one of Place/Creator/Advertisement/Event
    // (see AnalyticsEvent entity's doc comment) — mirrors
    // AddAdvertisementAnalytics's own addition of advertisement_id.
    await queryRunner.query(
      `ALTER TABLE "analytics_events" ADD "event_id" uuid`,
    );
    await queryRunner.query(`
      ALTER TABLE "analytics_events"
      ADD CONSTRAINT "FK_analytics_events_event_id"
      FOREIGN KEY ("event_id") REFERENCES "events"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_analytics_events_event_id" ON "analytics_events" ("event_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_analytics_events_event_id"`);
    await queryRunner.query(
      `ALTER TABLE "analytics_events" DROP CONSTRAINT "FK_analytics_events_event_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "analytics_events" DROP COLUMN "event_id"`,
    );
  }
}
