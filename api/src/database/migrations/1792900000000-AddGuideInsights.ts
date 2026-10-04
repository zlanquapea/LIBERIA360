import { MigrationInterface, QueryRunner } from "typeorm";
export class AddGuideInsights1792900000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TABLE guide_view_events(id uuid PRIMARY KEY,guide_id uuid NOT NULL REFERENCES guide_profiles(id) ON DELETE CASCADE,experience_id uuid REFERENCES experiences(id) ON DELETE CASCADE,created_at timestamptz NOT NULL DEFAULT NOW())`,
    );
    await q.query(
      `CREATE INDEX guide_view_events_guide_date ON guide_view_events(guide_id,created_at)`,
    );
    await q.query(
      `CREATE INDEX guide_view_events_experience_date ON guide_view_events(experience_id,created_at)`,
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query("DROP TABLE guide_view_events");
  }
}
