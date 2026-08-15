import 'reflect-metadata';
import { AppDataSource } from './data-source';
import { County } from '../counties/entities/county.entity';
import { Category } from '../categories/entities/category.entity';
import { Place } from '../places/entities/place.entity';
import { Activity } from '../activities/entities/activity.entity';
import { COUNTY_SEEDS, CATEGORY_SEEDS, PLACE_SEEDS } from './seed-data';

/**
 * Idempotent seed script — safe to re-run. Upserts by `slug` for
 * counties/categories/places, and replaces activities for each seeded
 * place so re-running never duplicates rows.
 */
async function seed() {
  const dataSource = await AppDataSource.initialize();

  try {
    const countyRepo = dataSource.getRepository(County);
    const categoryRepo = dataSource.getRepository(Category);
    const placeRepo = dataSource.getRepository(Place);
    const activityRepo = dataSource.getRepository(Activity);

    await countyRepo.upsert(COUNTY_SEEDS, ['slug']);
    console.log(`Seeded ${COUNTY_SEEDS.length} counties.`);

    await categoryRepo.upsert(CATEGORY_SEEDS, ['slug']);
    console.log(`Seeded ${CATEGORY_SEEDS.length} categories.`);

    const counties = await countyRepo.find();
    const countyBySlug = new Map(counties.map((c) => [c.slug, c]));
    const categories = await categoryRepo.find();
    const categoryBySlug = new Map(categories.map((c) => [c.slug, c]));

    for (const placeSeed of PLACE_SEEDS) {
      const county = countyBySlug.get(placeSeed.countySlug);
      const category = categoryBySlug.get(placeSeed.categorySlug);
      if (!county || !category) {
        throw new Error(
          `Seed data error: place "${placeSeed.slug}" references unknown county/category slug.`,
        );
      }

      const { activities, countySlug, categorySlug, ...placeFields } = placeSeed;

      let place = await placeRepo.findOne({ where: { slug: placeSeed.slug } });
      if (place) {
        placeRepo.merge(place, { ...placeFields, county, category });
      } else {
        place = placeRepo.create({ ...placeFields, county, category });
      }
      place = await placeRepo.save(place);

      // Replace this place's activities on every run so re-seeding stays idempotent.
      await activityRepo.delete({ placeId: place.id });
      if (activities?.length) {
        const activityRows = activities.map((a) => activityRepo.create({ ...a, placeId: place.id }));
        await activityRepo.save(activityRows);
      }
    }
    console.log(`Seeded ${PLACE_SEEDS.length} places (Stage 1 — Greater Monrovia).`);

    console.log('Seed complete.');
  } finally {
    await dataSource.destroy();
  }
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
