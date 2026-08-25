import { notFound } from 'next/navigation';
import { getCategories, getPlaces } from '@/lib/api';
import { PlaceCard } from '@/components/PlaceCard';
import { CategoryIcon } from '@/lib/icons';

// Category Browse screen — grid/list of places within a chosen category
// (Tech Spec §4.1).
export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [categories, placesResult] = await Promise.all([getCategories(), getPlaces({ category: slug, limit: 50 })]);

  const category = categories.find((c) => c.slug === slug);
  if (!category) {
    notFound();
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
      <div className="flex items-center gap-3">
        <CategoryIcon iconKey={category.icon} className="h-8 w-8 text-brand-600 dark:text-brand-300" />
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">{category.name}</h1>
          {category.description && <p className="text-sm text-slate-500 dark:text-slate-400">{category.description}</p>}
        </div>
      </div>

      {placesResult.data.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-8 text-center text-slate-500 dark:text-slate-400">
          No places in this category yet.
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
