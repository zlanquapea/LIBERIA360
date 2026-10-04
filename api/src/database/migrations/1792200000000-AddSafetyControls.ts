import { MigrationInterface, QueryRunner } from "typeorm";
export class AddSafetyControls1792200000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TABLE user_blocks (blocker_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, blocked_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT NOW(), PRIMARY KEY (blocker_id, blocked_user_id), CHECK (blocker_id <> blocked_user_id))`,
    );
    await q.query(
      "CREATE INDEX user_blocks_target_idx ON user_blocks(blocked_user_id, blocker_id)",
    );
    await q.query(
      `CREATE TABLE safety_reports (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reporter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, target_type varchar(30) NOT NULL CHECK (target_type IN ('creator_post','conversation_message')), target_id uuid NOT NULL, reason varchar(30) NOT NULL, details varchar(1000), snapshot jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT NOW(), reviewed_at timestamptz, reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL, action varchar(10) CHECK (action IN ('hide','dismiss')), UNIQUE (reporter_id, target_type, target_id))`,
    );
    await q.query(
      "CREATE INDEX safety_reports_queue_idx ON safety_reports(reviewed_at, created_at DESC)",
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query("DROP TABLE safety_reports");
    await q.query("DROP TABLE user_blocks");
  }
}
