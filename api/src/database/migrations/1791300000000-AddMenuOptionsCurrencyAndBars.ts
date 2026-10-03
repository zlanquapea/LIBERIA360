import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMenuOptionsCurrencyAndBars1791300000000 implements MigrationInterface {
  name = "AddMenuOptionsCurrencyAndBars1791300000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Bars/lounges/nightclubs get their own business type so they can run
    // a drinks-first menu. Same ADD VALUE caveat as AddCarListings: this
    // migration never writes a 'bar' row itself.
    await queryRunner.query(
      `ALTER TYPE "public"."businesses_type_enum" ADD VALUE IF NOT EXISTS 'bar'`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."menu_items_kind_enum" AS ENUM('food', 'drink', 'dessert')`,
    );
    await queryRunner.query(`
      ALTER TABLE "menu_items"
        ADD "kind" "public"."menu_items_kind_enum" NOT NULL DEFAULT 'food',
        ADD "tags" text array NOT NULL DEFAULT '{}',
        ADD "serving_size" character varying(40),
        ADD "contains_alcohol" boolean NOT NULL DEFAULT false,
        ADD "option_groups" jsonb NOT NULL DEFAULT '[]'
    `);

    await queryRunner.query(`
      CREATE TABLE "menu_settings" (
        "business_id" uuid NOT NULL,
        "currency" character varying(3) NOT NULL DEFAULT 'USD',
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_menu_settings_business_id" PRIMARY KEY ("business_id"),
        CONSTRAINT "CHK_menu_settings_currency" CHECK ("currency" IN ('USD', 'LRD'))
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "menu_settings" ADD CONSTRAINT "FK_menu_settings_business" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(`
      ALTER TABLE "food_orders"
        ADD "currency" character varying(3) NOT NULL DEFAULT 'USD',
        ADD CONSTRAINT "CHK_food_orders_currency" CHECK ("currency" IN ('USD', 'LRD'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "food_orders"
        DROP CONSTRAINT "CHK_food_orders_currency",
        DROP COLUMN "currency"
    `);

    await queryRunner.query(
      `ALTER TABLE "menu_settings" DROP CONSTRAINT "FK_menu_settings_business"`,
    );
    await queryRunner.query(`DROP TABLE "menu_settings"`);

    await queryRunner.query(`
      ALTER TABLE "menu_items"
        DROP COLUMN "option_groups",
        DROP COLUMN "contains_alcohol",
        DROP COLUMN "serving_size",
        DROP COLUMN "tags",
        DROP COLUMN "kind"
    `);
    await queryRunner.query(`DROP TYPE "public"."menu_items_kind_enum"`);

    // Not removing 'bar' from businesses_type_enum — Postgres can't drop an
    // enum value without rebuilding the type, and rows may already use it.
    // Same documented partial reversal as AddCarListings.
  }
}
