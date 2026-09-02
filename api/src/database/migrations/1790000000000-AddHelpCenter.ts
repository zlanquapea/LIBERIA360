import { MigrationInterface, QueryRunner } from "typeorm";

export class AddHelpCenter1790000000000 implements MigrationInterface {
  name = "AddHelpCenter1790000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "knowledge_categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(120) NOT NULL, "slug" character varying(140) NOT NULL, "description" text, "sort_order" integer NOT NULL DEFAULT 0, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_knowledge_categories_slug" UNIQUE ("slug"), CONSTRAINT "PK_knowledge_categories" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."knowledge_articles_status_enum" AS ENUM('draft','published')`,
    );
    await queryRunner.query(
      `CREATE TABLE "knowledge_articles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "category_id" uuid NOT NULL, "title" character varying(200) NOT NULL, "slug" character varying(220) NOT NULL, "content" text NOT NULL, "author_user_id" uuid NOT NULL, "status" "public"."knowledge_articles_status_enum" NOT NULL DEFAULT 'draft', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_knowledge_articles_slug" UNIQUE ("slug"), CONSTRAINT "PK_knowledge_articles" PRIMARY KEY ("id"), CONSTRAINT "FK_knowledge_articles_category" FOREIGN KEY ("category_id") REFERENCES "knowledge_categories"("id") ON DELETE NO ACTION, CONSTRAINT "FK_knowledge_articles_author" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE NO ACTION)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_articles_category_status" ON "knowledge_articles" ("category_id", "status")`,
    );
    await queryRunner.query(
      `CREATE TABLE "article_feedback" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "article_id" uuid NOT NULL, "helpful" boolean NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_article_feedback" PRIMARY KEY ("id"), CONSTRAINT "FK_article_feedback_article" FOREIGN KEY ("article_id") REFERENCES "knowledge_articles"("id") ON DELETE CASCADE)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_article_feedback_article_created" ON "article_feedback" ("article_id", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_article_feedback_article_created"`,
    );
    await queryRunner.query(`DROP TABLE "article_feedback"`);
    await queryRunner.query(
      `DROP INDEX "IDX_knowledge_articles_category_status"`,
    );
    await queryRunner.query(`DROP TABLE "knowledge_articles"`);
    await queryRunner.query(
      `DROP TYPE "public"."knowledge_articles_status_enum"`,
    );
    await queryRunner.query(`DROP TABLE "knowledge_categories"`);
  }
}
