import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFoodOrderDeliveryAndPayments1791400000000 implements MigrationInterface {
  name = "AddFoodOrderDeliveryAndPayments1791400000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Restaurant-level delivery and payment settings.
    await queryRunner.query(`
      ALTER TABLE "menu_settings"
        ADD "pickup_enabled" boolean NOT NULL DEFAULT true,
        ADD "delivery_enabled" boolean NOT NULL DEFAULT false,
        ADD "delivery_fee" numeric(10,2) NOT NULL DEFAULT 0,
        ADD "free_delivery_minimum" numeric(10,2),
        ADD "delivery_areas" character varying(300),
        ADD "delivery_estimate" character varying(40),
        ADD "cash_enabled" boolean NOT NULL DEFAULT true,
        ADD "mtn_momo_number" character varying(30),
        ADD "orange_money_number" character varying(30),
        ADD "mobile_money_name" character varying(100),
        ADD CONSTRAINT "CHK_menu_settings_fulfillment" CHECK ("pickup_enabled" OR "delivery_enabled"),
        ADD CONSTRAINT "CHK_menu_settings_delivery_fee" CHECK ("delivery_fee" >= 0)
    `);

    // New order lifecycle steps. Same ADD VALUE caveat as earlier enum
    // migrations: nothing below writes these values, so they're safe to add
    // inside this transaction.
    for (const value of [
      "preparing",
      "ready",
      "out_for_delivery",
      "completed",
    ]) {
      await queryRunner.query(
        `ALTER TYPE "public"."food_orders_status_enum" ADD VALUE IF NOT EXISTS '${value}'`,
      );
    }

    await queryRunner.query(
      `CREATE TYPE "public"."food_orders_fulfillment_enum" AS ENUM('pickup', 'delivery')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."food_orders_payment_method_enum" AS ENUM('cash', 'mtn_momo', 'orange_money')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."food_orders_payment_status_enum" AS ENUM('pay_on_delivery', 'awaiting_verification', 'paid', 'failed', 'refund_due', 'refunded')`,
    );
    await queryRunner.query(`
      ALTER TABLE "food_orders"
        ADD "subtotal" numeric(10,2) NOT NULL DEFAULT 0,
        ADD "delivery_fee" numeric(10,2) NOT NULL DEFAULT 0,
        ADD "fulfillment" "public"."food_orders_fulfillment_enum" NOT NULL DEFAULT 'pickup',
        ADD "delivery_address" text,
        ADD "contact_phone" character varying(30),
        ADD "payment_method" "public"."food_orders_payment_method_enum" NOT NULL DEFAULT 'cash',
        ADD "payment_status" "public"."food_orders_payment_status_enum" NOT NULL DEFAULT 'pay_on_delivery',
        ADD "payment_reference" character varying(100),
        ADD "payment_account" character varying(30)
    `);
    // Orders before this had no delivery, so their subtotal is their total.
    await queryRunner.query(
      `UPDATE "food_orders" SET "subtotal" = "total_amount"`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_food_orders_business_payment_reference"
        ON "food_orders" ("business_id", "payment_reference")
        WHERE payment_reference IS NOT NULL AND status NOT IN ('declined', 'cancelled')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."UQ_food_orders_business_payment_reference"`,
    );
    await queryRunner.query(`
      ALTER TABLE "food_orders"
        DROP COLUMN "payment_account",
        DROP COLUMN "payment_reference",
        DROP COLUMN "payment_status",
        DROP COLUMN "payment_method",
        DROP COLUMN "contact_phone",
        DROP COLUMN "delivery_address",
        DROP COLUMN "fulfillment",
        DROP COLUMN "delivery_fee",
        DROP COLUMN "subtotal"
    `);
    await queryRunner.query(
      `DROP TYPE "public"."food_orders_payment_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."food_orders_payment_method_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."food_orders_fulfillment_enum"`,
    );
    // The new food_orders_status_enum values can't be dropped in Postgres;
    // move any orders using them back to the nearest old state.
    await queryRunner.query(
      `UPDATE "food_orders" SET "status" = 'confirmed' WHERE "status" IN ('preparing', 'ready', 'out_for_delivery', 'completed')`,
    );
    await queryRunner.query(`
      ALTER TABLE "menu_settings"
        DROP CONSTRAINT "CHK_menu_settings_delivery_fee",
        DROP CONSTRAINT "CHK_menu_settings_fulfillment",
        DROP COLUMN "mobile_money_name",
        DROP COLUMN "orange_money_number",
        DROP COLUMN "mtn_momo_number",
        DROP COLUMN "cash_enabled",
        DROP COLUMN "delivery_estimate",
        DROP COLUMN "delivery_areas",
        DROP COLUMN "free_delivery_minimum",
        DROP COLUMN "delivery_fee",
        DROP COLUMN "delivery_enabled",
        DROP COLUMN "pickup_enabled"
    `);
  }
}
