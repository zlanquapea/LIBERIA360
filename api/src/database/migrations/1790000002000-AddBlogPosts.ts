import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBlogPosts1790000002000 implements MigrationInterface {
  name = "AddBlogPosts1790000002000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."blog_posts_status_enum" AS ENUM('draft','published')`,
    );
    await queryRunner.query(
      `CREATE TABLE "blog_posts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(200) NOT NULL, "slug" character varying(220) NOT NULL, "cover_image" character varying(500), "content" text NOT NULL, "author_user_id" uuid NOT NULL, "status" "public"."blog_posts_status_enum" NOT NULL DEFAULT 'draft', "published_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_blog_posts_slug" UNIQUE ("slug"), CONSTRAINT "PK_blog_posts" PRIMARY KEY ("id"), CONSTRAINT "FK_blog_posts_author" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE NO ACTION)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "blog_posts"`);
    await queryRunner.query(`DROP TYPE "public"."blog_posts_status_enum"`);
  }
}
