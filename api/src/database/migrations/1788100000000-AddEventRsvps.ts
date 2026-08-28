import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEventRsvps1788100000000 implements MigrationInterface {
  name = "AddEventRsvps1788100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" ADD "interested_count" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" ADD "going_count" integer NOT NULL DEFAULT '0'`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."event_rsvps_status_enum" AS ENUM('interested', 'going')`,
    );
    await queryRunner.query(
      `CREATE TABLE "event_rsvps" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "event_id" uuid NOT NULL, "user_id" uuid NOT NULL, "status" "public"."event_rsvps_status_enum" NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_event_rsvps" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_event_rsvps_event_id" ON "event_rsvps" ("event_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_event_rsvps_user_id" ON "event_rsvps" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_event_rsvps_event_user" ON "event_rsvps" ("event_id", "user_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_rsvps" ADD CONSTRAINT "FK_event_rsvps_event_id" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_rsvps" ADD CONSTRAINT "FK_event_rsvps_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "event_rsvps" DROP CONSTRAINT "FK_event_rsvps_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_rsvps" DROP CONSTRAINT "FK_event_rsvps_event_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_event_rsvps_event_user"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_event_rsvps_user_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_event_rsvps_event_id"`);
    await queryRunner.query(`DROP TABLE "event_rsvps"`);
    await queryRunner.query(`DROP TYPE "public"."event_rsvps_status_enum"`);

    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "going_count"`);
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN "interested_count"`,
    );
  }
}
