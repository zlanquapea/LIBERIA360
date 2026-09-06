import { getCategories } from '@/lib/api';
import { NearMeClient } from '@/components/NearMeClient';

// Near Me (Tech Spec §3.2) — browser geolocation + radius-filtered
// GET /places?lat&lng&radiusKm, plus a category filter (product feedback,
// Aug 25, 2026). Categories are fetched here, server-side, the same way
// SearchFilters' categories are fetched by /search's page component —
// NearMeClient itself is client-only (navigator.geolocation has no
// server-side equivalent), so it can't fetch this on its own.
export default async function NearMePage() {
  const categories = await getCategories();
  return <NearMeClient categories={categories} />;
}
