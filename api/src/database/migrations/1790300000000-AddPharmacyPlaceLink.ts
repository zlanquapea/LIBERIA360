import { MigrationInterface, QueryRunner } from "typeorm";

// Links the pharmacy marketplace back to the general Place catalog, so a
// self-service place submission under the dedicated "Pharmacy(ies)"
// category (see PlacesService.submitPlace /
// PharmaciesService.autoClaimSubmittedPlace) produces a pharmacy that
// also appears everywhere an ordinary Place does — map, directory, place
// detail page — instead of only being reachable through the pharmacy
// marketplace's own separate application flow.
export class AddPharmacyPlaceLink1790300000000 implements MigrationInterface {
  name = "AddPharmacyPlaceLink1790300000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pharmacies" ADD COLUMN "place_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "pharmacies"
      ADD CONSTRAINT "UQ_pharmacies_place_id" UNIQUE ("place_id")
    `);
    // SET NULL, not CASCADE — a pharmacy's own record and order history
    // outlive the catalog listing that introduced it; removing the place
    // shouldn't take the pharmacy (or its orders) down with it.
    await queryRunner.query(`
      ALTER TABLE "pharmacies"
      ADD CONSTRAINT "FK_pharmacies_place_id" FOREIGN KEY ("place_id")
      REFERENCES "places"("id") ON DELETE SET NULL
    `);

    // Seeds the dedicated "Pharmacies" category that triggers the auto-claim
    // (matched by slug/name in PlacesService.submitPlace, which accepts
    // both "pharmacy" and "pharmacies") — deliberately separate from the
    // existing "Health & Pharmacies" category, which groups hospitals/
    // clinics/pharmacies together for informational "find a nearby X"
    // browsing and was never meant to carry commerce. Slug matches
    // lib/icons.tsx's pre-existing 'pharmacies' -> MdMedication entry
    // (already present for an admin-created category of this name), so
    // this seed is a no-op wherever that category already exists.
    // ON CONFLICT DO NOTHING: safe to run even if an admin already created
    // a category with this exact slug by hand.
    await queryRunner.query(`
      INSERT INTO "categories" ("name", "slug", "icon", "description")
      VALUES (
        'Pharmacies',
        'pharmacies',
        'MdMedication',
        'Retail pharmacies with online ordering and prescription upload.'
      )
      ON CONFLICT ("slug") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pharmacies" DROP CONSTRAINT IF EXISTS "FK_pharmacies_place_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "pharmacies" DROP CONSTRAINT IF EXISTS "UQ_pharmacies_place_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "pharmacies" DROP COLUMN IF EXISTS "place_id"
    `);
    // The seeded category is left in place on rollback — by the time this
    // could roll back, places may already reference it (via category_id),
    // and deleting it would break those rows for no benefit.
  }
}
