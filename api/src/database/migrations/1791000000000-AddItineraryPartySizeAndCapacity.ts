import { MigrationInterface, QueryRunner } from "typeorm";

export class AddItineraryPartySizeAndCapacity1791000000000 implements MigrationInterface {
  name = "AddItineraryPartySizeAndCapacity1791000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "itineraries"
      ADD COLUMN "party_size" smallint,
      ADD COLUMN "max_participants" smallint
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "itineraries"
      DROP COLUMN "max_participants",
      DROP COLUMN "party_size"
    `);
  }
}
