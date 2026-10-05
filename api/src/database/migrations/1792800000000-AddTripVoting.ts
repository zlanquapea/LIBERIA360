import { MigrationInterface, QueryRunner } from "typeorm";
export class AddTripVoting1792800000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TABLE trip_suggestions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),trip_id uuid NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,title varchar(300) NOT NULL,input jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT NOW(),UNIQUE(trip_id,input))`,
    );
    await q.query(
      `CREATE TABLE trip_suggestion_votes(suggestion_id uuid NOT NULL REFERENCES trip_suggestions(id) ON DELETE CASCADE,user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,PRIMARY KEY(suggestion_id,user_id))`,
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query("DROP TABLE trip_suggestion_votes");
    await q.query("DROP TABLE trip_suggestions");
  }
}
