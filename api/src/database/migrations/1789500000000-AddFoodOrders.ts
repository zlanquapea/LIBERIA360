import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFoodOrders1789500000000 implements MigrationInterface {
  name = "AddFoodOrders1789500000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."food_orders_status_enum" AS ENUM('pending', 'confirmed', 'declined', 'cancelled')`,
    );
    await queryRunner.query(`
      CREATE TABLE "food_orders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "business_id" uuid NOT NULL,
        "buyer_user_id" uuid NOT NULL,
        "items" jsonb NOT NULL,
        "total_amount" numeric(10,2) NOT NULL,
        "notes" text,
        "status" "public"."food_orders_status_enum" NOT NULL DEFAULT 'pending',
        "business_response" text,
        "responded_at" TIMESTAMPTZ,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_food_orders_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "food_orders" ADD CONSTRAINT "FK_food_orders_business" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "food_orders" ADD CONSTRAINT "FK_food_orders_buyer" FOREIGN KEY ("buyer_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_food_orders_business" ON "food_orders" ("business_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_food_orders_buyer" ON "food_orders" ("buyer_user_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "food_order_messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "order_id" uuid NOT NULL,
        "sender_user_id" uuid NOT NULL,
        "body" text NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "read_at" TIMESTAMP,
        CONSTRAINT "PK_food_order_messages_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "food_order_messages" ADD CONSTRAINT "FK_food_order_messages_order" FOREIGN KEY ("order_id") REFERENCES "food_orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "food_order_messages" ADD CONSTRAINT "FK_food_order_messages_sender" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_food_order_messages_order" ON "food_order_messages" ("order_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_food_order_messages_order"`);
    await queryRunner.query(
      `ALTER TABLE "food_order_messages" DROP CONSTRAINT "FK_food_order_messages_sender"`,
    );
    await queryRunner.query(
      `ALTER TABLE "food_order_messages" DROP CONSTRAINT "FK_food_order_messages_order"`,
    );
    await queryRunner.query(`DROP TABLE "food_order_messages"`);

    await queryRunner.query(`DROP INDEX "IDX_food_orders_buyer"`);
    await queryRunner.query(`DROP INDEX "IDX_food_orders_business"`);
    await queryRunner.query(
      `ALTER TABLE "food_orders" DROP CONSTRAINT "FK_food_orders_buyer"`,
    );
    await queryRunner.query(
      `ALTER TABLE "food_orders" DROP CONSTRAINT "FK_food_orders_business"`,
    );
    await queryRunner.query(`DROP TABLE "food_orders"`);
    await queryRunner.query(`DROP TYPE "public"."food_orders_status_enum"`);
  }
}
