import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTravelerInfoExplorerFeaturedTrips1791200000000 implements MigrationInterface {
  name = "AddTravelerInfoExplorerFeaturedTrips1791200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // A. Practical traveler tools — singleton settings row, same shape as
    // application_settings.
    await queryRunner.query(`
      CREATE TABLE "traveler_info_settings" (
        "id" integer NOT NULL,
        "usd_to_lrd_rate" numeric(10,4),
        "visa_info" text,
        "entry_requirements" text,
        "current_season_note" text,
        "updated_by_user_id" uuid,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_traveler_info_settings_id" PRIMARY KEY ("id")
      )
    `);

    // B. "Explorer" gamification.
    await queryRunner.query(
      `ALTER TABLE "users" ADD "explorer_profile_public" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(`
      CREATE TABLE "visited_places" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "place_id" uuid NOT NULL,
        "visited_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_visited_places_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_visited_places_user_place" UNIQUE ("user_id", "place_id")
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "visited_places" ADD CONSTRAINT "FK_visited_places_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "visited_places" ADD CONSTRAINT "FK_visited_places_place" FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_visited_places_user" ON "visited_places" ("user_id")`,
    );

    // C. Curated starter itineraries ("Trip Ideas").
    await queryRunner.query(`
      ALTER TABLE "itineraries"
      ADD "is_featured_template" boolean NOT NULL DEFAULT false,
      ADD "featured_category" character varying(60),
      ADD "featured_order" smallint
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "itineraries"
      DROP COLUMN "featured_order",
      DROP COLUMN "featured_category",
      DROP COLUMN "is_featured_template"
    `);

    await queryRunner.query(`DROP INDEX "public"."IDX_visited_places_user"`);
    await queryRunner.query(
      `ALTER TABLE "visited_places" DROP CONSTRAINT "FK_visited_places_place"`,
    );
    await queryRunner.query(
      `ALTER TABLE "visited_places" DROP CONSTRAINT "FK_visited_places_user"`,
    );
    await queryRunner.query(`DROP TABLE "visited_places"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "explorer_profile_public"`,
    );

    await queryRunner.query(`DROP TABLE "traveler_info_settings"`);
  }
}
