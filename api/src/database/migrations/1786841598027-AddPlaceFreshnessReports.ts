import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPlaceFreshnessReports1786841598027 implements MigrationInterface {
  name = "AddPlaceFreshnessReports1786841598027";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."place_freshness_reports_response_enum" AS ENUM('still_here', 'no_longer_here')`,
    );
    await queryRunner.query(
      `CREATE TABLE "place_freshness_reports" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "place_id" uuid NOT NULL, "user_id" uuid NOT NULL, "response" "public"."place_freshness_reports_response_enum" NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_6996759148736b5da2a02132340" UNIQUE ("user_id", "place_id"), CONSTRAINT "PK_ace49d790ffeede5dff07643ecd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6d275bd553b051a78006040d03" ON "place_freshness_reports" ("place_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1372456806af0586a5d81c4326" ON "place_freshness_reports" ("user_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "place_freshness_reports" ADD CONSTRAINT "FK_6d275bd553b051a78006040d03a" FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "place_freshness_reports" ADD CONSTRAINT "FK_1372456806af0586a5d81c43262" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "place_freshness_reports" DROP CONSTRAINT "FK_1372456806af0586a5d81c43262"`,
    );
    await queryRunner.query(
      `ALTER TABLE "place_freshness_reports" DROP CONSTRAINT "FK_6d275bd553b051a78006040d03a"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1372456806af0586a5d81c4326"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6d275bd553b051a78006040d03"`,
    );
    await queryRunner.query(`DROP TABLE "place_freshness_reports"`);
    await queryRunner.query(
      `DROP TYPE "public"."place_freshness_reports_response_enum"`,
    );
  }
}
