import { MigrationInterface, QueryRunner } from "typeorm";
export class AddTripActivity1793000000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TABLE trip_activity(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), trip_id uuid NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE, actor_id uuid REFERENCES users(id) ON DELETE SET NULL, kind varchar(40) NOT NULL, title varchar(300) NOT NULL, target varchar(100) NOT NULL, created_at timestamptz NOT NULL DEFAULT NOW())`,
    );
    await q.query(
      `CREATE INDEX trip_activity_recent ON trip_activity(trip_id,created_at DESC,id DESC)`,
    );
    await q.query(
      `CREATE TABLE trip_activity_preferences(trip_id uuid NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,muted boolean NOT NULL DEFAULT false,PRIMARY KEY(trip_id,user_id))`,
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query("DROP TABLE trip_activity_preferences");
    await q.query("DROP TABLE trip_activity");
  }
}
