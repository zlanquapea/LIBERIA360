import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAnalyticsEvents1786821897922 implements MigrationInterface {
  name = "AddAnalyticsEvents1786821897922";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."analytics_events_event_type_enum" AS ENUM('view', 'save', 'contact_click', 'booking_request')`,
    );
    await queryRunner.query(
      `CREATE TABLE "analytics_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "place_id" uuid NOT NULL, "event_type" "public"."analytics_events_event_type_enum" NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5d643d67a09b55653e98616f421" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5fd22c0f40082a50617d1244a0" ON "analytics_events" ("place_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fdc8a094358675ba5c22c5fe31" ON "analytics_events" ("event_type") `,
    );
    await queryRunner.query(
      `ALTER TABLE "analytics_events" ADD CONSTRAINT "FK_5fd22c0f40082a50617d1244a0e" FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "analytics_events" DROP CONSTRAINT "FK_5fd22c0f40082a50617d1244a0e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fdc8a094358675ba5c22c5fe31"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5fd22c0f40082a50617d1244a0"`,
    );
    await queryRunner.query(`DROP TABLE "analytics_events"`);
    await queryRunner.query(
      `DROP TYPE "public"."analytics_events_event_type_enum"`,
    );
  }
}
