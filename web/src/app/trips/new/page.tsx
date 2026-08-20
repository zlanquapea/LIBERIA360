import { getCategories } from '@/lib/api';
import { TripPlannerForm } from '@/components/TripPlannerForm';

export const metadata = { title: 'Build My Liberia Trip — LIBERIA360' };

export default async function NewTripPage() {
  const categories = await getCategories();

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Build My Liberia Trip</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Tell us your days, interests, and budget — we&apos;ll plan the route.</p>
      </div>
      <TripPlannerForm categories={categories} />
    </main>
  );
}
