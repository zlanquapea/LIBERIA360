'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { ClockIcon, MapPinIcon } from '@heroicons/react/20/solid';
import { CalendarDaysIcon } from '@heroicons/react/24/outline';
import { resolveImageUrl, resolveThumbUrl } from '@/lib/images';
import { gradientForCategory } from '@/lib/category-colors';
import { formatCost, formatEventCategory, formatEventDateRange } from '@/lib/format';
import { EVENT_ACCENT, eventCountdown, eventPrice, eventStub, eventTimeLabel } from '@/lib/event-ticket';
import { staggerDelay } from '@/lib/animation';
import { SafeImage } from './SafeImage';
import { EventRsvpButtons } from './EventRsvpButtons';
import { ShareMenu } from './ShareMenu';
import type { Event } from '@/lib/types';

/**
 * An event as a festival ticket: the poster on top, a perforated tear
 * with notches, then the torn-off date stub beside what, where and when,
 * with an "Admit one" price stamp. A countdown ("Tonight", "In 3 days")
 * sits on the poster. `shelf` is the narrow card in carousels; `feed` is
 * the Events listing, which turns sideways on wider screens with the tear
 * running top to bottom.
 */
export function EventTicket({
  event,
  variant,
  index,
  cardRef,
  testId,
}: {
  event: Event;
  variant: 'shelf' | 'feed';
  index?: number;
  cardRef?: (el: HTMLDivElement | null) => void;
  testId: string;
}) {
  const t = useTranslations('eventTicket');
  const locale = useLocale();
  const feed = variant === 'feed';
  const image = event.images[0];
  const cover = image ? resolveImageUrl(image) : null;
  const coverThumb = image && !feed ? resolveThumbUrl(image) : null;
  const locationLabel = event.place?.name ?? event.locationText ?? event.county.name;
  const stub = eventStub(event.startDate, locale);
  const countdown = eventCountdown(event.startDate, event.endDate);
  const price = eventPrice(event);
  const accent = EVENT_ACCENT[event.category] ?? EVENT_ACCENT.other;
  // Rendered in lists, never on the event's own page: without an explicit
  // URL, ShareMenu would share the list page instead of this event.
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/events/${event.id}` : `/events/${event.id}`;

  return (
    <div
      ref={cardRef}
      data-testid={testId}
      className={`reveal-on-scroll ${feed ? '' : 'w-72 shrink-0 snap-center sm:w-80'}`}
      style={index != null ? staggerDelay(index) : undefined}
    >
      <article className={`lib-ticket group flex h-full flex-col ${feed ? 'lib-ticket--split sm:flex-row' : ''}`}>
        <Link
          href={`/events/${event.id}`}
          className={`lib-ticket__top relative block overflow-hidden rounded-t-[1.5rem] bg-brand-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-sunset-300 ${
            feed ? 'aspect-[16/10] sm:aspect-auto sm:w-[42%] sm:shrink-0 sm:rounded-e-none sm:rounded-s-[1.5rem]' : 'aspect-[16/10]'
          }`}
          tabIndex={-1}
          aria-hidden
        >
          <SafeImage
            src={cover}
            thumbSrc={coverThumb}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.05] motion-reduce:transition-none"
            fallback={
              <div aria-hidden className="absolute inset-0 flex items-center justify-center" style={{ backgroundImage: gradientForCategory(event.category) }}>
                <CalendarDaysIcon className="h-14 w-14 text-white/60" />
              </div>
            }
          />
          <span aria-hidden className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/40" />
          {countdown && (
            <span
              className={`absolute start-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider shadow-sm ${
                countdown.kind === 'live'
                  ? 'bg-flag-600 text-white'
                  : countdown.kind === 'today'
                    ? 'bg-sunset-500 text-white'
                    : 'bg-black/35 text-white ring-1 ring-white/25 backdrop-blur-md'
              }`}
            >
              {countdown.kind === 'live' && (
                <span aria-hidden className="relative flex h-2 w-2">
                  <span className="absolute inset-0 animate-ping rounded-full bg-white opacity-75 motion-reduce:hidden" />
                  <span className="relative h-2 w-2 rounded-full bg-white" />
                </span>
              )}
              {countdown.kind === 'live' && t('live')}
              {countdown.kind === 'today' && t('today')}
              {countdown.kind === 'tomorrow' && t('tomorrow')}
              {countdown.kind === 'days' && t('inDays', { count: countdown.days })}
            </span>
          )}
          <span className="absolute bottom-3 start-3 rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-semibold text-white ring-1 ring-white/25 backdrop-blur-md">
            {formatEventCategory(event.category)}
          </span>
        </Link>

        <div
          className={`lib-ticket__bottom relative flex flex-1 flex-col rounded-b-[1.5rem] bg-white dark:bg-slate-900 ${
            feed ? 'sm:rounded-e-[1.5rem] sm:rounded-s-none' : ''
          }`}
        >
          {/* The perforation, between the notches. */}
          <span
            aria-hidden
            className={`absolute inset-x-4 top-0 border-t-2 border-dashed border-slate-200 dark:border-slate-700 ${
              feed ? 'sm:inset-x-auto sm:inset-y-4 sm:start-0 sm:border-s-2 sm:border-t-0' : ''
            }`}
          />
          <Link href={`/events/${event.id}`} className="flex gap-3 px-4 pb-2 pt-4 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-sunset-300 sm:gap-4">
            <span aria-hidden className="flex w-14 shrink-0 flex-col items-center pt-0.5 text-center">
              <span className={`text-[11px] font-bold uppercase tracking-[0.18em] ${accent.text}`}>{stub.weekday}</span>
              <span className="font-display text-4xl font-black leading-none tracking-tight text-slate-950 dark:text-white">{stub.day}</span>
              <span className="mt-0.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{stub.month}</span>
            </span>
            <span aria-hidden className="w-px self-stretch border-s-2 border-dashed border-slate-200 dark:border-slate-700" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="sr-only">{formatEventDateRange(event.startDate, event.endDate)}</span>
              <div className="flex items-start justify-between gap-2">
                <h3 className={`min-w-0 font-display font-bold leading-snug text-slate-950 transition-colors group-hover:text-brand-700 dark:text-white dark:group-hover:text-brand-300 ${feed ? 'line-clamp-2 text-xl' : 'line-clamp-2 text-lg'}`}>
                  {event.name}
                </h3>
                <span
                  className={`-mt-0.5 shrink-0 rotate-[-6deg] rounded-md border-2 border-dashed px-1.5 py-0.5 text-center leading-tight transition-transform duration-300 group-hover:rotate-[-2deg] group-hover:scale-105 motion-reduce:transition-none ${
                    price.free ? 'border-emerald-500 text-emerald-700 dark:text-emerald-300' : 'border-brand-600 text-brand-800 dark:border-brand-400 dark:text-brand-200'
                  }`}
                >
                  <span className="block text-[8px] font-bold uppercase tracking-[0.2em] opacity-80">{t('admitOne')}</span>
                  <span className="block text-[11px] font-black uppercase tracking-wider">
                    {price.free ? t('free') : t('from', { price: formatCost(price.from) })}
                  </span>
                </span>
              </div>
              <span className="flex min-w-0 items-center gap-1 text-sm text-slate-600 dark:text-slate-300">
                <MapPinIcon aria-hidden className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="truncate">{locationLabel}</span>
              </span>
              <span className="flex min-w-0 items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                <ClockIcon aria-hidden className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="truncate">{eventTimeLabel(event.startDate, event.endDate, locale)}</span>
              </span>
              {(event.goingCount > 0 || (feed && event.interestedCount > 0)) && (
                <span className="flex items-center gap-2 pt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                  {event.goingCount > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${accent.bg}`} />
                      {t('going', { count: event.goingCount })}
                    </span>
                  )}
                  {feed && event.interestedCount > 0 && <span>{t('interested', { count: event.interestedCount })}</span>}
                </span>
              )}
            </div>
          </Link>

          <div className="mt-auto px-4 pb-4 pt-1">
            <div className="grid grid-cols-2 gap-1 border-t border-slate-100 pt-2 dark:border-slate-800">
              <EventRsvpButtons
                eventId={event.id}
                initialStatus={null}
                initialInterestedCount={event.interestedCount}
                initialGoingCount={event.goingCount}
                variant="feed"
              />
              <ShareMenu placeName={event.name} shareUrl={shareUrl} contentType="event" variant="feed" />
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
