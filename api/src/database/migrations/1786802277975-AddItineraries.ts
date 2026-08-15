import { MigrationInterface, QueryRunner } from "typeorm";

export class AddItineraries1786802277975 implements MigrationInterface {
  name = "AddItineraries1786802277975";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."itineraries_kind_enum" AS ENUM('trip', 'weekend')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."itineraries_budget_band_enum" AS ENUM('budget', 'moderate', 'premium')`,
    );
    await queryRunner.query(
      `CREATE TABLE "itineraries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "title" character varying(200) NOT NULL, "kind" "public"."itineraries_kind_enum" NOT NULL DEFAULT 'trip', "duration_days" smallint NOT NULL, "budget_band" "public"."itineraries_budget_band_enum" NOT NULL, "interests" text array NOT NULL DEFAULT '{}', "stops" jsonb NOT NULL DEFAULT '[]', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9c5db87d0f85f56e4466ae09a38" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2c1f9990ff4b57b054ed85a45e" ON "itineraries" ("user_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "itineraries" ADD CONSTRAINT "FK_2c1f9990ff4b57b054ed85a45e6" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "itineraries" DROP CONSTRAINT "FK_2c1f9990ff4b57b054ed85a45e6"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2c1f9990ff4b57b054ed85a45e"`,
    );
    await queryRunner.query(`DROP TABLE "itineraries"`);
    await queryRunner.query(
      `DROP TYPE "public"."itineraries_budget_band_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."itineraries_kind_enum"`);
  }
}
