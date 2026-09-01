import { TripPlannerForm } from '@/components/TripPlannerForm';

export const metadata = { title: 'Build My Liberia Trip — LIBERIA360' };

export default function NewTripPage() {
  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Build My Liberia Trip</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Search for your destination, pick your days and budget — we&apos;ll plan the route.</p>
      </div>
      <TripPlannerForm />
    </main>
  );
}
