import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCreators1786801724447 implements MigrationInterface {
  name = "AddCreators1786801724447";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "creators" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "name" character varying(150) NOT NULL, "username" character varying(50) NOT NULL, "bio" text, "profile_image" character varying(500), "instagram" character varying(100), "tiktok" character varying(100), "youtube" character varying(100), "follower_count" integer NOT NULL DEFAULT '0', "specialties" text array NOT NULL DEFAULT '{}', "locations_covered" text array NOT NULL DEFAULT '{}', "content_links" text array NOT NULL DEFAULT '{}', "verified" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_864c435572b9eccb3e6d9e3fb0d" UNIQUE ("user_id"), CONSTRAINT "UQ_ed87ba6433d5f9c2e76bfa8884e" UNIQUE ("username"), CONSTRAINT "REL_864c435572b9eccb3e6d9e3fb0" UNIQUE ("user_id"), CONSTRAINT "PK_b27dd693f7df17bbfc21f00166a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "creators" ADD CONSTRAINT "FK_864c435572b9eccb3e6d9e3fb0d" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "creators" DROP CONSTRAINT "FK_864c435572b9eccb3e6d9e3fb0d"`,
    );
    await queryRunner.query(`DROP TABLE "creators"`);
  }
}
