import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBusinesses1786801547280 implements MigrationInterface {
  name = "AddBusinesses1786801547280";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."businesses_type_enum" AS ENUM('hotel', 'restaurant', 'tour_operator', 'transport')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."businesses_verification_status_enum" AS ENUM('unverified', 'verified', 'recommended', 'official', 'eco_certified', 'community_favorite')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."businesses_subscription_tier_enum" AS ENUM('free', 'premium')`,
    );
    await queryRunner.query(
      `CREATE TABLE "businesses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(200) NOT NULL, "type" "public"."businesses_type_enum" NOT NULL, "owner_user_id" uuid, "linked_place_id" uuid NOT NULL, "phone" character varying(40), "whatsapp" character varying(40), "email" character varying(255), "website" character varying(255), "social_links" text array NOT NULL DEFAULT '{}', "description" text, "images" text array NOT NULL DEFAULT '{}', "verification_status" "public"."businesses_verification_status_enum" NOT NULL DEFAULT 'unverified', "subscription_tier" "public"."businesses_subscription_tier_enum" NOT NULL DEFAULT 'free', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_bc1bf63498dd2368ce3dc8686e8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "businesses" ADD CONSTRAINT "FK_19fedc48aa416c30f3fa1cfb11e" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "businesses" ADD CONSTRAINT "FK_242fc7b21ff421831d8a2a5550b" FOREIGN KEY ("linked_place_id") REFERENCES "places"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "businesses" DROP CONSTRAINT "FK_242fc7b21ff421831d8a2a5550b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "businesses" DROP CONSTRAINT "FK_19fedc48aa416c30f3fa1cfb11e"`,
    );
    await queryRunner.query(`DROP TABLE "businesses"`);
    await queryRunner.query(
      `DROP TYPE "public"."businesses_subscription_tier_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."businesses_verification_status_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."businesses_type_enum"`);
  }
}
