import { MigrationInterface, QueryRunner } from "typeorm";

// AddPharmacyMarketplace1790100000000 created "pharmacy_product_categories"
// but never populated it, and the only place that ever inserted rows was
// pharmacy-seed.ts's `seedPharmacyMarketplace` — a dev-only script run via
// `npm run seed`, never executed against production. The "Category" field
// on the pharmacy dashboard's "Add product" form is required, so with an
// empty table (the case on production) its dropdown has zero options and a
// pharmacy operator can never create a product at all.
//
// Seeds the same 5 default categories (and slug derivation) as
// pharmacy-seed.ts, so environments where the dev seed already ran and
// production alike converge on the same rows either way.
// ON CONFLICT DO NOTHING: safe to run even if the dev seed (or an earlier
// run of this migration) already inserted these.
export class SeedPharmacyProductCategories1790400000000 implements MigrationInterface {
  name = "SeedPharmacyProductCategories1790400000000";

  private static readonly CATEGORIES = [
    "Pain relief",
    "Cold and allergy",
    "First aid",
    "Vitamins",
    "Personal care",
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const name of SeedPharmacyProductCategories1790400000000.CATEGORIES) {
      const slug = name.toLowerCase().replaceAll(" ", "-");
      await queryRunner.query(
        `
          INSERT INTO "pharmacy_product_categories" ("name", "slug")
          VALUES ($1, $2)
          ON CONFLICT ("slug") DO NOTHING
        `,
        [name, slug],
      );
    }
  }

  public async down(): Promise<void> {
    // Left in place on rollback — by the time this could roll back, live
    // pharmacy_products rows may already reference these categories by id,
    // and deleting them would break those products for no benefit.
  }
}
