import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFaqs1790000001000 implements MigrationInterface {
  name = "AddFaqs1790000001000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "faqs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "question" character varying(300) NOT NULL, "answer" text NOT NULL, "category" character varying(120), "sort_order" integer NOT NULL DEFAULT 0, "published" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_faqs" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_faqs_published_sort" ON "faqs" ("published", "sort_order")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_faqs_published_sort"`);
    await queryRunner.query(`DROP TABLE "faqs"`);
  }
}
