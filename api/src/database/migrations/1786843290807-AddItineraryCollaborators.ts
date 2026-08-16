import { MigrationInterface, QueryRunner } from "typeorm";

export class AddItineraryCollaborators1786843290807 implements MigrationInterface {
  name = "AddItineraryCollaborators1786843290807";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "itinerary_collaborators" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "itinerary_id" uuid NOT NULL, "user_id" uuid NOT NULL, "invited_by_user_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_f25e96364b66f23ab8a5dda0647" UNIQUE ("itinerary_id", "user_id"), CONSTRAINT "PK_95797870be095cf12844b0651d9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fd3cef44f76c373fa1b3948492" ON "itinerary_collaborators" ("itinerary_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2d4bb4d8faca14b5a73f92e3c7" ON "itinerary_collaborators" ("user_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "itinerary_collaborators" ADD CONSTRAINT "FK_fd3cef44f76c373fa1b39484923" FOREIGN KEY ("itinerary_id") REFERENCES "itineraries"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "itinerary_collaborators" ADD CONSTRAINT "FK_2d4bb4d8faca14b5a73f92e3c7a" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "itinerary_collaborators" DROP CONSTRAINT "FK_2d4bb4d8faca14b5a73f92e3c7a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "itinerary_collaborators" DROP CONSTRAINT "FK_fd3cef44f76c373fa1b39484923"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2d4bb4d8faca14b5a73f92e3c7"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fd3cef44f76c373fa1b3948492"`,
    );
    await queryRunner.query(`DROP TABLE "itinerary_collaborators"`);
  }
}
