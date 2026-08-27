import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCreatorFeed1788000000000 implements MigrationInterface {
  name = "AddCreatorFeed1788000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."creator_posts_media_type_enum" AS ENUM('image', 'video')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."creator_posts_status_enum" AS ENUM('published', 'hidden')`,
    );
    await queryRunner.query(
      `CREATE TABLE "creator_posts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "creator_id" uuid NOT NULL, "media_type" "public"."creator_posts_media_type_enum" NOT NULL, "media_url" character varying(500) NOT NULL, "caption" text, "status" "public"."creator_posts_status_enum" NOT NULL DEFAULT 'published', "like_count" integer NOT NULL DEFAULT '0', "comment_count" integer NOT NULL DEFAULT '0', "save_count" integer NOT NULL DEFAULT '0', "share_count" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_creator_posts" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_creator_posts_creator_id" ON "creator_posts" ("creator_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_creator_posts_status" ON "creator_posts" ("status")`,
    );
    await queryRunner.query(
      `ALTER TABLE "creator_posts" ADD CONSTRAINT "FK_creator_posts_creator_id" FOREIGN KEY ("creator_id") REFERENCES "creators"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "creator_post_likes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "post_id" uuid NOT NULL, "user_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_creator_post_likes" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_creator_post_likes_post_id" ON "creator_post_likes" ("post_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_creator_post_likes_user_id" ON "creator_post_likes" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_creator_post_likes_post_user" ON "creator_post_likes" ("post_id", "user_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "creator_post_likes" ADD CONSTRAINT "FK_creator_post_likes_post_id" FOREIGN KEY ("post_id") REFERENCES "creator_posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "creator_post_likes" ADD CONSTRAINT "FK_creator_post_likes_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "creator_post_saves" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "post_id" uuid NOT NULL, "user_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_creator_post_saves" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_creator_post_saves_post_id" ON "creator_post_saves" ("post_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_creator_post_saves_user_id" ON "creator_post_saves" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_creator_post_saves_post_user" ON "creator_post_saves" ("post_id", "user_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "creator_post_saves" ADD CONSTRAINT "FK_creator_post_saves_post_id" FOREIGN KEY ("post_id") REFERENCES "creator_posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "creator_post_saves" ADD CONSTRAINT "FK_creator_post_saves_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "creator_post_comments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "post_id" uuid NOT NULL, "user_id" uuid NOT NULL, "body" text NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_creator_post_comments" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_creator_post_comments_post_id" ON "creator_post_comments" ("post_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_creator_post_comments_user_id" ON "creator_post_comments" ("user_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "creator_post_comments" ADD CONSTRAINT "FK_creator_post_comments_post_id" FOREIGN KEY ("post_id") REFERENCES "creator_posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "creator_post_comments" ADD CONSTRAINT "FK_creator_post_comments_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // Preserve current creator portfolio content as the first feed posts. This
    // does not invent captions or engagement; it simply makes existing public
    // media discoverable in the new feed after the migration.
    await queryRunner.query(
      `INSERT INTO "creator_posts" ("creator_id", "media_type", "media_url", "caption", "status", "created_at", "updated_at") SELECT "creator_id", ("type"::text)::"public"."creator_posts_media_type_enum", "url", "caption", 'published', "created_at", "created_at" FROM "creator_portfolio_items"`,
    );
    await queryRunner.query(
      `UPDATE "creator_posts" SET "like_count" = 0, "comment_count" = 0, "save_count" = 0, "share_count" = 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "creator_post_comments" DROP CONSTRAINT "FK_creator_post_comments_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "creator_post_comments" DROP CONSTRAINT "FK_creator_post_comments_post_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_creator_post_comments_user_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_creator_post_comments_post_id"`,
    );
    await queryRunner.query(`DROP TABLE "creator_post_comments"`);

    await queryRunner.query(
      `ALTER TABLE "creator_post_saves" DROP CONSTRAINT "FK_creator_post_saves_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "creator_post_saves" DROP CONSTRAINT "FK_creator_post_saves_post_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_creator_post_saves_post_user"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_creator_post_saves_user_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_creator_post_saves_post_id"`,
    );
    await queryRunner.query(`DROP TABLE "creator_post_saves"`);

    await queryRunner.query(
      `ALTER TABLE "creator_post_likes" DROP CONSTRAINT "FK_creator_post_likes_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "creator_post_likes" DROP CONSTRAINT "FK_creator_post_likes_post_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_creator_post_likes_post_user"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_creator_post_likes_user_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_creator_post_likes_post_id"`,
    );
    await queryRunner.query(`DROP TABLE "creator_post_likes"`);

    await queryRunner.query(
      `ALTER TABLE "creator_posts" DROP CONSTRAINT "FK_creator_posts_creator_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_creator_posts_status"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_creator_posts_creator_id"`,
    );
    await queryRunner.query(`DROP TABLE "creator_posts"`);
    await queryRunner.query(`DROP TYPE "public"."creator_posts_status_enum"`);
    await queryRunner.query(
      `DROP TYPE "public"."creator_posts_media_type_enum"`,
    );
  }
}
