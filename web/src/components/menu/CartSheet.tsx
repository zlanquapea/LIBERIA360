'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BanknotesIcon,
  CheckIcon,
  ClipboardDocumentIcon,
  MinusIcon,
  PlusIcon,
  ShoppingBagIcon,
  TrashIcon,
  TruckIcon,
} from '@heroicons/react/24/outline';
import { resolveThumbUrl } from '@/lib/images';
import { MENU_KIND_EMOJI } from '@/lib/menu';
import { MAX_LINE_QUANTITY, cartSummary, describeSelections, unitPriceFor, type CartLine } from '@/lib/menu-cart';
import { formatMoney } from '@/lib/currency';
import {
  PAYMENT_METHOD_LABELS,
  acceptedPaymentMethods,
  cashLabel,
  checkoutError,
  checkoutTotals,
  deliveryFeeShort,
  fulfillmentOptions,
  isMobileMoney,
  paymentAccountFor,
  type CheckoutState,
} from '@/lib/food-ordering';
import { SafeImage } from '@/components/SafeImage';
import type { FoodPaymentMethod, MenuItem, MenuSettings } from '@/lib/types';
import { MenuSheet } from './MenuSheet';
import { MenuPrice } from './MenuPrice';

const inputClass =
  'w-full rounded-2xl border border-slate-300 bg-white p-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:focus:ring-brand-900/40';

