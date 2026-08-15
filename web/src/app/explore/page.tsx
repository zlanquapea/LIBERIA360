import { getCategories, getPlaces } from '@/lib/api';
import { ExploreMapLoader } from '@/components/ExploreMapLoader';

export const metadata = { title: 'Explore — LIBERIA360' };

// Explore (Map) screen — full-screen interactive map with category pin
// filters (Tech Spec §4.1, §3.1).
export default async function ExplorePage() {
  const [placesResult, categories] = await Promise.all([getPlaces({ limit: 100 }), getCategories()]);

  return (
    <div className="h-[calc(100vh-7.5rem)] w-full">
      <ExploreMapLoader places={placesResult.data} categories={categories} />
    </div>
  );
}
