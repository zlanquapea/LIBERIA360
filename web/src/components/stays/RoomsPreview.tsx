import Link from 'next/link';
import { ArrowRightIcon, BoltIcon } from '@heroicons/react/24/outline';
import { SafeImage } from '@/components/SafeImage';
import { formatMoney } from '@/lib/currency';
import { resolveImageUrl, resolveThumbUrl } from '@/lib/images';
import type { PublicStay } from '@/lib/stays-api';
import { clockTime } from '@/lib/stays';

/** The rooms on a hotel's page, each leading straight into booking. */
export function RoomsPreview({ stay, bookHref }: { stay: PublicStay; bookHref: string }) {
  const from = Math.min(...stay.roomTypes.map((r) => r.pricePerNight));
  return (
    <section
      id="rooms"
      aria-labelledby="rooms-title"
      className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">Stay here</p>
          <h2 id="rooms-title" className="font-display text-2xl font-bold text-slate-950 dark:text-slate-50">
            Rooms from {formatMoney(from, stay.currency)}
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-slate-500 dark:text-slate-400">
            <span>
              Check-in {clockTime(stay.checkInTime)} · check-out {clockTime(stay.checkOutTime)}
            </span>
            {stay.instantConfirm && (
              <span className="flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300">
                <BoltIcon aria-hidden className="h-4 w-4" /> Instant confirmation
              </span>
            )}
          </p>
        </div>
        <Link href={bookHref} className="btn-primary min-h-11 gap-1.5 px-5">
          See availability <ArrowRightIcon aria-hidden className="h-4 w-4" />
        </Link>
      </div>
      <ul className="-mx-5 flex snap-x gap-4 overflow-x-auto px-5 pb-1 sm:-mx-7 sm:px-7">
        {stay.roomTypes.map((room) => (
          <li key={room.id} className="w-64 shrink-0 snap-start sm:w-72">
            <Link
              href={bookHref}
              className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 transition hover:border-brand-300 hover:shadow-md dark:border-slate-800"
            >
              <SafeImage
                src={room.images[0] ? resolveImageUrl(room.images[0]) : null}
                thumbSrc={room.images[0] ? resolveThumbUrl(room.images[0]) : null}
                alt=""
                className="aspect-[4/3] w-full object-cover"
                fallback={
                  <div aria-hidden className="flex aspect-[4/3] w-full items-center justify-center bg-gradient-to-br from-brand-100 to-sky-100 text-4xl dark:from-brand-950 dark:to-slate-800">
                    🛏️
                  </div>
                }
              />
              <span className="flex flex-1 flex-col gap-1 p-4">
                <span className="font-display font-bold text-slate-950 dark:text-slate-50">{room.name}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {[room.bedSummary, `Sleeps ${room.maxGuests}`].filter(Boolean).join(' · ')}
                </span>
                <span className="mt-auto pt-2 font-bold text-slate-950 dark:text-slate-50">
                  {formatMoney(room.pricePerNight, stay.currency)}
                  <span className="text-sm font-normal text-slate-500"> / night</span>
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
