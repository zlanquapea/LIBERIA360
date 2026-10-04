import { MigrationInterface, QueryRunner } from "typeorm";
export class AddGuideAvailabilityAlerts1792700000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TABLE guide_availability_alerts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, experience_id uuid NOT NULL REFERENCES experiences(id) ON DELETE CASCADE, requested_date date NOT NULL, notified_at timestamptz, checked_at timestamptz NOT NULL DEFAULT NOW(), created_at timestamptz NOT NULL DEFAULT NOW(), UNIQUE(user_id, experience_id, requested_date))`,
    );
    await q.query(
      "CREATE INDEX guide_availability_alerts_pending_idx ON guide_availability_alerts(checked_at, id) WHERE notified_at IS NULL",
    );
    await q.query(
      "CREATE INDEX guide_availability_alerts_experience_idx ON guide_availability_alerts(experience_id)",
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query("DROP TABLE guide_availability_alerts");
  }
}
