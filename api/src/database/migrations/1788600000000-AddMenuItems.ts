import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMenuItems1788600000000 implements MigrationInterface {
  name = "AddMenuItems1788600000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "menu_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "business_id" uuid NOT NULL,
        "name" character varying(150) NOT NULL,
        "description" text,
        "price" numeric(10,2) NOT NULL,
        "image" character varying(500),
        "category" character varying(60),
        "is_available" boolean NOT NULL DEFAULT true,
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_menu_items_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "menu_items" ADD CONSTRAINT "FK_menu_items_business" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_menu_items_business" ON "menu_items" ("business_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_menu_items_business"`);
    await queryRunner.query(
      `ALTER TABLE "menu_items" DROP CONSTRAINT "FK_menu_items_business"`,
    );
    await queryRunner.query(`DROP TABLE "menu_items"`);
  }
}
