import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCreatorCommentInteractions1788000004000 implements MigrationInterface {
  name = "AddCreatorCommentInteractions1788000004000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "creator_post_comments" ADD "parent_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "creator_post_comments" ADD "like_count" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_creator_post_comments_parent_id" ON "creator_post_comments" ("parent_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "creator_post_comments" ADD CONSTRAINT "FK_creator_post_comments_parent_id" FOREIGN KEY ("parent_id") REFERENCES "creator_post_comments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE TABLE "creator_post_comment_likes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "comment_id" uuid NOT NULL, "user_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_creator_post_comment_likes" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_creator_post_comment_likes_comment_id" ON "creator_post_comment_likes" ("comment_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_creator_post_comment_likes_user_id" ON "creator_post_comment_likes" ("user_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "creator_post_comment_likes" ADD CONSTRAINT "UQ_creator_post_comment_likes_comment_user" UNIQUE ("comment_id", "user_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "creator_post_comment_likes" ADD CONSTRAINT "FK_creator_post_comment_likes_comment_id" FOREIGN KEY ("comment_id") REFERENCES "creator_post_comments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "creator_post_comment_likes" ADD CONSTRAINT "FK_creator_post_comment_likes_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "creator_post_comment_likes" DROP CONSTRAINT "FK_creator_post_comment_likes_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "creator_post_comment_likes" DROP CONSTRAINT "FK_creator_post_comment_likes_comment_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "creator_post_comment_likes" DROP CONSTRAINT "UQ_creator_post_comment_likes_comment_user"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_creator_post_comment_likes_user_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_creator_post_comment_likes_comment_id"`,
    );
    await queryRunner.query(`DROP TABLE "creator_post_comment_likes"`);
    await queryRunner.query(
      `ALTER TABLE "creator_post_comments" DROP CONSTRAINT "FK_creator_post_comments_parent_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_creator_post_comments_parent_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "creator_post_comments" DROP COLUMN "like_count"`,
    );
    await queryRunner.query(
      `ALTER TABLE "creator_post_comments" DROP COLUMN "parent_id"`,
    );
  }
}
