import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1786792759612 implements MigrationInterface {
  name = "InitSchema1786792759612";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(
      `CREATE TABLE "categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "slug" character varying(100) NOT NULL, "description" text, "icon" character varying(50), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_420d9f679d41281f282f5bc7d09" UNIQUE ("slug"), CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "counties" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "slug" character varying(100) NOT NULL, "rollout_stage" smallint NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_095b4c3e6d92dde46c0b969b153" UNIQUE ("slug"), CONSTRAINT "PK_e9d269991e45de4af9e7889d9ea" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."activities_difficulty_enum" AS ENUM('easy', 'moderate', 'challenging')`,
    );
    await queryRunner.query(
      `CREATE TABLE "activities" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "place_id" uuid NOT NULL, "name" character varying(200) NOT NULL, "description" text, "duration" character varying(100), "price" numeric(10,2), "difficulty" "public"."activities_difficulty_enum", "age_range" character varying(50), "guide_required" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7f4004429f731ffb9c88eb486a8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b98eccb7d9b9e051de2b3b8f94" ON "activities" ("place_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."places_type_enum" AS ENUM('attraction', 'nature_site', 'hotel', 'restaurant', 'activity_provider')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."places_recommended_visit_length_enum" AS ENUM('day_trip', 'overnight', 'multi_day')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."places_verification_status_enum" AS ENUM('unverified', 'verified', 'recommended', 'official', 'eco_certified', 'community_favorite')`,
    );
    await queryRunner.query(
      `CREATE TABLE "places" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(200) NOT NULL, "slug" character varying(220) NOT NULL, "description" text NOT NULL, "type" "public"."places_type_enum" NOT NULL, "category_id" uuid NOT NULL, "tags" text array NOT NULL DEFAULT '{}', "county_id" uuid NOT NULL, "city" character varying(150) NOT NULL, "latitude" numeric(9,6) NOT NULL, "longitude" numeric(9,6) NOT NULL, "distance_from_monrovia_km" numeric(6,1), "recommended_visit_length" "public"."places_recommended_visit_length_enum", "estimated_cost_entry" numeric(10,2), "estimated_cost_guide" numeric(10,2), "estimated_cost_transport" numeric(10,2), "images" text array NOT NULL DEFAULT '{}', "videos" text array NOT NULL DEFAULT '{}', "opening_hours" text, "contact_phone" character varying(40), "whatsapp" character varying(40), "website" character varying(255), "instagram" character varying(100), "facebook" character varying(100), "rating" numeric(2,1) NOT NULL DEFAULT '0', "review_count" integer NOT NULL DEFAULT '0', "verification_status" "public"."places_verification_status_enum" NOT NULL DEFAULT 'unverified', "featured" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_484c715223286a735f982a68e0d" UNIQUE ("slug"), CONSTRAINT "PK_1afab86e226b4c3bc9a74465c12" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_098697c7be32519a2621a16af1" ON "places" ("category_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b57fda6a971fc9e58b2b2b2a80" ON "places" ("county_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "activities" ADD CONSTRAINT "FK_b98eccb7d9b9e051de2b3b8f94f" FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "places" ADD CONSTRAINT "FK_098697c7be32519a2621a16af17" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "places" ADD CONSTRAINT "FK_b57fda6a971fc9e58b2b2b2a80d" FOREIGN KEY ("county_id") REFERENCES "counties"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "places" DROP CONSTRAINT "FK_b57fda6a971fc9e58b2b2b2a80d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "places" DROP CONSTRAINT "FK_098697c7be32519a2621a16af17"`,
    );
    await queryRunner.query(
      `ALTER TABLE "activities" DROP CONSTRAINT "FK_b98eccb7d9b9e051de2b3b8f94f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b57fda6a971fc9e58b2b2b2a80"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_098697c7be32519a2621a16af1"`,
    );
    await queryRunner.query(`DROP TABLE "places"`);
    await queryRunner.query(
      `DROP TYPE "public"."places_verification_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."places_recommended_visit_length_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."places_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b98eccb7d9b9e051de2b3b8f94"`,
    );
    await queryRunner.query(`DROP TABLE "activities"`);
    await queryRunner.query(`DROP TYPE "public"."activities_difficulty_enum"`);
    await queryRunner.query(`DROP TABLE "counties"`);
    await queryRunner.query(`DROP TABLE "categories"`);
    await queryRunner.query(`DROP EXTENSION IF EXISTS "uuid-ossp"`);
  }
}
