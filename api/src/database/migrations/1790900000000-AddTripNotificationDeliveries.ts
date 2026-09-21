import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTripNotificationDeliveries1790900000000 implements MigrationInterface {
  name = "AddTripNotificationDeliveries1790900000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "trip_notification_deliveries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "itinerary_id" uuid NOT NULL,
        "recipient_user_id" uuid NOT NULL,
        "kind" character varying(80) NOT NULL,
        "in_app_sent" boolean NOT NULL DEFAULT false,
        "email_sent" boolean NOT NULL DEFAULT false,
        "sent_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_trip_notification_deliveries_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_trip_notification_delivery" UNIQUE ("itinerary_id", "recipient_user_id", "kind"),
        CONSTRAINT "FK_trip_notification_delivery_itinerary" FOREIGN KEY ("itinerary_id") REFERENCES "itineraries"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_trip_notification_delivery_user" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_trip_notification_delivery_itinerary_kind" ON "trip_notification_deliveries" ("itinerary_id", "kind")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_trip_notification_delivery_itinerary_kind"`,
    );
    await queryRunner.query(
      `ALTER TABLE "trip_notification_deliveries" DROP CONSTRAINT "FK_trip_notification_delivery_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "trip_notification_deliveries" DROP CONSTRAINT "FK_trip_notification_delivery_itinerary"`,
    );
    await queryRunner.query(
      `ALTER TABLE "trip_notification_deliveries" DROP CONSTRAINT "UQ_trip_notification_delivery"`,
    );
    await queryRunner.query(`DROP TABLE "trip_notification_deliveries"`);
  }
}
