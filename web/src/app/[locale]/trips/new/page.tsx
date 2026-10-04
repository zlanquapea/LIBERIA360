import Link from 'next/link';
import { TripPlannerForm } from '@/components/TripPlannerForm';

export const metadata = { title: 'Plan a Trip — LIBERIA360' };

// Deliberately a plain sync Server Component (no getTranslations here) so
// this route stays statically prerenderable per locale — see the header
// comment in TripPlannerForm for why the title/subtitle moved there
// instead of living in this wrapper.
export default function NewTripPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 pb-28 sm:px-6 sm:py-10">
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
        <h2 className="text-lg font-bold">Start with a trip idea</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Choose a curated itinerary, save your own copy, then change the stops and dates to suit you.</p>
        <Link href="/trip-ideas" className="mt-3 inline-flex min-h-11 items-center rounded-full bg-brand-700 px-4 text-sm font-semibold text-white dark:bg-emerald-300 dark:text-slate-950">Browse editable trip ideas →</Link>
      </section>
      <TripPlannerForm />
    </main>
  );
}

