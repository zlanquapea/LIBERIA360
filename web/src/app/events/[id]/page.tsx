import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarDaysIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { ApiError, getEvent } from '@/lib/api';
import { formatEventCategory, formatEventDateRange } from '@/lib/format';
import { JsonLd } from '@/components/JsonLd';
import { eventJsonLd } from '@/lib/structured-data';
import { ReportButton } from '@/components/ReportButton';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await getEvent(id).catch(() => null);
  if (!event) {
    return { title: 'Event — LIBERIA360' };
  }
  return {
    title: `${event.name} — LIBERIA360 Events`,
    description: event.description || undefined,
  };
}

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const event = await getEvent(id).catch((error) => {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  });
  if (!event) {
    notFound();
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
      <JsonLd data={eventJsonLd(event)} />
      <span className="w-fit rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
        {formatEventCategory(event.category)}
      </span>

      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">{event.name}</h1>

      <div className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-300">
        <p className="flex items-center gap-1.5">
          <CalendarDaysIcon aria-hidden className="h-4 w-4 shrink-0 text-brand-600" />
          {formatEventDateRange(event.startDate, event.endDate)}
        </p>
        <p className="flex items-center gap-1.5">
          <MapPinIcon aria-hidden className="h-4 w-4 shrink-0 text-brand-600" />
          {event.place ? (
            <Link href={`/places/${event.place.slug}`} className="text-brand-700 hover:underline">
              {event.place.name}
            </Link>
          ) : (
            event.locationText
          )}{' '}
          · {event.county.name} County
        </p>
      </div>

      {event.description && <p className="text-slate-700 dark:text-slate-200">{event.description}</p>}

      {event.ticketInfo && (
        <section className="flex flex-col gap-1 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Tickets</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">{event.ticketInfo}</p>
        </section>
      )}

      <div className="flex items-center justify-between gap-2">
        {event.createdBy ? (
          <p className="text-xs text-slate-400 dark:text-slate-500">Posted by {event.createdBy.name}</p>
        ) : (
          <span />
        )}
        <ReportButton targetType="event" targetId={event.id} />
      </div>
    </main>
  );
}
