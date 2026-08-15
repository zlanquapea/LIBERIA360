import Link from 'next/link';
import { getCategories, getPlaces } from '@/lib/api';
import { PlaceCard } from '@/components/PlaceCard';

// Home screen: search bar, category shortcuts, trending places, near-you
// teaser, map entry point — per Tech Spec §4.1 screen inventory.
export default async function Home() {
  const [categories, trending] = await Promise.all([getCategories(), getPlaces({ sort: 'featured', limit: 6 })]);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-6">
      <section className="flex flex-col gap-3 rounded-2xl bg-gradient-to-br from-brand-700 to-brand-900 p-6 text-white">
        <h1 className="text-2xl font-bold">Everything Liberia. One Place.</h1>
        <p className="text-brand-100">
          Discover destinations, food, and stays across all 15 counties — starting with Greater Monrovia.
        </p>
        <form action="/search" method="GET" className="flex overflow-hidden rounded-full bg-white">
          <input
            type="search"
            name="q"
            placeholder="Search places, food, activities..."
            className="w-full px-4 py-2.5 text-sm text-slate-900 outline-none"
          />
          <button type="submit" className="px-4 text-lg" aria-label="Search">
            🔍
          </button>
        </form>
      </section>

      <section aria-labelledby="categories-heading" className="flex flex-col gap-3">
        <h2 id="categories-heading" className="text-lg font-semibold text-slate-900">
          Browse by category
        </h2>
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/categories/${category.slug}`}
              className="flex shrink-0 flex-col items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-3 text-center hover:border-brand-500"
            >
              <span aria-hidden className="text-2xl">
                {category.icon}
              </span>
              <span className="whitespace-nowrap text-xs font-medium text-slate-700">{category.name}</span>
            </Link>
          ))}
        </div>
      </section>

      <Link
        href="/explore"
        className="flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50 px-5 py-4 hover:border-brand-400"
      >
        <div>
          <p className="font-semibold text-brand-800">Explore the map</p>
          <p className="text-sm text-brand-700">See every place, color-coded by category</p>
        </div>
        <span aria-hidden className="text-2xl">
          🗺️
        </span>
      </Link>

      <section aria-labelledby="trending-heading" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 id="trending-heading" className="text-lg font-semibold text-slate-900">
            Trending places
          </h2>
          <Link href="/search" className="text-sm font-medium text-brand-700 hover:underline">
            See all
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {trending.data.map((place) => (
            <PlaceCard key={place.id} place={place} />
          ))}
        </div>
      </section>

      <section className="flex items-center justify-between rounded-xl border border-dashed border-slate-300 px-5 py-4">
        <div>
          <p className="font-semibold text-slate-700">Near Me</p>
          <p className="text-sm text-slate-500">Radius-based discovery is coming in Phase 2.</p>
        </div>
        <span aria-hidden className="text-2xl opacity-50">
          📡
        </span>
      </section>
    </main>
  );
}
