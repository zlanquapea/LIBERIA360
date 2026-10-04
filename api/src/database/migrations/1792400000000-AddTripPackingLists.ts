import { MigrationInterface, QueryRunner } from "typeorm";
export class AddTripPackingLists1792400000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TABLE trip_packing_lists (trip_id uuid NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, items jsonb NOT NULL DEFAULT '[]'::jsonb, version integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT NOW(), PRIMARY KEY (trip_id, user_id))`,
    );
    await q.query(
      "CREATE INDEX trip_packing_lists_user_idx ON trip_packing_lists(user_id)",
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query("DROP TABLE trip_packing_lists");
  }
}
