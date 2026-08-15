import { getCounties } from '@/lib/api';
import { NewEventForm } from '@/components/NewEventForm';

export const metadata = { title: 'Post an event — LIBERIA360' };

export default async function NewEventPage() {
  const counties = await getCounties();

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Post an event</h1>
        <p className="text-sm text-slate-500">Let travelers and locals know what&apos;s happening.</p>
      </div>
      <NewEventForm counties={counties} />
    </main>
  );
}
