import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSuperAdminAndProfileFields1786831041607 implements MigrationInterface {
  name = "AddSuperAdminAndProfileFields1786831041607";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "is_super_admin" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_traveler_type_enum" AS ENUM('diaspora', 'tourist', 'expat', 'business_traveler', 'local_resident')`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "traveler_type" "public"."users_traveler_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "interests" text array NOT NULL DEFAULT '{}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "interests"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "traveler_type"`);
    await queryRunner.query(`DROP TYPE "public"."users_traveler_type_enum"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "is_super_admin"`);
  }
}
