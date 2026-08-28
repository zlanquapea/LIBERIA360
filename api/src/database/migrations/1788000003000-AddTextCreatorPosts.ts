import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTextCreatorPosts1788000003000 implements MigrationInterface {
  name = "AddTextCreatorPosts1788000003000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."creator_posts_media_type_enum" ADD VALUE IF NOT EXISTS 'text'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const rows = await queryRunner.query(
      `SELECT COUNT(*)::int AS count FROM "creator_posts" WHERE "media_type" = 'text'`,
    );
    if (Number(rows[0]?.count ?? 0) > 0) {
      throw new Error(
        "Cannot remove the text creator-post type while text posts still exist.",
      );
    }

    await queryRunner.query(
      `ALTER TYPE "public"."creator_posts_media_type_enum" RENAME TO "creator_posts_media_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."creator_posts_media_type_enum" AS ENUM('image', 'video')`,
    );
    await queryRunner.query(
      `ALTER TABLE "creator_posts" ALTER COLUMN "media_type" TYPE "public"."creator_posts_media_type_enum" USING "media_type"::text::"public"."creator_posts_media_type_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."creator_posts_media_type_enum_old"`,
    );
  }
}
