import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTicketTransfers1790000004000 implements MigrationInterface {
  name = "AddTicketTransfers1790000004000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "event_ticket_instances" ADD "current_owner_user_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_ticket_instances" ADD CONSTRAINT "FK_event_ticket_instances_current_owner" FOREIGN KEY ("current_owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_event_ticket_instances_current_owner" ON "event_ticket_instances" ("current_owner_user_id")`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."ticket_transfers_status_enum" AS ENUM('pending', 'accepted', 'declined', 'cancelled')`,
    );
    await queryRunner.query(`
      CREATE TABLE "ticket_transfers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "ticket_instance_id" uuid NOT NULL,
        "event_id" uuid NOT NULL,
        "from_user_id" uuid NOT NULL,
        "email" character varying(255) NOT NULL,
        "to_user_id" uuid,
        "token_hash" text NOT NULL,
        "status" "public"."ticket_transfers_status_enum" NOT NULL DEFAULT 'pending',
        "responded_at" TIMESTAMP WITH TIME ZONE,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "email_delivered" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ticket_transfers_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_ticket_transfers_instance_status" ON "ticket_transfers" ("ticket_instance_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ticket_transfers_to_user_id" ON "ticket_transfers" ("to_user_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_ticket_transfers_token_hash" ON "ticket_transfers" ("token_hash")`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket_transfers" ADD CONSTRAINT "FK_ticket_transfers_instance" FOREIGN KEY ("ticket_instance_id") REFERENCES "event_ticket_instances"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket_transfers" ADD CONSTRAINT "FK_ticket_transfers_event" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket_transfers" ADD CONSTRAINT "FK_ticket_transfers_from_user" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket_transfers" ADD CONSTRAINT "FK_ticket_transfers_to_user" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ticket_transfers" DROP CONSTRAINT "FK_ticket_transfers_to_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket_transfers" DROP CONSTRAINT "FK_ticket_transfers_from_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket_transfers" DROP CONSTRAINT "FK_ticket_transfers_event"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket_transfers" DROP CONSTRAINT "FK_ticket_transfers_instance"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ticket_transfers_token_hash"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ticket_transfers_to_user_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ticket_transfers_instance_status"`,
    );
    await queryRunner.query(`DROP TABLE "ticket_transfers"`);
    await queryRunner.query(
      `DROP TYPE "public"."ticket_transfers_status_enum"`,
    );

    await queryRunner.query(
      `DROP INDEX "public"."IDX_event_ticket_instances_current_owner"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_ticket_instances" DROP CONSTRAINT "FK_event_ticket_instances_current_owner"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_ticket_instances" DROP COLUMN "current_owner_user_id"`,
    );
  }
}
