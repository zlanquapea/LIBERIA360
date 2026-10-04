import { MigrationInterface, QueryRunner } from "typeorm";
export class AddTripBudgets1792300000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TABLE trip_budgets (trip_id uuid PRIMARY KEY REFERENCES itineraries(id) ON DELETE CASCADE, data jsonb NOT NULL, version integer NOT NULL DEFAULT 1, updated_by uuid REFERENCES users(id) ON DELETE SET NULL, updated_at timestamptz NOT NULL DEFAULT NOW())`,
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query("DROP TABLE trip_budgets");
  }
}
