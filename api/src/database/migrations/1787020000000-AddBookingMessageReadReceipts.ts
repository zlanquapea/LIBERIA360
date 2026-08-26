import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBookingMessageReadReceipts1787020000000 implements MigrationInterface {
  name = "AddBookingMessageReadReceipts1787020000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "booking_messages" ADD "read_at" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "booking_messages" DROP COLUMN "read_at"`,
    );
  }
}
