import { notFound } from 'next/navigation';
import { CountyIcon } from '@/lib/icons';
import { colorForCounty } from '@/lib/category-colors';
import { getCountyPlaces, getCounties } from '@/lib/api';
import { ApiError } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { CountyPlacesExplorer } from '@/components/CountyPlacesExplorer';
import { CountySafetyPanel } from '@/components/CountySafetyPanel';
import { JsonLd } from '@/components/JsonLd';
import { countyJsonLd } from '@/lib/structured-data';

// SEO (product review readout, Aug 25, 2026): "each ... county ... should
// eventually have its own properly structured page so LIBERIA360 can rank
// for searches such as ... 'Hotels in Sinkor.'" A real title/description
// per county, not the generic app-wide default.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const counties = await getCounties();
  const county = counties.find((c) => c.slug === slug);
  if (!county) {
    return { title: 'County — LIBERIA360' };
  }
  return {
    title: `Things to do in ${county.name} County — LIBERIA360`,
    description: `Discover places to visit, stay, eat, and explore in ${county.name} County, Liberia.`,
  };
}

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
      <JsonLd data={countyJsonLd(county, placesResult.data)} />

      <PageHeader
        eyebrow="County"
        title={`${county.name} County`}
        description={`${placesResult.meta.total} place${placesResult.meta.total === 1 ? '' : 's'} in the catalog${
          county.rolloutStage > 1 ? ' (still growing)' : ''
        }`}
        action={
          <span
            aria-hidden
            className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-sm"
            style={{ backgroundColor: colorForCounty(county.slug) }}
          >
            <CountyIcon county={county} className="h-7 w-7 text-white" />
          </span>
        }
      />

      <CountySafetyPanel county={county} />

      {placesResult.data.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-8 text-center text-slate-500 dark:text-slate-400">
          No places here yet — we&apos;re still adding {county.name} to the catalog. Check back soon.
        </p>
      ) : (
        <CountyPlacesExplorer places={placesResult.data} countyName={county.name} />
      )}
    </main>
  );
}
