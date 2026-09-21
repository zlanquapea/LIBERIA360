import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEventNotificationDeliveries1790000006000 implements MigrationInterface {
  name = "AddEventNotificationDeliveries1790000006000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "event_notification_deliveries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "event_id" uuid NOT NULL,
        "recipient_user_id" uuid NOT NULL,
        "kind" character varying(80) NOT NULL,
        "reference_id" character varying(100) NOT NULL DEFAULT '',
        "in_app_sent" boolean NOT NULL DEFAULT false,
        "email_sent" boolean NOT NULL DEFAULT false,
        "sent_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_event_notification_deliveries_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_event_notification_delivery" UNIQUE ("event_id", "recipient_user_id", "kind", "reference_id"),
        CONSTRAINT "FK_event_notification_delivery_event" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_event_notification_delivery_user" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_event_notification_delivery_event_kind" ON "event_notification_deliveries" ("event_id", "kind")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_event_notification_delivery_event_kind"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_notification_deliveries" DROP CONSTRAINT "FK_event_notification_delivery_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_notification_deliveries" DROP CONSTRAINT "FK_event_notification_delivery_event"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_notification_deliveries" DROP CONSTRAINT "UQ_event_notification_delivery"`,
    );
    await queryRunner.query(`DROP TABLE "event_notification_deliveries"`);
  }
}
