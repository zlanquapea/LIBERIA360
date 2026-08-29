import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Redesigns CarListing's ownership model from "child of a claimed
 * Business/Place" to a direct peer-to-peer marketplace listing — same
 * shape as Advertisement (direct `owner_user_id`) plus a required direct
 * `county_id` (same shape as Event), because Liberia has very few formal
 * car-rental companies and forcing every lister through the
 * Business/Place claim flow was the wrong model (see CarListing's
 * updated doc comment).
 *
 * `business_id` stays as a column but is loosened from required to
 * optional: an actual registered rental company can still link its
 * fleet to its claimed Business, but it's no longer a prerequisite to
 * list a car at all.
 */
export class AddCarListingDirectOwnership1788300000000 implements MigrationInterface {
  name = "AddCarListingDirectOwnership1788300000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- owner_user_id: nullable first, backfilled from the linked
    // business's owner (every existing car_listings row up to this point
    // was required to have a business_id, and creating that business
    // required an owner), then locked to NOT NULL. ---
    await queryRunner.query(
      `ALTER TABLE "car_listings" ADD COLUMN "owner_user_id" uuid`,
    );
    await queryRunner.query(`
      UPDATE "car_listings" cl
      SET "owner_user_id" = b."owner_user_id"
      FROM "businesses" b
      WHERE cl."business_id" = b."id" AND b."owner_user_id" IS NOT NULL
    `);
    // Anything left without an owner (a business with no owner somehow)
    // has no sensible ownership to backfill — falls back to the car
    // listing's own reviewer, and failing that, whichever admin reviewed
    // something in the system, since NOT NULL below requires a value.
    // In practice this table is new enough that no row should hit this.
    await queryRunner.query(`
      UPDATE "car_listings"
      SET "owner_user_id" = "reviewed_by_user_id"
      WHERE "owner_user_id" IS NULL AND "reviewed_by_user_id" IS NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "car_listings" ALTER COLUMN "owner_user_id" SET NOT NULL
    `);
    await queryRunner.query(
      `ALTER TABLE "car_listings" ADD CONSTRAINT "FK_car_listings_owner" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_car_listings_owner" ON "car_listings" ("owner_user_id")`,
    );

    // --- business_id: loosen from required to optional. Drop and re-add
    // its FK with ON DELETE SET NULL instead of CASCADE, since a listing
    // should now survive its optionally-linked business being deleted
    // rather than disappear with it. ---
    await queryRunner.query(
      `ALTER TABLE "car_listings" DROP CONSTRAINT "FK_car_listings_business"`,
    );
    await queryRunner.query(
      `ALTER TABLE "car_listings" ALTER COLUMN "business_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "car_listings" ADD CONSTRAINT "FK_car_listings_business" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    // --- county_id: nullable first, backfilled from the linked
    // business's linked place's county, then locked to NOT NULL. ---
    await queryRunner.query(
      `ALTER TABLE "car_listings" ADD COLUMN "county_id" uuid`,
    );
    await queryRunner.query(`
      UPDATE "car_listings" cl
      SET "county_id" = p."county_id"
      FROM "businesses" b
      JOIN "places" p ON p."id" = b."linked_place_id"
      WHERE cl."business_id" = b."id"
    `);
    // A listing that still has no county (no business link, or a business
    // whose place had none) falls back to whatever county sorts first —
    // there's no better default, and this table is new enough that no
    // row should hit this in practice either.
    await queryRunner.query(`
      UPDATE "car_listings"
      SET "county_id" = (SELECT "id" FROM "counties" ORDER BY "name" ASC LIMIT 1)
      WHERE "county_id" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "car_listings" ALTER COLUMN "county_id" SET NOT NULL
    `);
    await queryRunner.query(
      `ALTER TABLE "car_listings" ADD CONSTRAINT "FK_car_listings_county" FOREIGN KEY ("county_id") REFERENCES "counties"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_car_listings_county" ON "car_listings" ("county_id")`,
    );

    // --- direct contact fields, same as Advertisement, for the common
    // case of an individual lister with no Business to source contact
    // info from. ---
    await queryRunner.query(`
      ALTER TABLE "car_listings"
      ADD COLUMN "contact_phone" character varying(40),
      ADD COLUMN "contact_whatsapp" character varying(40)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "car_listings"
      DROP COLUMN "contact_whatsapp",
      DROP COLUMN "contact_phone"
    `);

    await queryRunner.query(`DROP INDEX "IDX_car_listings_county"`);
    await queryRunner.query(
      `ALTER TABLE "car_listings" DROP CONSTRAINT "FK_car_listings_county"`,
    );
    await queryRunner.query(
      `ALTER TABLE "car_listings" DROP COLUMN "county_id"`,
    );

    await queryRunner.query(
      `ALTER TABLE "car_listings" DROP CONSTRAINT "FK_car_listings_business"`,
    );
    // NOTE: not restoring business_id's NOT NULL — by the time this down()
    // could run, real rows may legitimately have no business_id, and
    // there's no backfill that would make that safe. Same documented
    // partial-reversal precedent as AddCarListings' down() leaving the
    // widened businesses_type_enum in place. Re-add the original CASCADE
    // FK so the schema shape at least matches the pre-migration
    // constraint's delete behavior.
    await queryRunner.query(
      `ALTER TABLE "car_listings" ADD CONSTRAINT "FK_car_listings_business" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(`DROP INDEX "IDX_car_listings_owner"`);
    await queryRunner.query(
      `ALTER TABLE "car_listings" DROP CONSTRAINT "FK_car_listings_owner"`,
    );
    await queryRunner.query(
      `ALTER TABLE "car_listings" DROP COLUMN "owner_user_id"`,
    );
  }
}
