import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCreatorAnalytics1786960000000 implements MigrationInterface {
  name = "AddCreatorAnalytics1786960000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // analytics_events.place_id becomes nullable — an event now targets
    // either a Place or a Creator (see AnalyticsEvent entity's doc
    // comment), never both.
    await queryRunner.query(
      `ALTER TABLE "analytics_events" ALTER COLUMN "place_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "analytics_events" ADD "creator_id" uuid`,
    );
    await queryRunner.query(`
      ALTER TABLE "analytics_events"
      ADD CONSTRAINT "FK_analytics_events_creator_id"
      FOREIGN KEY ("creator_id") REFERENCES "creators"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_analytics_events_creator_id" ON "analytics_events" ("creator_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_analytics_events_creator_id"`);
    await queryRunner.query(
      `ALTER TABLE "analytics_events" DROP CONSTRAINT "FK_analytics_events_creator_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "analytics_events" DROP COLUMN "creator_id"`,
    );
    // Not safe to blindly restore NOT NULL — any creator-targeted event
    // rows added since `up` would have place_id NULL and violate it. Same
    // caveat as AddCreatorReviews's down migration.
    await queryRunner.query(
      `ALTER TABLE "analytics_events" ALTER COLUMN "place_id" SET NOT NULL`,
    );
  }
}
