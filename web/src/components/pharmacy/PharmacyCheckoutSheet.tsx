'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BanknotesIcon,
  DocumentArrowUpIcon,
  MinusIcon,
  PlusIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  TrashIcon,
  TruckIcon,
} from '@heroicons/react/24/outline';
import { MenuSheet } from '@/components/menu/MenuSheet';
import { ChoiceCard, CopyButton } from '@/components/menu/CartSheet';
import {
  createPharmacyOrder,
  deleteUnattachedPrescription,
  uploadPrescription,
  type Pharmacy,
  type PharmacyOrder,
  type PharmacyPaymentMethod,
  type PharmacyProduct,
} from '@/lib/pharmacy-api';
import {
  MAX_PER_PRODUCT,
  PAYMENT_LABELS,
  acceptedPaymentMethods,
  cartTotals,
  checkoutProblem,
  merchantNumber,
  money,
  stockOf,
  type PharmacyCart,
} from '@/lib/pharmacy-ordering';

const inputClass =
  'w-full rounded-2xl border border-slate-300 bg-white p-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-800 dark:focus:ring-emerald-900/40';

const METHOD_DOT: Record<PharmacyPaymentMethod, string | null> = {
  cash: null,
  mtn_momo: 'bg-yellow-400',
  orange_money: 'bg-orange-500',
};

/**
 * The pharmacy cart and checkout in one bottom sheet, like the restaurant
 * flow: review the medicines, then choose pickup or delivery, how to pay,
 * and — for prescription medicines — upload the prescription for the
 * pharmacist. Mobile money on an ordinary order is paid now (send to the
 * pharmacy's number, enter the transaction ID); on a prescription order it
 * is paid after the pharmacist approves, so nobody pays for medicine they
 * may not be allowed to receive.
 */
