import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSponsoredPlacements1786822178272 implements MigrationInterface {
  name = "AddSponsoredPlacements1786822178272";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "sponsored_placements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "place_id" uuid NOT NULL, "start_date" date NOT NULL, "end_date" date NOT NULL, "created_by_user_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_055300d8c32056a7d95e1671dad" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_32219afc2c608f5960cb14eb93" ON "sponsored_placements" ("place_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "sponsored_placements" ADD CONSTRAINT "FK_32219afc2c608f5960cb14eb931" FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sponsored_placements" ADD CONSTRAINT "FK_8c41cb98a910b966399ba20ce03" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sponsored_placements" DROP CONSTRAINT "FK_8c41cb98a910b966399ba20ce03"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sponsored_placements" DROP CONSTRAINT "FK_32219afc2c608f5960cb14eb931"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_32219afc2c608f5960cb14eb93"`,
    );
    await queryRunner.query(`DROP TABLE "sponsored_placements"`);
  }
}
