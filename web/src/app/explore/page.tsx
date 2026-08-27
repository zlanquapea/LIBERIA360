import { getCategories, getCounties, getPlaces } from '@/lib/api';
import { ExploreMapLoader } from '@/components/ExploreMapLoader';

export const metadata = { title: 'Explore — LIBERIA360' };

// Explore (Map) screen — full-screen interactive map with search, dropdown
// filters (Category/County/Open now/Price), and a results sheet
// (Tech Spec §4.1, §3.1). The header/search/filter/results chrome all
// lives inside ExploreMapLoader/ExploreMapClient — this page just fetches
// the data once and hands the full viewport-height box to it.
export default async function ExplorePage() {
  const [placesResult, categories, counties] = await Promise.all([
    getPlaces({ limit: 100 }),
    getCategories(),
    getCounties(),
  ]);

  return (
    <div className="h-[calc(100vh-7.5rem)] w-full">
      <ExploreMapLoader places={placesResult.data} categories={categories} counties={counties} />
    </div>
  );
}
