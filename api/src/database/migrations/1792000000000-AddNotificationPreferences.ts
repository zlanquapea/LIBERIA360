import { MigrationInterface, QueryRunner } from "typeorm";
export class AddNotificationPreferences1792000000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TABLE notification_preferences (user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, preferences jsonb NOT NULL DEFAULT '{}'::jsonb)`,
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query("DROP TABLE notification_preferences");
  }
}
