import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEvents1786801895222 implements MigrationInterface {
  name = "AddEvents1786801895222";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."events_category_enum" AS ENUM('concert', 'festival', 'sports', 'nightlife', 'seasonal', 'other')`,
    );
    await queryRunner.query(
      `CREATE TABLE "events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(200) NOT NULL, "category" "public"."events_category_enum" NOT NULL, "place_id" uuid, "location_text" character varying(255), "county_id" uuid NOT NULL, "start_date" TIMESTAMP WITH TIME ZONE NOT NULL, "end_date" TIMESTAMP WITH TIME ZONE, "description" text, "images" text array NOT NULL DEFAULT '{}', "ticket_info" text, "created_by_user_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_40731c7151fe4be3116e45ddf73" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a41dfb103a05928a3b7586548a" ON "events" ("county_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ce5225c17497c5adddc1819c69" ON "events" ("start_date") `,
    );
    await queryRunner.query(
      `ALTER TABLE "events" ADD CONSTRAINT "FK_047655297d772b6bfd08af7044f" FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" ADD CONSTRAINT "FK_a41dfb103a05928a3b7586548a6" FOREIGN KEY ("county_id") REFERENCES "counties"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" ADD CONSTRAINT "FK_4de454469562c4a5ecefcfc2019" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" DROP CONSTRAINT "FK_4de454469562c4a5ecefcfc2019"`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" DROP CONSTRAINT "FK_a41dfb103a05928a3b7586548a6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" DROP CONSTRAINT "FK_047655297d772b6bfd08af7044f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ce5225c17497c5adddc1819c69"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a41dfb103a05928a3b7586548a"`,
    );
    await queryRunner.query(`DROP TABLE "events"`);
    await queryRunner.query(`DROP TYPE "public"."events_category_enum"`);
  }
}
