'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { BanknotesIcon, CheckCircleIcon, DevicePhoneMobileIcon, ShoppingBagIcon, TruckIcon } from '@heroicons/react/24/outline';
import { updateMenuSettings } from '@/lib/menu-items-api';
import { getFriendlyErrorMessage } from '@/lib/errors';
import type { MenuSettings, UpdateMenuSettingsInput } from '@/lib/types';

const CURRENCY_SYMBOL = { USD: 'US$', LRD: 'L$' } as const;

const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:focus:ring-brand-900/40';
const labelClass = 'flex flex-col gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200';

interface Draft {
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  deliveryFee: string;
  freeDeliveryMinimum: string;
  deliveryAreas: string;
  deliveryEstimate: string;
  cashEnabled: boolean;
  mtnMomoNumber: string;
  orangeMoneyNumber: string;
  mobileMoneyName: string;
}

function toDraft(s: MenuSettings): Draft {
  return {
    pickupEnabled: s.pickupEnabled,
    deliveryEnabled: s.deliveryEnabled,
    deliveryFee: s.deliveryFee ? String(s.deliveryFee) : '',
    freeDeliveryMinimum: s.freeDeliveryMinimum !== null ? String(s.freeDeliveryMinimum) : '',
    deliveryAreas: s.deliveryAreas ?? '',
    deliveryEstimate: s.deliveryEstimate ?? '',
    cashEnabled: s.cashEnabled,
    mtnMomoNumber: s.mtnMomoNumber ?? '',
    orangeMoneyNumber: s.orangeMoneyNumber ?? '',
    mobileMoneyName: s.mobileMoneyName ?? '',
  };
}

function money(value: string): number | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 100000 ? n : NaN;
}

/** First problem that would stop a save, or null. */
export function deliveryPaymentDraftError(d: Draft): string | null {
  if (!d.pickupEnabled && !d.deliveryEnabled) return 'Offer at least one of pickup or delivery';
  if (d.deliveryEnabled) {
    if (Number.isNaN(money(d.deliveryFee))) return 'Enter a valid delivery fee';
    if (Number.isNaN(money(d.freeDeliveryMinimum))) return 'Enter a valid free-delivery amount';
  }
  if (!d.cashEnabled && !d.mtnMomoNumber.trim() && !d.orangeMoneyNumber.trim()) {
    return 'Accept at least one payment method';
  }
  if ((d.mtnMomoNumber.trim() || d.orangeMoneyNumber.trim()) && !d.mobileMoneyName.trim()) {
    return 'Add the name on your mobile money account so customers know they’re paying you';
  }
  return null;
}

function toInput(d: Draft): UpdateMenuSettingsInput {
  return {
    pickupEnabled: d.pickupEnabled,
    deliveryEnabled: d.deliveryEnabled,
    deliveryFee: money(d.deliveryFee) ?? 0,
    freeDeliveryMinimum: money(d.freeDeliveryMinimum),
    deliveryAreas: d.deliveryAreas.trim(),
    deliveryEstimate: d.deliveryEstimate.trim(),
    cashEnabled: d.cashEnabled,
    mtnMomoNumber: d.mtnMomoNumber.trim(),
    orangeMoneyNumber: d.orangeMoneyNumber.trim(),
    mobileMoneyName: d.mobileMoneyName.trim(),
  };
}

function ToggleCard({
  icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
        checked
          ? 'border-brand-600 bg-brand-50/60 dark:border-brand-400 dark:bg-brand-950/40'
          : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 rounded border-slate-300 text-brand-700 accent-brand-700 focus:ring-brand-500"
      />
      <span className="flex flex-1 items-start gap-2.5">
        <span aria-hidden className="mt-0.5 text-brand-700 dark:text-brand-300">
          {icon}
        </span>
        <span>
          <span className="block font-semibold text-slate-900 dark:text-slate-50">{title}</span>
          <span className="block text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</span>
        </span>
      </span>
    </label>
  );
}

