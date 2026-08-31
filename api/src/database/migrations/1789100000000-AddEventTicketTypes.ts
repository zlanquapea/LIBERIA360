import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEventTicketTypes1789100000000 implements MigrationInterface {
  name = "AddEventTicketTypes1789100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" ADD "ticket_types" jsonb NOT NULL DEFAULT '[]'::jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "ticket_types"`);
  }
}
