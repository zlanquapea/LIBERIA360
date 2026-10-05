import type { EPrescription, EPrescriptionStatus } from './clinic-api';

export const RX_STATUS_LABELS: Record<EPrescriptionStatus, string> = {
  issued: 'Ready to fill',
  sent: 'Sent to pharmacy',
  preparing: 'Being prepared',
  ready: 'Ready to collect',
  ordered: 'Ordered in the app',
  dispensed: 'Dispensed',
  cancelled: 'Cancelled',
};

export const RX_STATUS_STYLES: Record<EPrescriptionStatus | 'expired', string> = {
  issued: 'bg-brand-50 text-brand-800 dark:bg-brand-950/40 dark:text-brand-200',
  sent: 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200',
  preparing: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
  ready: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
  ordered: 'bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-200',
  dispensed: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200',
  expired: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200',
};

export function rxStatusLabel(rx: Pick<EPrescription, 'status' | 'expired'>) {
  return rx.expired ? 'Expired' : RX_STATUS_LABELS[rx.status];
}

export function rxStatusStyle(rx: Pick<EPrescription, 'status' | 'expired'>) {
  return RX_STATUS_STYLES[rx.expired ? 'expired' : rx.status];
}

/** A prescription that can still be sent to, or ordered from, a pharmacy. */
export function canChoosePharmacy(rx: Pick<EPrescription, 'status' | 'expired'>) {
  return !rx.expired && (rx.status === 'issued' || rx.status === 'sent');
}

export type RxStep = { key: string; label: string; state: 'done' | 'current' | 'upcoming' };

/** Prescribed → at the pharmacy → ready → collected, for the counter path. */
export function rxSteps(rx: Pick<EPrescription, 'status' | 'pharmacy'>): RxStep[] {
  const order = ['issued', 'sent', 'preparing', 'ready', 'dispensed'];
  const at = rx.status === 'ordered' ? 2 : Math.max(0, order.indexOf(rx.status));
  const steps = [
    { key: 'issued', label: 'Prescribed' },
    { key: 'sent', label: 'Sent' },
    { key: 'preparing', label: rx.status === 'ordered' ? 'Ordered' : 'Preparing' },
    { key: 'ready', label: 'Ready' },
    { key: 'dispensed', label: 'Collected' },
  ];
  return steps.map((s, i) => ({
    ...s,
    state: rx.status === 'dispensed' || i < at ? 'done' : i === at ? 'current' : 'upcoming',
  }));
}

/** Common dosage phrases, in the words Liberian pharmacists write on the label. */
export const DOSAGE_PRESETS = [
  '1 tablet once a day',
  '1 tablet twice a day',
  '1 tablet 3 times a day',
  '2 tablets twice a day',
  '1 capsule 3 times a day',
  '5 ml 3 times a day',
  '10 ml twice a day',
];

/** Units a course needs: per-dose count × doses a day × days, when that can be read. */
export function suggestedQuantity(dosage: string, days: number | undefined) {
  if (!days) return null;
  const per = Number(/^(\d+)\s*(tablet|capsule|tab|cap)/i.exec(dosage.trim())?.[1]);
  if (!per) return null;
  const times = /once/i.test(dosage)
    ? 1
    : /twice/i.test(dosage)
      ? 2
      : Number(/(\d+)\s*times/i.exec(dosage)?.[1]) || null;
  return times ? per * times * days : null;
}
