import { MigrationInterface, QueryRunner } from "typeorm";

// Product feedback: an admin who mistakenly cancels an order has no way to
// bring it back — NEXT[CANCELLED] in pharmacies.service.ts is deliberately
// empty (cancelling is a one-way transition through the generic status
// PATCH), so undoing one needs its own dedicated column recording what to
// restore the order to, captured at the moment it's cancelled. See
// PharmaciesService.transition (which now sets this) and
// PharmaciesService.restoreOrder (which reads and clears it).
export class AddPharmacyOrderPreviousStatus1790500000000 implements MigrationInterface {
  name = "AddPharmacyOrderPreviousStatus1790500000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pharmacy_orders"
      ADD COLUMN "previous_status" pharmacy_order_status_enum
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pharmacy_orders" DROP COLUMN IF EXISTS "previous_status"
    `);
  }
}
