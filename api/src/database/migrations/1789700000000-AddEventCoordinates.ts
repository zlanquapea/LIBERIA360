import { MigrationInterface, QueryRunner } from "typeorm";

// Optional exact pin for an event's location — same map-picker-driven
// lat/lng as Place (see PlaceLocationPicker), added so an organizer can
// place their event on a map the same way a place submitter does, and so
// the event detail page can render a mini map + "Get directions" link
// (see PlaceKeyFacts' directionsLink usage) instead of a plain freeform
// address string with nothing to navigate by.
export class AddEventCoordinates1789700000000 implements MigrationInterface {
  name = "AddEventCoordinates1789700000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events" ADD "latitude" numeric(9,6)`);
    await queryRunner.query(
      `ALTER TABLE "events" ADD "longitude" numeric(9,6)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "longitude"`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "latitude"`);
  }
}
