import { MigrationInterface, QueryRunner } from "typeorm";

// A customer's satisfaction rating for one completed pharmacy order — see
// PharmacyOrderFeedback's own doc comment (entities/order.entity.ts) for
// why this is a dedicated table rather than routed through the general
// "reviews" table.
export class AddPharmacyOrderFeedback1790600000000 implements MigrationInterface {
  name = "AddPharmacyOrderFeedback1790600000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "pharmacy_order_feedback" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "order_id" uuid UNIQUE NOT NULL REFERENCES "pharmacy_orders"("id") ON DELETE CASCADE,
        "customer_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "pharmacy_id" uuid NOT NULL REFERENCES "pharmacies"("id") ON DELETE CASCADE,
        "rating" smallint NOT NULL CHECK ("rating" BETWEEN 1 AND 5),
        "comment" text,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "pharmacy_order_feedback"`);
  }
}
