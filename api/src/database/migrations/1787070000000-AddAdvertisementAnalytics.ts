import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAdvertisementAnalytics1787070000000 implements MigrationInterface {
  name = "AddAdvertisementAnalytics1787070000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // An event now targets exactly one of Place/Creator/Advertisement (see
    // AnalyticsEvent entity's doc comment) — place_id/creator_id are
    // already nullable from AddCreatorAnalytics, so only advertisement_id
    // needs adding here.
    await queryRunner.query(
      `ALTER TABLE "analytics_events" ADD "advertisement_id" uuid`,
    );
    await queryRunner.query(`
      ALTER TABLE "analytics_events"
      ADD CONSTRAINT "FK_analytics_events_advertisement_id"
      FOREIGN KEY ("advertisement_id") REFERENCES "advertisements"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_analytics_events_advertisement_id" ON "analytics_events" ("advertisement_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_analytics_events_advertisement_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "analytics_events" DROP CONSTRAINT "FK_analytics_events_advertisement_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "analytics_events" DROP COLUMN "advertisement_id"`,
    );
  }
}
