import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCreatorReviews1786950000000 implements MigrationInterface {
  name = "AddCreatorReviews1786950000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // reviews.place_id becomes nullable — a review now targets either a
    // Place or a Creator (see Review entity's doc comment), never both.
    await queryRunner.query(
      `ALTER TABLE "reviews" ALTER COLUMN "place_id" DROP NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "reviews" ADD "creator_id" uuid`);
    await queryRunner.query(`
      ALTER TABLE "reviews"
      ADD CONSTRAINT "FK_reviews_creator_id"
      FOREIGN KEY ("creator_id") REFERENCES "creators"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_reviews_creator_id" ON "reviews" ("creator_id")`,
    );
    // NULLs are distinct in Postgres unique constraints, so this only ever
    // collides on two reviews from the same user for the same creator —
    // place-targeted rows (creator_id always NULL) never collide here.
    await queryRunner.query(`
      ALTER TABLE "reviews"
      ADD CONSTRAINT "UQ_reviews_user_id_creator_id" UNIQUE ("user_id", "creator_id")
    `);

    await queryRunner.query(
      `ALTER TABLE "creators" ADD "rating" decimal(2,1) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "creators" ADD "review_count" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "creators" DROP COLUMN "review_count"`,
    );
    await queryRunner.query(`ALTER TABLE "creators" DROP COLUMN "rating"`);

    await queryRunner.query(
      `ALTER TABLE "reviews" DROP CONSTRAINT "UQ_reviews_user_id_creator_id"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_reviews_creator_id"`);
    await queryRunner.query(
      `ALTER TABLE "reviews" DROP CONSTRAINT "FK_reviews_creator_id"`,
    );
    await queryRunner.query(`ALTER TABLE "reviews" DROP COLUMN "creator_id"`);
    // Not safe to blindly restore NOT NULL — any creator-targeted review
    // rows added since `up` would have place_id NULL and violate it. Rows
    // must be migrated/removed by the operator before rolling this back
    // past that point; the common case (rolling back immediately, no new
    // creator reviews written yet) restores cleanly.
    await queryRunner.query(
      `ALTER TABLE "reviews" ALTER COLUMN "place_id" SET NOT NULL`,
    );
  }
}
