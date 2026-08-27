import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCreatorAvailabilityStatus1788000002000 implements MigrationInterface {
  name = "AddCreatorAvailabilityStatus1788000002000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."creators_availability_status_enum" AS ENUM('accepting_requests', 'limited', 'unavailable')`,
    );
    await queryRunner.query(
      `ALTER TABLE "creators" ADD "availability_status" "public"."creators_availability_status_enum" NOT NULL DEFAULT 'accepting_requests'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "creators" DROP COLUMN "availability_status"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."creators_availability_status_enum"`,
    );
  }
}
