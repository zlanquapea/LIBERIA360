import { getCategories, getCounties, getPlaces } from '@/lib/api';
import { ExploreMapLoader } from '@/components/ExploreMapLoader';

export const metadata = { title: 'Explore — LIBERIA360' };

// Explore: map and list side by side (a sheet over the map on phones).
// Filters are read from and written to the URL on the client (see
// lib/explore-filters.ts); this page just fetches the catalog once.
export default async function ExplorePage() {
  const [placesResult, categories, counties] = await Promise.all([
    getPlaces({ limit: 100 }),
    getCategories(),
    getCounties(),
  ]);

  return (
    <div className="h-[calc(100dvh-7.5rem)] w-full lg:h-[calc(100dvh-4.5rem)]">
      <ExploreMapLoader places={placesResult.data} categories={categories} counties={counties} />
    </div>
  );
}
