import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEventReviewStatus1787800959107 implements MigrationInterface {
  name = "AddEventReviewStatus1787800959107";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Same review-gate columns as Place/Advertisement, added after
    // self-service events shipped with no moderation step at all (see
    // Event entity's doc comment). The column default of 'pending' applies
    // to already-existing rows too — deliberately not backfilled to
    // 'approved', so events already live today drop out of the public
    // listing until an admin reviews them.
    await queryRunner.query(
      `CREATE TYPE "public"."events_review_status_enum" AS ENUM('pending', 'approved', 'rejected')`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" ADD "review_status" "public"."events_review_status_enum" NOT NULL DEFAULT 'pending'`,
    );
    await queryRunner.query(`ALTER TABLE "events" ADD "rejection_reason" text`);
    await queryRunner.query(
      `ALTER TABLE "events" ADD "reviewed_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(`ALTER TABLE "events" ADD "reviewed_by_user_id" uuid`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "reviewed_by_user_id"`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "reviewed_at"`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "rejection_reason"`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "review_status"`);
    await queryRunner.query(`DROP TYPE "public"."events_review_status_enum"`);
  }
}
