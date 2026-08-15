import { getCategories } from '@/lib/api';
import { WeekendExplorerForm } from '@/components/WeekendExplorerForm';

export const metadata = { title: 'Weekend Explorer — LIBERIA360' };

export default async function NewWeekendPage() {
  const categories = await getCategories();

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Weekend Explorer</h1>
        <p className="text-sm text-slate-500">Find what&apos;s within reach for a quick getaway.</p>
      </div>
      <WeekendExplorerForm categories={categories} />
    </main>
  );
}
