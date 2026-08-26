import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAdvertisements1787060000000 implements MigrationInterface {
  name = "AddAdvertisements1787060000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."advertisements_type_enum" AS ENUM('digital_product', 'business')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."advertisements_review_status_enum" AS ENUM('draft', 'submitted_for_review', 'approved', 'rejected', 'suspended')`,
    );
    await queryRunner.query(`
      CREATE TABLE "advertisements" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "owner_user_id" uuid NOT NULL,
        "type" "public"."advertisements_type_enum" NOT NULL,
        "title" character varying(200) NOT NULL,
        "description" text NOT NULL,
        "images" text array NOT NULL DEFAULT '{}',
        "price_label" character varying(100),
        "contact_phone" character varying(40),
        "contact_whatsapp" character varying(40),
        "contact_email" character varying(200),
        "external_link" character varying(500),
        "review_status" "public"."advertisements_review_status_enum" NOT NULL DEFAULT 'draft',
        "rejection_reason" text,
        "submitted_at" TIMESTAMP WITH TIME ZONE,
        "reviewed_at" TIMESTAMP WITH TIME ZONE,
        "reviewed_by_user_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_advertisements_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "advertisements" ADD CONSTRAINT "FK_advertisements_owner" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_advertisements_owner" ON "advertisements" ("owner_user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_advertisements_review_status" ON "advertisements" ("review_status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_advertisements_review_status"`);
    await queryRunner.query(`DROP INDEX "IDX_advertisements_owner"`);
    await queryRunner.query(
      `ALTER TABLE "advertisements" DROP CONSTRAINT "FK_advertisements_owner"`,
    );
    await queryRunner.query(`DROP TABLE "advertisements"`);
    await queryRunner.query(
      `DROP TYPE "public"."advertisements_review_status_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."advertisements_type_enum"`);
  }
}
