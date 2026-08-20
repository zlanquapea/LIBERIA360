import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCreatorProfileExpansion1786920000000 implements MigrationInterface {
  name = "AddCreatorProfileExpansion1786920000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // New enums
    await queryRunner.query(
      `CREATE TYPE "public"."creators_category_enum" AS ENUM('photographer', 'videographer', 'tour_guide', 'tour_operator', 'artist', 'chef', 'cultural', 'other')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."creators_verification_status_enum" AS ENUM('unverified', 'verified')`,
    );

    // New columns on creators
    await queryRunner.query(
      `ALTER TABLE "creators" ADD "cover_image" character varying(500)`,
    );
    await queryRunner.query(
      `ALTER TABLE "creators" ADD "category" "public"."creators_category_enum" NOT NULL DEFAULT 'other'`,
    );
    await queryRunner.query(`ALTER TABLE "creators" ADD "county_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "creators" ADD CONSTRAINT "FK_creators_county_id" FOREIGN KEY ("county_id") REFERENCES "counties"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "creators" ADD "contact_email" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "creators" ADD "contact_phone" character varying(40)`,
    );
    await queryRunner.query(
      `ALTER TABLE "creators" ADD "whatsapp" character varying(40)`,
    );
    await queryRunner.query(
      `ALTER TABLE "creators" ADD "website" character varying(300)`,
    );
    await queryRunner.query(
      `ALTER TABLE "creators" ADD "languages" text array NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "creators" ADD "years_experience" smallint`,
    );
    await queryRunner.query(
      `ALTER TABLE "creators" ADD "certifications" text array NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "creators" ADD "availability_note" text`,
    );

    // Replace the dead `verified` boolean with a real admin-set trust
    // badge, same shape as places/businesses (verification_status +
    // verified_by_user_id + verified_at, see AddVerificationAuditTrail) —
    // migrate any existing true values across before dropping the column.
    await queryRunner.query(
      `ALTER TABLE "creators" ADD "verification_status" "public"."creators_verification_status_enum" NOT NULL DEFAULT 'unverified'`,
    );
    await queryRunner.query(
      `UPDATE "creators" SET "verification_status" = 'verified' WHERE "verified" = true`,
    );
    await queryRunner.query(
      `ALTER TABLE "creators" ADD "verified_by_user_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "creators" ADD "verified_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(`ALTER TABLE "creators" DROP COLUMN "verified"`);

    // creator_portfolio_items
    await queryRunner.query(
      `CREATE TYPE "public"."creator_portfolio_items_type_enum" AS ENUM('image', 'video')`,
    );
    await queryRunner.query(
      `CREATE TABLE "creator_portfolio_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "creator_id" uuid NOT NULL, "type" "public"."creator_portfolio_items_type_enum" NOT NULL, "url" character varying(500) NOT NULL, "caption" character varying(200), "category" character varying(60), "sort_order" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_creator_portfolio_items" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_creator_portfolio_items_creator_id" ON "creator_portfolio_items" ("creator_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "creator_portfolio_items" ADD CONSTRAINT "FK_creator_portfolio_items_creator_id" FOREIGN KEY ("creator_id") REFERENCES "creators"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // creator_offerings
    await queryRunner.query(
      `CREATE TABLE "creator_offerings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "creator_id" uuid NOT NULL, "title" character varying(150) NOT NULL, "description" text, "price_from" numeric(10,2), "duration_label" character varying(100), "location" character varying(150), "sort_order" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_creator_offerings" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_creator_offerings_creator_id" ON "creator_offerings" ("creator_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "creator_offerings" ADD CONSTRAINT "FK_creator_offerings_creator_id" FOREIGN KEY ("creator_id") REFERENCES "creators"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "creator_offerings" DROP CONSTRAINT "FK_creator_offerings_creator_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_creator_offerings_creator_id"`,
    );
    await queryRunner.query(`DROP TABLE "creator_offerings"`);

    await queryRunner.query(
      `ALTER TABLE "creator_portfolio_items" DROP CONSTRAINT "FK_creator_portfolio_items_creator_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_creator_portfolio_items_creator_id"`,
    );
    await queryRunner.query(`DROP TABLE "creator_portfolio_items"`);
    await queryRunner.query(
      `DROP TYPE "public"."creator_portfolio_items_type_enum"`,
    );

    await queryRunner.query(
      `ALTER TABLE "creators" ADD "verified" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `UPDATE "creators" SET "verified" = true WHERE "verification_status" = 'verified'`,
    );
    await queryRunner.query(`ALTER TABLE "creators" DROP COLUMN "verified_at"`);
    await queryRunner.query(
      `ALTER TABLE "creators" DROP COLUMN "verified_by_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "creators" DROP COLUMN "verification_status"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."creators_verification_status_enum"`,
    );

    await queryRunner.query(
      `ALTER TABLE "creators" DROP COLUMN "availability_note"`,
    );
    await queryRunner.query(
      `ALTER TABLE "creators" DROP COLUMN "certifications"`,
    );
    await queryRunner.query(
      `ALTER TABLE "creators" DROP COLUMN "years_experience"`,
    );
    await queryRunner.query(`ALTER TABLE "creators" DROP COLUMN "languages"`);
    await queryRunner.query(`ALTER TABLE "creators" DROP COLUMN "website"`);
    await queryRunner.query(`ALTER TABLE "creators" DROP COLUMN "whatsapp"`);
    await queryRunner.query(
      `ALTER TABLE "creators" DROP COLUMN "contact_phone"`,
    );
    await queryRunner.query(
      `ALTER TABLE "creators" DROP COLUMN "contact_email"`,
    );
    await queryRunner.query(
      `ALTER TABLE "creators" DROP CONSTRAINT "FK_creators_county_id"`,
    );
    await queryRunner.query(`ALTER TABLE "creators" DROP COLUMN "county_id"`);
    await queryRunner.query(`ALTER TABLE "creators" DROP COLUMN "category"`);
    await queryRunner.query(`DROP TYPE "public"."creators_category_enum"`);
    await queryRunner.query(`ALTER TABLE "creators" DROP COLUMN "cover_image"`);
  }
}
