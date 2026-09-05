import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSavedPlaces1790000005000 implements MigrationInterface {
  name = "AddSavedPlaces1790000005000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "saved_places" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "place_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_saved_places_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_saved_places_user_place" UNIQUE ("user_id", "place_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_saved_places_user_id" ON "saved_places" ("user_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "saved_places" ADD CONSTRAINT "FK_saved_places_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "saved_places" ADD CONSTRAINT "FK_saved_places_place" FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "saved_places" DROP CONSTRAINT "FK_saved_places_place"`,
    );
    await queryRunner.query(
      `ALTER TABLE "saved_places" DROP CONSTRAINT "FK_saved_places_user"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_saved_places_user_id"`);
    await queryRunner.query(`DROP TABLE "saved_places"`);
  }
}
