"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeftIcon, TicketIcon } from "@heroicons/react/24/outline";
import { BrandLoader } from "@/components/BrandLoader";
import { EventTicketScanner } from "@/components/EventTicketScanner";
import { useAuth } from "@/hooks/useAuth";

export default function EventTicketScanPage() {
  const params = useParams<{ id: string }>();
  const { token, ready, user } = useAuth();

  if (!ready) {
    return (
      <main className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-4">
        <BrandLoader />
        <p className="text-sm font-medium tracking-wide text-slate-500 dark:text-slate-400">Loading scanner…</p>
      </main>
    );
  }

  if (!user || !token) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10 text-center">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Ticket scanner</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Log in as the event organizer to scan tickets.</p>
        <Link href="/login" className="mt-4 inline-flex min-h-11 items-center rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800">Log in</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-8">
      <div>
        <Link href={`/account/my-events/tickets/${params.id}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
          <ArrowLeftIcon className="h-4 w-4" aria-hidden /> Manage Event
        </Link>
        <div className="mt-4 flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-brand-800 dark:bg-brand-950/60 dark:text-brand-200"><TicketIcon className="h-6 w-6" aria-hidden /></span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">LIBERIA360 Organizer</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-50">Scan tickets</h1>
            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Use this dedicated entrance scanner to validate each event pass once.</p>
          </div>
        </div>
      </div>
      <EventTicketScanner eventId={params.id} token={token} />
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"><strong className="text-slate-900 dark:text-slate-100">Security reminder:</strong> A successful scan permanently marks that individual pass as used. Do not accept screenshots or copied QR codes that have already been redeemed.</div>
    </main>
  );
}
