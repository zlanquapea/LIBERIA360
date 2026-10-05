import type { OrderStep } from '@/components/orders/OrderStepper';
import type { Consultation, ConsultationOutcome, ConsultPaymentStatus } from './consultations-api';

/**
 * Danger signs that mean emergency care, not an online consultation. Same
 * keys as api/src/clinics/red-flags.ts, which refuses a booking with any.
 */
export const RED_FLAGS: Array<{ key: string; label: string }> = [
  { key: 'chest_pain', label: 'Chest pain or pressure' },
  { key: 'breathing', label: 'Struggling to breathe' },
  { key: 'bleeding', label: "Heavy bleeding that won't stop" },
  { key: 'unconscious', label: 'Fainted, very drowsy or confused' },
  { key: 'seizure', label: 'Fits or seizures' },
  { key: 'stroke', label: 'Face drooping, a weak arm or slurred speech' },
  { key: 'pregnancy', label: 'Pregnant with bleeding, severe belly pain or fits' },
  { key: 'baby_fever', label: 'A baby under 2 months with a fever' },
  { key: 'stiff_neck', label: "High fever with a stiff neck or a rash that doesn't fade" },
  { key: 'self_harm', label: 'Thoughts of harming yourself' },
  { key: 'injury', label: 'A serious injury, burn, snake bite or poisoning' },
];

export const CONSULT_STATUS_LABELS: Record<Consultation['status'], string> = {
  requested: 'Waiting for the doctor',
  active: 'In consultation',
  completed: 'Completed',
  declined: 'Declined',
  cancelled: 'Cancelled',
};

/** Same colours as order badges. */
export function consultStatusClass(status: Consultation['status']) {
  if (status === 'active') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
  if (status === 'requested') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
  if (status === 'declined') return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
  return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
}

export const CONSULT_PAYMENT_BADGES: Record<ConsultPaymentStatus, { label: string; style: string }> = {
  awaiting_verification: { label: 'Payment being verified', style: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' },
  paid: { label: 'Paid', style: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' },
  failed: { label: 'Payment not found', style: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200' },
  refund_due: { label: 'Refund due', style: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200' },
  refunded: { label: 'Refunded', style: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200' },
};

export const OUTCOME_LABELS: Record<ConsultationOutcome, string> = {
  advice: 'Advice given',
  prescription: 'Prescription sent',
  visit_clinic: 'Visit the clinic in person',
  emergency: 'Go to emergency care now',
};

export const CONSULT_PAYMENT_LABELS = { mtn_momo: 'MTN MoMo', orange_money: 'Orange Money' } as const;

/** Requested → Paid → In consultation → Completed, on the shared stepper. */
export function consultSteps(c: Pick<Consultation, 'status' | 'paymentStatus'>): OrderStep[] {
  const reached =
    c.status === 'completed' ? 3 : c.status === 'active' ? 2 : c.paymentStatus === 'paid' ? 1 : 0;
  const labels = ['Requested', 'Paid', 'Consulting', 'Completed'];
  return labels.map((label, i) => ({
    key: label.toLowerCase(),
    label,
    state: c.status === 'completed' || i < reached ? 'done' : i === reached ? 'current' : 'upcoming',
  }));
}

/** Seconds as m:ss for voice notes. */
export function clock(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
