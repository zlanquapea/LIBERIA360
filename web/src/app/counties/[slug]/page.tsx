import { notFound } from 'next/navigation';
import { getCountyPlaces, getCounties } from '@/lib/api';
import { ApiError } from '@/lib/api';
import { PlaceCard } from '@/components/PlaceCard';
import { CountySafetyPanel } from '@/components/CountySafetyPanel';

// County detail — places within a chosen county (Tech Spec §4.1).
export default async function CountyDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const [counties, placesResult] = await Promise.all([
    getCounties(),
    getCountyPlaces(slug, { limit: 50 }).catch((error) => {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }),
  ]);

  const county = counties.find((c) => c.slug === slug);
  if (!county || !placesResult) {
    notFound();
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <span aria-hidden className="text-2xl">
            {county.icon ?? '📍'}
          </span>
          {county.name} County
        </h1>
        <p className="text-sm text-slate-500">
          {placesResult.meta.total} place{placesResult.meta.total === 1 ? '' : 's'} in the catalog
          {county.rolloutStage > 1 && ' (still growing)'}
        </p>
      </div>

      <CountySafetyPanel county={county} />

      {placesResult.data.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-slate-500">
          No places here yet — we&apos;re still adding {county.name} to the catalog. Check back soon.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {placesResult.data.map((place) => (
            <PlaceCard key={place.id} place={place} />
          ))}
        </div>
      )}
    </main>
  );
}
