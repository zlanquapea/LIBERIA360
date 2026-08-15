import { MigrationInterface, QueryRunner } from "typeorm";

export class AddVerificationAuditTrail1786822634533 implements MigrationInterface {
  name = "AddVerificationAuditTrail1786822634533";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "places" ADD "verified_by_user_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "places" ADD "verified_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "businesses" ADD "verified_by_user_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "businesses" ADD "verified_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "businesses" DROP COLUMN "verified_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "businesses" DROP COLUMN "verified_by_user_id"`,
    );
    await queryRunner.query(`ALTER TABLE "places" DROP COLUMN "verified_at"`);
    await queryRunner.query(
      `ALTER TABLE "places" DROP COLUMN "verified_by_user_id"`,
    );
  }
}
