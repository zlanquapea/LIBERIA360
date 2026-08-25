import { getCategories } from '@/lib/api';
import { TripPlannerForm } from '@/components/TripPlannerForm';

export const metadata = { title: 'Build My Liberia Trip — LIBERIA360' };

type SearchParams = { [key: string]: string | string[] | undefined };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// `?interest=<category-slug>` — a "Plan a trip with this place" link from a
// place page pre-selects that place's category, so the planner opens
// already relevant to what the visitor was just looking at instead of a
// blank slate.
export default async function NewTripPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const interest = first(params.interest);
  const categories = await getCategories();

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Build My Liberia Trip</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Tell us your days, interests, and budget — we&apos;ll plan the route.</p>
      </div>
      <TripPlannerForm categories={categories} initialInterests={interest ? [interest] : undefined} />
    </main>
  );
}
