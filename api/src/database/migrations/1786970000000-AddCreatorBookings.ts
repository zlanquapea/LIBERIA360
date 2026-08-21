import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCreatorBookings1786970000000 implements MigrationInterface {
  name = "AddCreatorBookings1786970000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // bookings.business_id becomes nullable — a booking now targets either
    // a Business or a Creator (see Booking entity's doc comment), never
    // both.
    await queryRunner.query(
      `ALTER TABLE "bookings" ALTER COLUMN "business_id" DROP NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "bookings" ADD "creator_id" uuid`);
    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD CONSTRAINT "FK_bookings_creator_id"
      FOREIGN KEY ("creator_id") REFERENCES "creators"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_bookings_creator_id" ON "bookings" ("creator_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_bookings_creator_id"`);
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT "FK_bookings_creator_id"`,
    );
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN "creator_id"`);
    // Not safe to blindly restore NOT NULL — any creator-targeted booking
    // rows added since `up` would have business_id NULL and violate it.
    // Same caveat as AddCreatorReviews's down migration.
    await queryRunner.query(
      `ALTER TABLE "bookings" ALTER COLUMN "business_id" SET NOT NULL`,
    );
  }
}
