import { MigrationInterface, QueryRunner } from "typeorm";
export class AddAccountCollections1791900000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TABLE saved_collections (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, name varchar(80) NOT NULL, items jsonb NOT NULL DEFAULT '[]'::jsonb, version integer NOT NULL DEFAULT 1, share_token uuid UNIQUE)`,
    );
    await q.query(
      "CREATE INDEX saved_collections_user_idx ON saved_collections(user_id)",
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query("DROP TABLE saved_collections");
  }
}
