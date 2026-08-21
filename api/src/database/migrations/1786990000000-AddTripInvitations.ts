import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTripInvitations1786990000000 implements MigrationInterface {
  name = "AddTripInvitations1786990000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."trip_invitations_status_enum" AS ENUM('pending', 'accepted', 'declined')`,
    );
    await queryRunner.query(`
      CREATE TABLE "trip_invitations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "itinerary_id" uuid NOT NULL,
        "invited_by_user_id" uuid NOT NULL,
        "email" character varying(255) NOT NULL,
        "invitee_user_id" uuid,
        "token_hash" text NOT NULL,
        "status" "public"."trip_invitations_status_enum" NOT NULL DEFAULT 'pending',
        "viewed_at" TIMESTAMP WITH TIME ZONE,
        "responded_at" TIMESTAMP WITH TIME ZONE,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "email_delivered" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_trip_invitations_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_trip_invitations_itinerary_id" ON "trip_invitations" ("itinerary_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_trip_invitations_invitee_user_id" ON "trip_invitations" ("invitee_user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_trip_invitations_itinerary_email" ON "trip_invitations" ("itinerary_id", "email")`,
    );
    // Accept/decline links are looked up by exact token hash — same
    // "single indexed equality lookup" shape as users.email_verification_token_hash.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_trip_invitations_token_hash" ON "trip_invitations" ("token_hash")`,
    );
    await queryRunner.query(
      `ALTER TABLE "trip_invitations" ADD CONSTRAINT "FK_trip_invitations_itinerary" FOREIGN KEY ("itinerary_id") REFERENCES "itineraries"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "trip_invitations" ADD CONSTRAINT "FK_trip_invitations_invited_by" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "trip_invitations" ADD CONSTRAINT "FK_trip_invitations_invitee" FOREIGN KEY ("invitee_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "trip_invitations" DROP CONSTRAINT "FK_trip_invitations_invitee"`,
    );
    await queryRunner.query(
      `ALTER TABLE "trip_invitations" DROP CONSTRAINT "FK_trip_invitations_invited_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "trip_invitations" DROP CONSTRAINT "FK_trip_invitations_itinerary"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_trip_invitations_token_hash"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_trip_invitations_itinerary_email"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_trip_invitations_invitee_user_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_trip_invitations_itinerary_id"`,
    );
    await queryRunner.query(`DROP TABLE "trip_invitations"`);
    await queryRunner.query(
      `DROP TYPE "public"."trip_invitations_status_enum"`,
    );
  }
}
