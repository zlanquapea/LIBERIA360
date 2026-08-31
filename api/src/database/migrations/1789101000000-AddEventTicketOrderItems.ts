import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEventTicketOrderItems1789101000000 implements MigrationInterface {
  name = "AddEventTicketOrderItems1789101000000";
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "event_ticket_orders" ADD "items" jsonb NOT NULL DEFAULT '[]'::jsonb`,
    );
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "event_ticket_orders" DROP COLUMN "items"`,
    );
  }
}
