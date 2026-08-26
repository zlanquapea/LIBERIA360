import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBookingMessageEditDelete1787030000000 implements MigrationInterface {
  name = "AddBookingMessageEditDelete1787030000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "booking_messages" ADD "edited_at" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking_messages" ADD "deleted_at" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "booking_messages" DROP COLUMN "deleted_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking_messages" DROP COLUMN "edited_at"`,
    );
  }
}
