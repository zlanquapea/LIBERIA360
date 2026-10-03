import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCreatorGuides1791700000000 implements MigrationInterface {
  name = "AddCreatorGuides1791700000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."creator_guides_status_enum" AS ENUM('draft', 'pending_review', 'published', 'rejected')`,
    );
    await queryRunner.query(`
      CREATE TABLE "creator_guides" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "creator_id" uuid NOT NULL,
        "title" character varying(150) NOT NULL,
        "slug" character varying(170) NOT NULL,
        "summary" text NOT NULL,
        "cover_image" character varying(500),
        "video_url" character varying(500),
        "stops" jsonb NOT NULL DEFAULT '[]',
        "status" "public"."creator_guides_status_enum" NOT NULL DEFAULT 'draft',
        "rejection_reason" text,
        "media_permission_confirmed_at" TIMESTAMP WITH TIME ZONE,
        "published_at" TIMESTAMP WITH TIME ZONE,
        "reviewed_by_user_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_creator_guides_slug" UNIQUE ("slug"),
        CONSTRAINT "PK_creator_guides" PRIMARY KEY ("id"),
        CONSTRAINT "FK_creator_guides_creator" FOREIGN KEY ("creator_id")
          REFERENCES "creators"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_creator_guides_creator" ON "creator_guides" ("creator_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_creator_guides_status_published" ON "creator_guides" ("status", "published_at")`,
    );
    // Finding the guides that include a given place (place pages).
    await queryRunner.query(
      `CREATE INDEX "IDX_creator_guides_stops" ON "creator_guides" USING gin ("stops" jsonb_path_ops)`,
    );
    await queryRunner.query(`
      CREATE TABLE "saved_guides" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "guide_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_saved_guides_user_guide" UNIQUE ("user_id", "guide_id"),
        CONSTRAINT "PK_saved_guides" PRIMARY KEY ("id"),
        CONSTRAINT "FK_saved_guides_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_saved_guides_guide" FOREIGN KEY ("guide_id")
          REFERENCES "creator_guides"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_saved_guides_user" ON "saved_guides" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "saved_guides"`);
    await queryRunner.query(`DROP TABLE "creator_guides"`);
    await queryRunner.query(`DROP TYPE "public"."creator_guides_status_enum"`);
  }
}
