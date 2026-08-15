import { MigrationInterface, QueryRunner } from "typeorm";

export class AddReviews1786801339127 implements MigrationInterface {
  name = "AddReviews1786801339127";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "reviews" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "place_id" uuid NOT NULL, "overall_rating" smallint NOT NULL, "experience_rating" smallint, "accessibility_rating" smallint, "cleanliness_rating" smallint, "value_rating" smallint, "safety_rating" smallint, "service_rating" smallint, "comment" text, "photos" text array NOT NULL DEFAULT '{}', "verified_visit" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_6408104117bac01e393623e6263" UNIQUE ("user_id", "place_id"), CONSTRAINT "PK_231ae565c273ee700b283f15c1d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_728447781a30bc3fcfe5c2f1cd" ON "reviews" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d2616b72cb3787ad20b88a3aa6" ON "reviews" ("place_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" ADD CONSTRAINT "FK_728447781a30bc3fcfe5c2f1cdf" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" ADD CONSTRAINT "FK_d2616b72cb3787ad20b88a3aa67" FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reviews" DROP CONSTRAINT "FK_d2616b72cb3787ad20b88a3aa67"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" DROP CONSTRAINT "FK_728447781a30bc3fcfe5c2f1cdf"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d2616b72cb3787ad20b88a3aa6"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_728447781a30bc3fcfe5c2f1cd"`,
    );
    await queryRunner.query(`DROP TABLE "reviews"`);
  }
}