export function PharmacyCheckoutSheet({
  open,
  onClose,
  pharmacy,
  products,
  cart,
  onQuantityChange,
  signedIn,
  loginHref,
  onPlaced,
}: {
  open: boolean;
  onClose: () => void;
  pharmacy: Pharmacy;
  products: PharmacyProduct[];
  cart: PharmacyCart;
  onQuantityChange: (productId: string, quantity: number) => void;
  signedIn: boolean;
  loginHref: string;
  onPlaced: (order: PharmacyOrder) => void;
}) {
  const methods = acceptedPaymentMethods(pharmacy);
  const [step, setStep] = useState<'cart' | 'checkout'>('cart');
  const [fulfillment, setFulfillment] = useState<'pickup' | 'delivery'>(pharmacy.pickupEnabled ? 'pickup' : 'delivery');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PharmacyPaymentMethod>(methods[0] ?? 'cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [prescriptionFile, setPrescriptionFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The id of a prescription already uploaded for this exact file, reused
  // on a retry (e.g. the order failed for a stock reason) instead of
  // uploading another copy. A replaced or no-longer-needed upload is
  // deleted so no private medical file is left orphaned.
  const uploaded = useRef<{ file: File; id: string } | null>(null);

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  const lines = products.filter((p) => (cart[p.id] ?? 0) > 0);
  const totals = cartTotals(cart, products, fulfillment, pharmacy.deliveryFee);
  const account = merchantNumber(pharmacy, paymentMethod);
  const mobile = paymentMethod !== 'cash';
  const canOrder = (pharmacy.pickupEnabled || pharmacy.deliveryEnabled) && methods.length > 0;

  function choosePrescription(file: File | null) {
    const cached = uploaded.current;
    if (cached && cached.file !== file) {
      uploaded.current = null;
      deleteUnattachedPrescription(cached.id).catch(() => undefined);
    }
    setPrescriptionFile(file);
  }

  async function placeOrder() {
    const problem = checkoutProblem({
      fulfillment,
      address,
      phone,
      paymentMethod,
      paymentReference,
      needsPrescription: totals.needsPrescription,
      prescriptionFile,
      consent,
    });
    if (problem) {
      setError(problem);
      return;
    }
    setPlacing(true);
    setError(null);
    try {
      const cached = uploaded.current;
      if (!totals.needsPrescription && cached) {
        uploaded.current = null;
        deleteUnattachedPrescription(cached.id).catch(() => undefined);
      }
      const prescriptionId = !totals.needsPrescription
        ? undefined
        : cached && cached.file === prescriptionFile
          ? cached.id
          : await uploadPrescription(pharmacy.id, prescriptionFile!).then((id) => {
              uploaded.current = { file: prescriptionFile!, id };
              return id;
            });
      const order = await createPharmacyOrder({
        pharmacyId: pharmacy.id,
        fulfillmentMethod: fulfillment,
        deliveryAddress: fulfillment === 'delivery' ? address.trim() : undefined,
        contactPhone: phone.trim() || undefined,
        note: note.trim() || undefined,
        items: lines.map((p) => ({ productId: p.id, quantity: cart[p.id] })),
        prescriptionId,
        consentToPrescriptionProcessing: totals.needsPrescription ? consent : undefined,
        paymentMethod,
        paymentReference: mobile && !totals.needsPrescription ? paymentReference.trim() : undefined,
      });
      uploaded.current = null;
      setPrescriptionFile(null);
      setConsent(false);
      setPaymentReference('');
      setStep('cart');
      onPlaced(order);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not place the order. Try again.');
    } finally {
      setPlacing(false);
    }
  }

  const footer =
    lines.length === 0 ? null : step === 'cart' ? (
      signedIn ? (
        <button
          type="button"
          onClick={() => setStep('checkout')}
          disabled={!canOrder}
          className="flex min-h-14 w-full items-center justify-between rounded-full bg-emerald-700 px-6 text-base font-bold text-white shadow-lg transition hover:bg-emerald-800 disabled:opacity-50"
        >
          <span>Checkout</span>
          <span className="flex items-center gap-2">
            {money(totals.subtotal)}
            <ArrowRightIcon aria-hidden className="h-5 w-5 rtl:-scale-x-100" />
          </span>
        </button>
      ) : (
        <Link
          href={loginHref}
          className="flex min-h-14 w-full items-center justify-center rounded-full bg-emerald-700 px-6 text-base font-bold text-white shadow-lg hover:bg-emerald-800"
        >
          Log in to order
        </Link>
      )
    ) : (
      <div className="flex flex-col gap-2">
        {error && (
          <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={placeOrder}
          disabled={placing}
          className="flex min-h-14 w-full items-center justify-between rounded-full bg-emerald-700 px-6 text-base font-bold text-white shadow-lg transition hover:bg-emerald-800 disabled:opacity-60"
        >
          <span>{placing ? 'Placing order…' : 'Place order'}</span>
          <span>{money(totals.total)}</span>
        </button>
      </div>
    );

  return (
    <MenuSheet open={open} onClose={onClose} label={step === 'cart' ? 'Your cart' : 'Checkout'} footer={footer}>
      {step === 'cart' ? (
        <div className="flex flex-col gap-4 px-5 pb-5 pt-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
              <ShoppingBagIcon aria-hidden className="h-6 w-6" />
            </span>
            <div>
              <h2 className="font-display text-xl font-bold text-slate-950 dark:text-slate-50">Your cart</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">{pharmacy.name}</p>
            </div>
          </div>
          {lines.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">Your cart is empty.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
              {lines.map((p) => {
                const q = cart[p.id];
                const max = Math.min(stockOf(p), MAX_PER_PRODUCT);
                return (
                  <li key={p.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 [overflow-wrap:anywhere] dark:text-slate-50">{p.name}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {money(Number(p.price) * q)}
                        {p.prescriptionRequired && <span className="ms-2 text-xs font-semibold text-amber-700 dark:text-amber-300">Prescription</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => onQuantityChange(p.id, q - 1)}
                        aria-label={q === 1 ? `Remove all ${p.name} from cart` : `Remove one ${p.name}`}
                        className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        {q === 1 ? <TrashIcon aria-hidden className="h-4 w-4" /> : <MinusIcon aria-hidden className="h-4 w-4" />}
                      </button>
                      <span className="min-w-6 text-center text-sm font-bold tabular-nums">{q}</span>
                      <button
                        type="button"
                        onClick={() => onQuantityChange(p.id, q + 1)}
                        disabled={q >= max}
                        aria-label={`Add one more ${p.name}`}
                        className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800"
                      >
                        <PlusIcon aria-hidden className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {totals.needsPrescription && (
            <p className="flex gap-2 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <ShieldCheckIcon aria-hidden className="h-5 w-5 shrink-0" />
              Some items need a prescription. You&apos;ll upload it at checkout and a pharmacist checks it before anything is prepared.
            </p>
          )}
          {!canOrder && (
            <p className="rounded-2xl bg-slate-100 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              This pharmacy isn&apos;t taking orders online right now. Call {pharmacy.telephone}.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-5 px-5 pb-5 pt-6">
          <button
            type="button"
            onClick={() => setStep('cart')}
            className="flex w-fit items-center gap-1 text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
          >
            <ArrowLeftIcon aria-hidden className="h-4 w-4 rtl:-scale-x-100" />
            Back to cart
          </button>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 font-display text-lg font-bold text-slate-950 dark:text-slate-50">How do you want it?</legend>
            {pharmacy.pickupEnabled && (
              <ChoiceCard
                name="fulfillment"
                checked={fulfillment === 'pickup'}
                onSelect={() => setFulfillment('pickup')}
                icon={<ShoppingBagIcon className="h-5 w-5" />}
                title="Pick up"
                detail={`${pharmacy.address}, ${pharmacy.location}`}
              />
            )}
            {pharmacy.deliveryEnabled && (
              <ChoiceCard
                name="fulfillment"
                checked={fulfillment === 'delivery'}
                onSelect={() => setFulfillment('delivery')}
                icon={<TruckIcon className="h-5 w-5" />}
                title="Delivery"
                detail={Number(pharmacy.deliveryFee) > 0 ? `${money(pharmacy.deliveryFee)} delivery` : 'Free delivery'}
              />
            )}
          </fieldset>

          {fulfillment === 'delivery' && (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm font-semibold text-slate-800 dark:text-slate-200">
                Delivery address
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={2}
                  placeholder="e.g. Behind the blue church, 15th Street, Sinkor"
                  className={inputClass}
                />
                <span className="text-xs font-normal text-slate-500">A landmark helps the rider find you.</span>
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold text-slate-800 dark:text-slate-200">
                Phone for the rider
                <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="0886 000 000" className={inputClass} />
              </label>
            </div>
          )}

          {totals.needsPrescription && (
            <fieldset className="flex flex-col gap-3 rounded-3xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
              <legend className="px-1 font-display text-lg font-bold text-slate-950 dark:text-slate-50">Your prescription</legend>
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-amber-400 bg-white p-4 text-sm font-semibold text-amber-900 dark:bg-slate-900 dark:text-amber-200">
                <DocumentArrowUpIcon aria-hidden className="h-6 w-6 shrink-0" />
                <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                  {prescriptionFile ? prescriptionFile.name : 'Upload a photo or PDF of your prescription'}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="sr-only"
                  onChange={(e) => choosePrescription(e.target.files?.[0] ?? null)}
                />
              </label>
              <label className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-200">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-5 w-5 accent-emerald-700" />
                <span>I consent to {pharmacy.name}&apos;s pharmacist viewing my prescription to check this order.</span>
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Only this pharmacy&apos;s staff can see it. Uploading doesn&apos;t guarantee approval — the pharmacist may message you.
              </p>
            </fieldset>
          )}

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 font-display text-lg font-bold text-slate-950 dark:text-slate-50">How will you pay?</legend>
            {methods.map((m) => (
              <ChoiceCard
                key={m}
                name="payment"
                checked={paymentMethod === m}
                onSelect={() => setPaymentMethod(m)}
                icon={
                  METHOD_DOT[m] ? (
                    <span className={`block h-4 w-4 rounded-full ${METHOD_DOT[m]}`} />
                  ) : (
                    <BanknotesIcon className="h-5 w-5" />
                  )
                }
                title={PAYMENT_LABELS[m]}
                detail={m === 'cash' ? (fulfillment === 'delivery' ? 'Pay the rider' : 'Pay at the counter') : 'Mobile money'}
              />
            ))}
          </fieldset>

          {mobile && account && (
            totals.needsPrescription ? (
              <p className="rounded-2xl bg-sky-50 p-4 text-sm text-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
                You&apos;ll pay by {PAYMENT_LABELS[paymentMethod]} <strong>after the pharmacist approves your prescription</strong>. We&apos;ll notify you with the amount and number.
              </p>
            ) : (
              <div className="flex flex-col gap-3 rounded-3xl bg-slate-50 p-4 dark:bg-slate-800/60">
                <p className="text-sm text-slate-700 dark:text-slate-200">
                  1. Send <strong>{money(totals.total)}</strong> by {PAYMENT_LABELS[paymentMethod]} to
                </p>
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 dark:bg-slate-900">
                  <span className="font-mono text-lg font-bold tabular-nums">{account}</span>
                  <CopyButton value={account.replace(/\s/g, '')} label="number" />
                </div>
                {pharmacy.paymentNote && <p className="text-xs text-slate-500 dark:text-slate-400">{pharmacy.paymentNote}</p>}
                <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
                  2. Enter the transaction ID from your confirmation SMS
                  <input
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="e.g. MP240115.1234.A56789"
                    className={`${inputClass} font-mono`}
                  />
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400">The pharmacy confirms the payment before preparing your order.</p>
              </div>
            )
          )}

          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-800 dark:text-slate-200">
            Note for the pharmacy <span className="font-normal text-slate-500">(optional)</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} placeholder="e.g. I can take a generic" className={inputClass} />
          </label>

          <dl className="flex flex-col gap-1.5 rounded-3xl bg-slate-50 p-4 text-sm dark:bg-slate-800/60">
            <div className="flex justify-between"><dt>Medicines</dt><dd>{money(totals.subtotal)}</dd></div>
            {fulfillment === 'delivery' && <div className="flex justify-between"><dt>Delivery</dt><dd>{money(totals.delivery)}</dd></div>}
            <div className="flex justify-between border-t border-slate-200 pt-1.5 text-base font-bold dark:border-slate-700"><dt>Total</dt><dd>{money(totals.total)}</dd></div>
          </dl>
        </div>
      )}
    </MenuSheet>
  );
}