const METHOD_DOT: Record<FoodPaymentMethod, string | null> = {
  cash: null,
  mtn_momo: 'bg-yellow-400',
  orange_money: 'bg-orange-500',
};

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={`Copy ${label}`}
      onClick={() => {
        navigator.clipboard
          ?.writeText(value)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          })
          .catch(() => undefined);
      }}
      className="inline-flex h-8 items-center gap-1 rounded-full border border-slate-300 px-2.5 text-xs font-semibold text-slate-600 hover:border-brand-400 dark:border-slate-600 dark:text-slate-300"
    >
      {copied ? <CheckIcon aria-hidden className="h-4 w-4 text-emerald-600" /> : <ClipboardDocumentIcon aria-hidden className="h-4 w-4" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export function ChoiceCard({
  name,
  checked,
  onSelect,
  icon,
  title,
  detail,
}: {
  name: string;
  checked: boolean;
  onSelect: () => void;
  icon: ReactNode;
  title: string;
  detail?: string;
}) {
  return (
    <label
      className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition ${
        checked
          ? 'border-brand-600 bg-brand-50/60 dark:border-brand-400 dark:bg-brand-950/40'
          : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
      }`}
    >
      <input type="radio" name={name} checked={checked} onChange={onSelect} className="h-5 w-5 accent-brand-700" />
      <span aria-hidden className="text-brand-700 dark:text-brand-300">
        {icon}
      </span>
      <span className="flex-1">
        <span className="block text-sm font-semibold text-slate-900 dark:text-slate-50">{title}</span>
        {detail && <span className="block text-xs text-slate-500 dark:text-slate-400">{detail}</span>}
      </span>
    </label>
  );
}

// Two steps in one sheet: the cart, then checkout (delivery or pickup and
// how to pay). Mobile money follows the event-ticket flow: the customer
// sends the total to the restaurant's number and enters the transaction ID,
// which the restaurant checks before confirming.
export function CartSheet({
  open,
  onClose,
  businessName,
  lines,
  items,
  settings,
  rate,
  signedIn,
  loginHref,
  notes,
  onNotesChange,
  ageConfirmed,
  onAgeConfirmedChange,
  onQuantityChange,
  checkout,
  onCheckoutChange,
  onSubmit,
  submitting,
  error,
}: {
  open: boolean;
  onClose: () => void;
  businessName: string;
  lines: CartLine[];
  items: MenuItem[];
  settings: MenuSettings;
  rate: number | null;
  signedIn: boolean;
  // Returns here after login; the cart survives via localStorage.
  loginHref: string;
  notes: string;
  onNotesChange: (value: string) => void;
  ageConfirmed: boolean;
  onAgeConfirmedChange: (value: boolean) => void;
  onQuantityChange: (key: string, quantity: number) => void;
  checkout: CheckoutState;
  onCheckoutChange: (patch: Partial<CheckoutState>) => void;
  onSubmit: () => void;
  submitting: boolean;
  error: string | null;
}) {
  const [step, setStep] = useState<'cart' | 'checkout'>('cart');
  const [showErrors, setShowErrors] = useState(false);
  useEffect(() => {
    if (!open) {
      setStep('cart');
      setShowErrors(false);
    }
  }, [open]);

  const currency = settings.currency;
  const byId = new Map(items.map((i) => [i.id, i]));
  const { count, subtotal, hasAlcohol } = cartSummary(lines, items);
  const { deliveryFee, total } = checkoutTotals(settings, checkout.fulfillment, subtotal);
  const fulfillments = fulfillmentOptions(settings);
  const methods = acceptedPaymentMethods(settings);
  const mobile = isMobileMoney(checkout.paymentMethod);
  const account = paymentAccountFor(settings, checkout.paymentMethod);
  const problem = checkoutError(checkout) ?? (hasAlcohol && !ageConfirmed ? 'Confirm you’re 18 or older' : null);

  function place() {
    if (problem) {
      setShowErrors(true);
      return;
    }
    onSubmit();
  }

  let footer: ReactNode = null;
  if (count > 0 && !signedIn) {
    footer = (
      <Link
        href={loginHref}
        className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand-700 px-5 text-sm font-bold text-white hover:bg-brand-800"
      >
        Log in to place your order <ArrowRightIcon aria-hidden className="h-4 w-4" />
      </Link>
    );
  } else if (count > 0 && step === 'cart') {
    footer = (
      <button
        type="button"
        onClick={() => setStep('checkout')}
        className="flex min-h-12 items-center justify-between gap-2 rounded-full bg-brand-700 px-5 text-sm font-bold text-white shadow-lg shadow-brand-700/25 transition hover:bg-brand-800"
      >
        <span>Continue to checkout</span>
        <span>{formatMoney(subtotal, currency)}</span>
      </button>
    );
  } else if (count > 0) {
    footer = (
      <div className="flex flex-col gap-2">
        {(error || (showErrors && problem)) && (
          <p role="alert" className="text-center text-sm font-semibold text-flag-700 dark:text-flag-300">
            {error ?? problem}
          </p>
        )}
        <button
          type="button"
          disabled={submitting}
          onClick={place}
          className="flex min-h-12 items-center justify-between gap-2 rounded-full bg-brand-700 px-5 text-sm font-bold text-white shadow-lg shadow-brand-700/25 transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span>{submitting ? 'Sending order…' : mobile ? 'Submit payment & order' : 'Place order'}</span>
          <span>{formatMoney(total, currency)}</span>
        </button>
      </div>
    );
  }

  return (
    <MenuSheet open={open} onClose={onClose} label={step === 'cart' ? 'Your order' : 'Checkout'} footer={footer}>
      {step === 'cart' || count === 0 ? (
        <div className="flex flex-col gap-5 px-5 pb-5 pt-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">Your order</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-slate-50">{businessName}</h2>
          </div>

          {count === 0 ? (
            <p className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
              Your order is empty. Tap + on anything you&apos;d like.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
              {lines.map((line) => {
                const item = byId.get(line.menuItemId);
                if (!item) return null;
                const description = describeSelections(item, line.selections);
                return (
                  <li key={line.key} className="flex gap-3 py-3">
                    <SafeImage
                      src={item.image ? resolveThumbUrl(item.image) : null}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-xl object-cover"
                      fallback={
                        <div aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-2xl dark:bg-slate-800">
                          {MENU_KIND_EMOJI[item.kind]}
                        </div>
                      }
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold leading-snug text-slate-900 dark:text-slate-50">{item.name}</p>
                        <span className="shrink-0 text-sm font-bold text-slate-900 dark:text-slate-50">
                          {formatMoney(unitPriceFor(item, line.selections) * line.quantity, currency)}
                        </span>
                      </div>
                      {description && <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p>}
                      <div className="mt-1 flex items-center gap-1">
                        <button
                          type="button"
                          aria-label={line.quantity === 1 ? `Remove ${item.name}` : `Remove one ${item.name}`}
                          onClick={() => onQuantityChange(line.key, line.quantity - 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-slate-600 hover:border-brand-400 dark:border-slate-700 dark:text-slate-300"
                        >
                          {line.quantity === 1 ? <TrashIcon aria-hidden className="h-4 w-4" /> : <MinusIcon aria-hidden className="h-4 w-4" />}
                        </button>
                        <span className="w-7 text-center text-sm font-bold">{line.quantity}</span>
                        <button
                          type="button"
                          aria-label={`Add one ${item.name}`}
                          disabled={line.quantity >= MAX_LINE_QUANTITY}
                          onClick={() => onQuantityChange(line.key, line.quantity + 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-slate-600 hover:border-brand-400 disabled:opacity-30 dark:border-slate-700 dark:text-slate-300"
                        >
                          <PlusIcon aria-hidden className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {count > 0 && (
            <>
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                  Subtotal · {count} item{count === 1 ? '' : 's'}
                </span>
                <MenuPrice amount={subtotal} currency={currency} rate={rate} className="justify-end text-base font-bold text-slate-950 dark:text-slate-50" />
              </div>

              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  Note for {businessName} <span className="font-normal text-slate-400">optional</span>
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => onNotesChange(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="Allergies, spice level…"
                  className={inputClass}
                />
              </label>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-6 px-5 pb-5 pt-6">
          <div>
            <button
              type="button"
              onClick={() => setStep('cart')}
              className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
            >
              <ArrowLeftIcon aria-hidden className="h-4 w-4" /> Your order
            </button>
            <h2 className="mt-2 font-display text-2xl font-bold text-slate-950 dark:text-slate-50">Checkout</h2>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 font-display text-base font-bold text-slate-950 dark:text-slate-50">How do you want it?</legend>
            {fulfillments.map((f) => (
              <ChoiceCard
                key={f}
                name="fulfillment"
                checked={checkout.fulfillment === f}
                onSelect={() => onCheckoutChange({ fulfillment: f })}
                icon={f === 'delivery' ? <TruckIcon className="h-5 w-5" /> : <ShoppingBagIcon className="h-5 w-5" />}
                title={f === 'delivery' ? 'Delivery' : 'Pickup'}
                detail={
                  f === 'delivery'
                    ? [deliveryFeeShort(settings), settings.deliveryEstimate].filter(Boolean).join(' · ')
                    : `Collect from ${businessName}`
                }
              />
            ))}
            {checkout.fulfillment === 'delivery' && (
              <div className="mt-2 flex flex-col gap-3">
                {settings.deliveryAreas && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">Delivers to {settings.deliveryAreas}.</p>
                )}
                <label className="flex flex-col gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Delivery address
                  <textarea
                    value={checkout.deliveryAddress}
                    onChange={(e) => onCheckoutChange({ deliveryAddress: e.target.value })}
                    rows={2}
                    maxLength={300}
                    autoComplete="street-address"
                    placeholder="House or building, street, community, and a landmark"
                    className={`${inputClass} font-normal`}
                  />
                </label>
              </div>
            )}
            <label className="mt-2 flex flex-col gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <span>
                Phone number{' '}
                {checkout.fulfillment === 'pickup' && <span className="font-normal text-slate-400">optional</span>}
              </span>
              <input
                type="tel"
                value={checkout.contactPhone}
                onChange={(e) => onCheckoutChange({ contactPhone: e.target.value })}
                maxLength={30}
                autoComplete="tel"
                placeholder="e.g. 0777 123 456"
                className={`${inputClass} font-normal`}
              />
            </label>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 font-display text-base font-bold text-slate-950 dark:text-slate-50">How will you pay?</legend>
            {methods.map((m) => (
              <ChoiceCard
                key={m}
                name="payment"
                checked={checkout.paymentMethod === m}
                onSelect={() => onCheckoutChange({ paymentMethod: m })}
                icon={
                  METHOD_DOT[m] ? (
                    <span className={`block h-3.5 w-3.5 rounded-full ${METHOD_DOT[m]}`} />
                  ) : (
                    <BanknotesIcon className="h-5 w-5" />
                  )
                }
                title={m === 'cash' ? cashLabel(checkout.fulfillment) : PAYMENT_METHOD_LABELS[m]}
                detail={m === 'cash' ? 'Pay when you get your food' : 'Pay now, the restaurant confirms it'}
              />
            ))}

            {mobile && account && (
              <ol className="mt-2 flex flex-col gap-3 rounded-2xl border border-dashed border-brand-300 bg-brand-50/50 p-4 text-sm dark:border-brand-800 dark:bg-brand-950/30">
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white">1</span>
                  <div className="flex flex-1 flex-col gap-2">
                    <p className="text-slate-700 dark:text-slate-200">
                      Send <strong className="text-slate-950 dark:text-white">{formatMoney(total, currency)}</strong> by{' '}
                      {PAYMENT_METHOD_LABELS[checkout.paymentMethod]} to:
                    </p>
                    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white px-3 py-2 dark:bg-slate-900">
                      <span className="font-mono text-base font-bold tracking-wide text-slate-950 dark:text-white">{account}</span>
                      {settings.mobileMoneyName && (
                        <span className="text-xs text-slate-500 dark:text-slate-400">{settings.mobileMoneyName}</span>
                      )}
                      <span className="ms-auto">
                        <CopyButton value={account.replace(/\s+/g, '')} label="number" />
                      </span>
                    </div>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white">2</span>
                  <label className="flex flex-1 flex-col gap-1.5 text-slate-700 dark:text-slate-200">
                    Enter the transaction ID from your confirmation message
                    <input
                      value={checkout.paymentReference}
                      onChange={(e) => onCheckoutChange({ paymentReference: e.target.value })}
                      maxLength={100}
                      autoComplete="off"
                      placeholder="Transaction ID"
                      className={`${inputClass} font-mono`}
                    />
                  </label>
                </li>
                <li className="text-xs text-slate-500 dark:text-slate-400">
                  {businessName} checks the payment arrived before confirming your order.
                </li>
              </ol>
            )}
          </fieldset>

          {hasAlcohol && (
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-4 text-sm dark:border-slate-700">
              <input
                type="checkbox"
                checked={ageConfirmed}
                onChange={(e) => onAgeConfirmedChange(e.target.checked)}
                className="mt-0.5 h-5 w-5 rounded border-slate-300 text-brand-700 accent-brand-700 focus:ring-brand-500"
              />
              <span className="text-slate-700 dark:text-slate-200">
                <strong>I&apos;m 18 or older.</strong> This order includes alcohol, and the venue may ask for ID.
              </span>
            </label>
          )}

          <dl className="flex flex-col gap-1.5 rounded-2xl bg-slate-50 px-4 py-3 text-sm dark:bg-slate-800/60">
            <div className="flex justify-between text-slate-600 dark:text-slate-300">
              <dt>Subtotal · {count} item{count === 1 ? '' : 's'}</dt>
              <dd>{formatMoney(subtotal, currency)}</dd>
            </div>
            {checkout.fulfillment === 'delivery' && (
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <dt>Delivery</dt>
                <dd>{deliveryFee > 0 ? formatMoney(deliveryFee, currency) : 'Free'}</dd>
              </div>
            )}
            <div className="flex items-baseline justify-between border-t border-slate-200 pt-1.5 font-bold text-slate-950 dark:border-slate-700 dark:text-slate-50">
              <dt>Total</dt>
              <dd>
                <MenuPrice amount={total} currency={currency} rate={rate} className="justify-end" />
              </dd>
            </div>
          </dl>
        </div>
      )}
    </MenuSheet>
  );
}
