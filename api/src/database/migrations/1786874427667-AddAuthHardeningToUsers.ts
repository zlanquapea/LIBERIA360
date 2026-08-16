import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAuthHardeningToUsers1786874427667 implements MigrationInterface {
  name = "AddAuthHardeningToUsers1786874427667";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "token_version" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "email_verified" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "email_verification_token_hash" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "email_verification_token_expires_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "password_reset_token_hash" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "password_reset_token_expires_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "deleted_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "deleted_at"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "password_reset_token_expires_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "password_reset_token_hash"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "email_verification_token_expires_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "email_verification_token_hash"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "email_verified"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "token_version"`);
  }
}
