import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCreatorStories1790000000000 implements MigrationInterface {
  name = "AddCreatorStories1790000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."creator_stories_media_type_enum" AS ENUM('image', 'video')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."creator_stories_status_enum" AS ENUM('pending', 'approved', 'rejected', 'expired', 'deleted')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."creator_stories_visibility_enum" AS ENUM('public', 'followers')`,
    );
    await queryRunner.query(
      `CREATE TABLE "creator_stories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "creator_id" uuid NOT NULL, "media_type" "public"."creator_stories_media_type_enum" NOT NULL, "media_url" character varying(500) NOT NULL, "caption" text, "status" "public"."creator_stories_status_enum" NOT NULL DEFAULT 'approved', "visibility" "public"."creator_stories_visibility_enum" NOT NULL DEFAULT 'public', "place_id" uuid, "event_id" uuid, "trip_id" uuid, "creator_profile_id" uuid, "view_count" integer NOT NULL DEFAULT 0, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "published_at" TIMESTAMP WITH TIME ZONE, "expires_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_creator_stories_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_creator_stories_creator_status_expires" ON "creator_stories" ("creator_id", "status", "expires_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_creator_stories_status_published" ON "creator_stories" ("status", "published_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_creator_stories_expires" ON "creator_stories" ("expires_at")`,
    );
    await queryRunner.query(
      `ALTER TABLE "creator_stories" ADD CONSTRAINT "FK_creator_stories_creator" FOREIGN KEY ("creator_id") REFERENCES "creators"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE TABLE "creator_story_views" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "story_id" uuid NOT NULL, "viewer_user_id" uuid NOT NULL, "viewed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_creator_story_views_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_creator_story_views_unique" ON "creator_story_views" ("story_id", "viewer_user_id")`,
    );
    await queryRunner.query(
      `CREATE TABLE "creator_story_reports" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "story_id" uuid NOT NULL, "reporter_user_id" uuid NOT NULL, "reason" character varying(500) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_creator_story_reports_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_creator_story_reports_unique" ON "creator_story_reports" ("story_id", "reporter_user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "creator_story_reports"`);
    await queryRunner.query(`DROP TABLE "creator_story_views"`);
    await queryRunner.query(
      `ALTER TABLE "creator_stories" DROP CONSTRAINT "FK_creator_stories_creator"`,
    );
    await queryRunner.query(`DROP TABLE "creator_stories"`);
    await queryRunner.query(
      `DROP TYPE "public"."creator_stories_visibility_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."creator_stories_status_enum"`);
    await queryRunner.query(
      `DROP TYPE "public"."creator_stories_media_type_enum"`,
    );
  }
}