// Owner's "Delivery & payments" setup: how food reaches the customer, what
// delivery costs, and which payments they take. Mobile money works like
// event tickets: customers send money to these numbers and submit the
// transaction ID, which the owner checks before confirming the order.
export function DeliveryPaymentSettings({
  token,
  settings,
  onSaved,
}: {
  token: string;
  settings: MenuSettings;
  onSaved: (settings: MenuSettings) => void;
}) {
  const [draft, setDraft] = useState(() => toDraft(settings));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    setDraft(toDraft(settings));
  }, [settings]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setSavedAt(null);
  };
  const symbol = CURRENCY_SYMBOL[settings.currency];
  const hasMobileMoney = Boolean(draft.mtnMomoNumber.trim() || draft.orangeMoneyNumber.trim());

  async function save() {
    const problem = deliveryPaymentDraftError(draft);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await updateMenuSettings(token, settings.businessId, toInput(draft));
      onSaved(saved);
      setSavedAt(Date.now());
    } catch (err) {
      setError(getFriendlyErrorMessage(err, { context: { action: 'update-delivery-payment', businessId: settings.businessId } }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="flex flex-col gap-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div>
        <h2 className="font-display text-xl font-bold text-slate-950 dark:text-slate-50">Delivery &amp; payments</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Shown on your menu so customers know how they&apos;ll get their food and how to pay.
        </p>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
          Getting the food
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <ToggleCard
            icon={<TruckIcon className="h-5 w-5" />}
            title="Delivery"
            description="You bring the order to the customer."
            checked={draft.deliveryEnabled}
            onChange={(v) => set('deliveryEnabled', v)}
          />
          <ToggleCard
            icon={<ShoppingBagIcon className="h-5 w-5" />}
            title="Pickup"
            description="The customer collects from you."
            checked={draft.pickupEnabled}
            onChange={(v) => set('pickupEnabled', v)}
          />
        </div>

        {draft.deliveryEnabled && (
          <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60 sm:grid-cols-2">
            <label className={labelClass}>
              Delivery fee
              <span className="flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 focus-within:border-brand-500 dark:border-slate-700 dark:bg-slate-800">
                <span className="text-sm font-semibold text-slate-400">{symbol}</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={draft.deliveryFee}
                  onChange={(e) => set('deliveryFee', e.target.value)}
                  placeholder="0"
                  className="w-full bg-transparent py-2 text-sm font-normal outline-none"
                />
              </span>
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">Leave at 0 for free delivery.</span>
            </label>
            <label className={labelClass}>
              <span>
                Free delivery on orders over <span className="font-normal text-slate-400">optional</span>
              </span>
              <span className="flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 focus-within:border-brand-500 dark:border-slate-700 dark:bg-slate-800">
                <span className="text-sm font-semibold text-slate-400">{symbol}</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={draft.freeDeliveryMinimum}
                  onChange={(e) => set('freeDeliveryMinimum', e.target.value)}
                  className="w-full bg-transparent py-2 text-sm font-normal outline-none"
                />
              </span>
            </label>
            <label className={labelClass}>
              <span>
                Areas you deliver to <span className="font-normal text-slate-400">optional</span>
              </span>
              <input
                value={draft.deliveryAreas}
                onChange={(e) => set('deliveryAreas', e.target.value)}
                maxLength={300}
                placeholder="e.g. Sinkor, Congo Town, Paynesville"
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              <span>
                Usual delivery time <span className="font-normal text-slate-400">optional</span>
              </span>
              <input
                value={draft.deliveryEstimate}
                onChange={(e) => set('deliveryEstimate', e.target.value)}
                maxLength={40}
                placeholder="e.g. 30–45 min"
                className={inputClass}
              />
            </label>
          </div>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
          Getting paid
        </legend>
        <ToggleCard
          icon={<BanknotesIcon className="h-5 w-5" />}
          title="Cash on delivery or at pickup"
          description="The customer pays when they get their food."
          checked={draft.cashEnabled}
          onChange={(v) => set('cashEnabled', v)}
        />
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
          <p className="flex items-start gap-2.5 text-sm">
            <DevicePhoneMobileIcon aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-brand-700 dark:text-brand-300" />
            <span>
              <span className="block font-semibold text-slate-900 dark:text-slate-50">Mobile money</span>
              <span className="block text-xs leading-5 text-slate-500 dark:text-slate-400">
                Customers send the total to your number and enter the transaction ID. Check it arrived before you
                confirm the order. Leave a number blank to not offer that method.
              </span>
            </span>
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>
              <span className="flex items-center gap-2">
                <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-yellow-400" /> MTN MoMo number
              </span>
              <input
                type="tel"
                value={draft.mtnMomoNumber}
                onChange={(e) => set('mtnMomoNumber', e.target.value)}
                maxLength={30}
                placeholder="e.g. 0886 123 456"
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              <span className="flex items-center gap-2">
                <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-orange-500" /> Orange Money number
              </span>
              <input
                type="tel"
                value={draft.orangeMoneyNumber}
                onChange={(e) => set('orangeMoneyNumber', e.target.value)}
                maxLength={30}
                placeholder="e.g. 0777 123 456"
                className={inputClass}
              />
            </label>
          </div>
          {hasMobileMoney && (
            <label className={labelClass}>
              Name on the account
              <input
                value={draft.mobileMoneyName}
                onChange={(e) => set('mobileMoneyName', e.target.value)}
                maxLength={100}
                placeholder="As it appears when customers send money"
                className={inputClass}
              />
            </label>
          )}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-brand-700 px-5 text-sm font-bold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save delivery & payments'}
        </button>
        {savedAt && !error && (
          <span role="status" className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            <CheckCircleIcon aria-hidden className="h-5 w-5" /> Saved
          </span>
        )}
        {error && (
          <p role="alert" className="text-sm font-semibold text-flag-700 dark:text-flag-300">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
