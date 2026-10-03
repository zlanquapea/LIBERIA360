import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCollaboratorRoles1791800000000 implements MigrationInterface {
  name = "AddCollaboratorRoles1791800000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."collaborator_role_enum" AS ENUM('editor', 'viewer')`,
    );
    // Everyone already on a trip keeps the edit access they had.
    await queryRunner.query(
      `ALTER TABLE "itinerary_collaborators" ADD "role" "public"."collaborator_role_enum" NOT NULL DEFAULT 'editor'`,
    );
    await queryRunner.query(
      `ALTER TABLE "trip_invitations" ADD "role" "public"."collaborator_role_enum" NOT NULL DEFAULT 'editor'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "trip_invitations" DROP COLUMN "role"`,
    );
    await queryRunner.query(
      `ALTER TABLE "itinerary_collaborators" DROP COLUMN "role"`,
    );
    await queryRunner.query(`DROP TYPE "public"."collaborator_role_enum"`);
  }
}
