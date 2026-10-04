import { MigrationInterface, QueryRunner } from "typeorm";

export class AddGuideAvailability1792100000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE guide_profiles ADD COLUMN availability jsonb NOT NULL DEFAULT '{"enabled":false,"weekdays":[0,1,2,3,4,5,6],"blockedDates":[],"version":0}'::jsonb`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query("ALTER TABLE guide_profiles DROP COLUMN availability");
  }
}
