import { MigrationInterface, QueryRunner } from "typeorm";

// Stories previously only had views + reports — no way to react or
// comment. Mirrors creator_post_likes/creator_post_comments' shape
// (see AddCreatorFeed/AddCreatorCommentInteractions) but simpler: a
// single reaction row per (story, user) carrying which emoji instead of
// a separate table per reaction type, and a flat comment list with no
// threading or per-comment likes — a 24h-lived story doesn't earn that
// machinery. `reaction_count`/`comment_count` on creator_stories are
// denormalized counters, same pattern as the existing `view_count`.
export class AddCreatorStoryInteractions1790800000000 implements MigrationInterface {
  name = "AddCreatorStoryInteractions1790800000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "creator_stories"
      ADD COLUMN "reaction_count" integer NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "creator_stories"
      ADD COLUMN "comment_count" integer NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      CREATE TABLE "creator_story_reactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "story_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "emoji" varchar(8) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_creator_story_reactions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "creator_story_reactions"
      ADD CONSTRAINT "UQ_creator_story_reactions_story_user" UNIQUE ("story_id", "user_id")
    `);
    await queryRunner.query(`
      ALTER TABLE "creator_story_reactions"
      ADD CONSTRAINT "FK_creator_story_reactions_story" FOREIGN KEY ("story_id")
      REFERENCES "creator_stories"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "creator_story_reactions"
      ADD CONSTRAINT "FK_creator_story_reactions_user" FOREIGN KEY ("user_id")
      REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      CREATE TABLE "creator_story_comments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "story_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "body" text NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_creator_story_comments" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_creator_story_comments_story_created" ON "creator_story_comments" ("story_id", "created_at")
    `);
    await queryRunner.query(`
      ALTER TABLE "creator_story_comments"
      ADD CONSTRAINT "FK_creator_story_comments_story" FOREIGN KEY ("story_id")
      REFERENCES "creator_stories"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "creator_story_comments"
      ADD CONSTRAINT "FK_creator_story_comments_user" FOREIGN KEY ("user_id")
      REFERENCES "users"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "creator_story_comments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "creator_story_reactions"`);
    await queryRunner.query(`
      ALTER TABLE "creator_stories" DROP COLUMN IF EXISTS "comment_count"
    `);
    await queryRunner.query(`
      ALTER TABLE "creator_stories" DROP COLUMN IF EXISTS "reaction_count"
    `);
  }
}
