import { TripPlannerForm } from '@/components/TripPlannerForm';

export const metadata = { title: 'Plan a Trip — LIBERIA360' };

// Deliberately a plain sync Server Component (no getTranslations here) so
// this route stays statically prerenderable per locale — see the header
// comment in TripPlannerForm for why the title/subtitle moved there
// instead of living in this wrapper.
export default function NewTripPage() {
  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-10">
      <TripPlannerForm />
    </main>
  );
}
