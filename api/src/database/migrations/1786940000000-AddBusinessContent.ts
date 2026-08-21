import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBusinessContent1786940000000 implements MigrationInterface {
  name = "AddBusinessContent1786940000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."business_content_type_enum" AS ENUM(
        'offer', 'announcement', 'article', 'travel_tip', 'experience'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."business_content_status_enum" AS ENUM(
        'draft', 'submitted_for_review', 'approved', 'rejected'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "business_content" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "business_id" uuid NOT NULL,
        "type" "public"."business_content_type_enum" NOT NULL,
        "title" character varying(200) NOT NULL,
        "body" text NOT NULL,
        "images" text array NOT NULL DEFAULT '{}',
        "external_link" character varying(500),
        "valid_from" TIMESTAMP WITH TIME ZONE,
        "valid_until" TIMESTAMP WITH TIME ZONE,
        "status" "public"."business_content_status_enum" NOT NULL DEFAULT 'draft',
        "rejection_reason" text,
        "submitted_at" TIMESTAMP WITH TIME ZONE,
        "reviewed_at" TIMESTAMP WITH TIME ZONE,
        "reviewed_by_user_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_business_content_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "business_content"
      ADD CONSTRAINT "FK_business_content_business_id"
      FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    // The owner's own content list and the public per-business feed both
    // filter/sort by this pair.
    await queryRunner.query(`
      CREATE INDEX "IDX_business_content_business_id" ON "business_content" ("business_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_business_content_business_id"`);
    await queryRunner.query(
      `ALTER TABLE "business_content" DROP CONSTRAINT "FK_business_content_business_id"`,
    );
    await queryRunner.query(`DROP TABLE "business_content"`);
    await queryRunner.query(
      `DROP TYPE "public"."business_content_status_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."business_content_type_enum"`);
  }
}
