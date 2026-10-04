'use client';

import { useRef, type ReactNode } from 'react';
import { CheckBadgeIcon, PrinterIcon } from '@heroicons/react/24/solid';
import type { EPrescription } from '@/lib/clinic-api';
import { rxStatusLabel, rxStatusStyle } from '@/lib/prescriptions';

const day = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export function RxStatusPill({ rx }: { rx: Pick<EPrescription, 'status' | 'expired'> }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-bold ${rxStatusStyle(rx)}`}>
      {rxStatusLabel(rx)}
    </span>
  );
}

/** Opens the print dialog for just this prescription. */
export function usePrintRx() {
  const ref = useRef<HTMLElement>(null);
  function print() {
    const sheet = ref.current;
    if (!sheet) return;
    sheet.classList.add('rx-printing');
    document.body.classList.add('print-rx');
    const done = () => {
      sheet.classList.remove('rx-printing');
      document.body.classList.remove('print-rx');
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    window.print();
  }
  return { ref, print };
}

/**
 * The prescription as a sheet of paper: who wrote it, for whom, what to
 * take, and the QR/code a pharmacy checks. `children` go below (actions).
 */
export function EPrescriptionCard({
  rx,
  children,
  showQr = true,
  printable = false,
}: {
  rx: EPrescription;
  children?: ReactNode;
  showQr?: boolean;
  printable?: boolean;
}) {
  const { ref, print } = usePrintRx();
  return (
    <article
      ref={ref}
      className="rx-sheet overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-dashed border-slate-200 bg-brand-950 px-5 py-4 text-white dark:border-slate-700">
        <div className="min-w-0">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-gold-300">
            E-prescription · {rx.code}
          </p>
          <h3 className="mt-1 break-words text-lg font-bold leading-snug">
            {rx.clinic?.name ?? 'Clinic'}
          </h3>
          {rx.clinic?.address && <p className="text-sm text-brand-100/80">{rx.clinic.address}</p>}
        </div>
        <span aria-hidden className="font-serif text-4xl font-black italic leading-none text-gold-300">
          ℞
        </span>
      </header>

      <div className="grid gap-5 p-5 sm:grid-cols-[1fr_auto]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <RxStatusPill rx={rx} />
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Issued {day(rx.issuedAt)} · valid until {day(rx.expiresAt)}
            </span>
          </div>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm min-[420px]:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Doctor</dt>
              <dd className="flex flex-wrap items-center gap-1 font-semibold text-slate-900 dark:text-slate-50">
                Dr {rx.doctor?.fullName}
                {rx.doctor?.verified && (
                  <CheckBadgeIcon aria-label="Licence verified" className="h-4 w-4 text-brand-600" />
                )}
              </dd>
              <dd className="text-xs text-slate-500 dark:text-slate-400">
                {rx.doctor?.specialty} · Licence {rx.doctor?.licenceNumber}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Patient</dt>
              <dd className="break-words font-semibold text-slate-900 dark:text-slate-50">
                {rx.patientName}
                {rx.patientAge != null && (
                  <span className="font-normal text-slate-500"> · {rx.patientAge} yrs</span>
                )}
              </dd>
              {rx.patientPhone && (
                <dd className="text-xs text-slate-500 dark:text-slate-400">{rx.patientPhone}</dd>
              )}
            </div>
          </dl>

          {rx.full ? (
            <ol className="divide-y divide-slate-100 rounded-2xl border border-slate-100 dark:divide-slate-800 dark:border-slate-800">
              {rx.items.map((item, i) => (
                <li key={item.id} className="flex gap-3 px-4 py-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-800 dark:bg-brand-950/50 dark:text-brand-200">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-baseline justify-between gap-x-3 font-semibold text-slate-900 dark:text-slate-50">
                      <span className="break-words">
                        {item.medicine}
                        {item.strength && !item.medicine.toLowerCase().includes(item.strength.toLowerCase()) && (
                          <span className="font-normal text-slate-500"> {item.strength}</span>
                        )}
                      </span>
                      <span className="shrink-0 text-sm tabular-nums text-slate-600 dark:text-slate-300">
                        Qty {item.quantity}
                      </span>
                    </p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      {item.dosage}
                      {item.durationDays ? ` for ${item.durationDays} day${item.durationDays === 1 ? '' : 's'}` : ''}
                    </p>
                    {item.instructions && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">{item.instructions}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
              {rx.itemCount} medicine{rx.itemCount === 1 ? '' : 's'} prescribed. Only the patient and
              pharmacy staff can see what they are.
            </p>
          )}

          {rx.full && rx.notesForPharmacist && (
            <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <span className="font-semibold">Note for the pharmacist:</span> {rx.notesForPharmacist}
            </p>
          )}
          {rx.status === 'cancelled' && rx.cancelledReason && (
            <p className="text-sm text-red-700 dark:text-red-300">Cancelled: {rx.cancelledReason}</p>
          )}
        </div>

        {showQr && rx.qrDataUrl && (
          <figure className="flex flex-col items-center gap-2 sm:w-44">
            {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL from the API */}
            <img
              src={rx.qrDataUrl}
              alt={`QR code for prescription ${rx.code}`}
              className="h-44 w-44 rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-700"
            />
            <figcaption className="text-center text-xs text-slate-500 dark:text-slate-400">
              Show at any pharmacy, or read out
              <span className="mt-0.5 block font-mono text-base font-bold tracking-widest text-slate-900 dark:text-slate-50">
                {rx.code}
              </span>
            </figcaption>
          </figure>
        )}
      </div>

      {(children || printable) && (
        <footer className="rx-no-print flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-4 dark:border-slate-800">
          {children}
          {printable && (
            <button type="button" onClick={print} className="btn-secondary min-h-10 gap-1.5">
              <PrinterIcon aria-hidden className="h-4 w-4" /> Print
            </button>
          )}
        </footer>
      )}
    </article>
  );
}
