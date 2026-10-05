'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRightIcon,
  BanknotesIcon,
  BoltIcon,
  ExclamationTriangleIcon,
  IdentificationIcon,
  MapPinIcon,
  TruckIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { MenuSheet } from '@/components/menu/MenuSheet';
import { ChoiceCard, CopyButton } from '@/components/menu/CartSheet';
import { getCarListingAvailability } from '@/lib/car-rentals-api';
import { formatMoney } from '@/lib/currency';
import { getRentalTerms, bookRental, type RentalPaymentMethod, type RentalTerms, type RentalUnit } from '@/lib/rentals-api';
import { RENTAL_PAYMENT_LABELS, rentalDays, rentalHours, when } from '@/lib/rentals';
import { addDays, todayInLiberia } from '@/lib/stays';
import type { CarListing, CarListingAvailability } from '@/lib/types';

const METHOD_ICON: Record<RentalPaymentMethod, React.ReactNode> = {
  cash_at_pickup: <BanknotesIcon className="h-5 w-5" />,
  mtn_momo: <span className="block h-4 w-4 rounded-full bg-yellow-400" />,
  orange_money: <span className="block h-4 w-4 rounded-full bg-orange-500" />,
};

const usd = (n: number) => formatMoney(n, 'USD');

function Toggle({
  checked,
  onChange,
  title,
  detail,
  icon,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <label
      className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition ${
        checked ? 'border-brand-600 bg-brand-50/60 dark:border-brand-400 dark:bg-brand-950/40' : 'border-slate-200 dark:border-slate-700'
      }`}
    >
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-brand-700" />
      <span aria-hidden className="text-brand-700 dark:text-brand-300">
        {icon}
      </span>
      <span className="flex-1">
        <span className="block text-sm font-semibold text-slate-900 dark:text-slate-50">{title}</span>
        <span className="block text-xs text-slate-500 dark:text-slate-400">{detail}</span>
      </span>
    </label>
  );
}

/**
 * Choose when, how and how to pay, then send it: the restaurant checkout,
 * for a car. Prices add up live, line by line, and the days the car is
 * already taken are shown before anyone gets their hopes up.
 */
export function RentCar({
  listing,
  initialPickupDate,
  initialReturnDate,
}: {
  listing: CarListing;
  initialPickupDate?: string;
  initialReturnDate?: string;
}) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const today = todayInLiberia();
  const hourlyOffered = listing.pricePerHour != null;
  const [unit, setUnit] = useState<RentalUnit>('day');
  const [pickupDate, setPickupDate] = useState(
    initialPickupDate && initialPickupDate >= today ? initialPickupDate : addDays(today, 1),
  );
  const [returnDate, setReturnDate] = useState(() => {
    const start = initialPickupDate && initialPickupDate >= today ? initialPickupDate : addDays(today, 1);
    return initialReturnDate && initialReturnDate > start ? initialReturnDate : addDays(start, Math.max(1, listing.minRentalDays));
  });
  const [pickupTime, setPickupTime] = useState('09:00');
  const [returnTime, setReturnTime] = useState(hourlyOffered ? '17:00' : '09:00');
  const [withDriver, setWithDriver] = useState(false);
  const [additionalDriver, setAdditionalDriver] = useState(false);
  const [delivery, setDelivery] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [terms, setTerms] = useState<RentalTerms | null>(null);
  const [availability, setAvailability] = useState<CarListingAvailability | null>(null);
  const [open, setOpen] = useState(false);

  const [renterName, setRenterName] = useState('');
  const [renterPhone, setRenterPhone] = useState('');
  const [licence, setLicence] = useState('');
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [notes, setNotes] = useState('');
  const [method, setMethod] = useState<RentalPaymentMethod>('cash_at_pickup');
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getRentalTerms(listing.id)
      .then((t) => {
        setTerms(t);
        setMethod(t.paymentOptions[0]?.method ?? 'cash_at_pickup');
      })
      .catch(() => setTerms(null));
    getCarListingAvailability(listing.id)
      .then(setAvailability)
      .catch(() => setAvailability(null));
  }, [listing.id]);

  useEffect(() => {
    if (!user) return;
    setRenterName((v) => v || user.name || '');
    setRenterPhone((v) => v || (user as { phone?: string | null }).phone || '');
  }, [user]);

  const hourly = unit === 'hour';
  const effectiveReturn = hourly ? pickupDate : returnDate;
  const units = hourly ? rentalHours(pickupTime, returnTime) : rentalDays(pickupDate, returnDate);
  const unitPrice = hourly ? (listing.pricePerHour ?? 0) : listing.pricePerDay;
  const driverRate = hourly ? listing.driverFeePerHour : listing.driverFeePerDay;
  const lines = useMemo(() => {
    const out: Array<{ label: string; amount: number }> = [
      { label: `${usd(unitPrice)} × ${units} ${hourly ? 'hour' : 'day'}${units === 1 ? '' : 's'}`, amount: unitPrice * units },
    ];
    if (withDriver && listing.withDriverAvailable) out.push({ label: 'Driver', amount: (driverRate ?? 0) * units });
    if (additionalDriver && listing.additionalDriverAllowed)
      out.push({ label: 'Second driver', amount: listing.additionalDriverFee ?? 0 });
    if (delivery && listing.deliveryAvailable) out.push({ label: 'Delivery', amount: listing.deliveryFee ?? 0 });
    return out;
  }, [unitPrice, units, hourly, withDriver, driverRate, additionalDriver, delivery, listing]);
  const total = Math.round(lines.reduce((n, l) => n + l.amount, 0) * 100) / 100;

  const problem = (() => {
    if (pickupDate < today) return 'Pickup can’t be in the past.';
    if (hourly) {
      if (units <= 0) return 'Return time must be after pickup time.';
      if (units < (listing.minRentalHours ?? 1)) return `This car is rented for at least ${listing.minRentalHours} hours.`;
    } else {
      if (returnDate < pickupDate) return 'Return can’t be before pickup.';
      if (units < listing.minRentalDays) return `This car is rented for at least ${listing.minRentalDays} days.`;
      if (units > 60) return 'Rent up to 60 days at a time.';
    }
    return null;
  })();

  const clash = useMemo(
    () =>
      availability?.unavailable.find((u) => u.startDate <= effectiveReturn && u.endDate >= pickupDate) ?? null,
    [availability, pickupDate, effectiveReturn],
  );

  const option = terms?.paymentOptions.find((o) => o.method === method);
  const mobile = method !== 'cash_at_pickup';
  const needsLicence = !(withDriver && listing.withDriverAvailable);
  const returnTo = `/car-rentals/${listing.id}/book?pickupDate=${pickupDate}&returnDate=${effectiveReturn}`;

  async function submit() {
    if (renterName.trim().length < 2) return setError('Add the name of the person renting.');
    if (renterPhone.replace(/\D/g, '').length < 6) return setError('Add a phone number the owner can call.');
    if (needsLicence && licence.trim().length < 3) return setError('Add your driver’s licence number.');
    if (needsLicence && listing.minDriverAge && !ageConfirmed) return setError(`Confirm you’re at least ${listing.minDriverAge}.`);
    if (delivery && listing.deliveryAvailable && deliveryAddress.trim().length < 4) return setError('Where should the car be delivered?');
    if (mobile && reference.trim().length < 4) return setError('Enter the transaction ID from your mobile money SMS.');
    setSubmitting(true);
    setError('');
    try {
      const r = await bookRental({
        carListingId: listing.id,
        rentalUnit: unit,
        pickupDate,
        returnDate: hourly ? undefined : returnDate,
        pickupTime,
        returnTime,
        withDriver: withDriver && listing.withDriverAvailable,
        additionalDriver: additionalDriver && listing.additionalDriverAllowed,
        delivery: delivery && listing.deliveryAvailable,
        deliveryAddress: delivery ? deliveryAddress.trim() : undefined,
        renterName: renterName.trim(),
        renterPhone: renterPhone.trim(),
        licenceNumber: needsLicence ? licence.trim() : undefined,
        ageConfirmed: needsLicence ? ageConfirmed : undefined,
        notes: notes.trim() || undefined,
        paymentMethod: method,
        paymentReference: mobile ? reference.trim() : undefined,
      });
      router.push(`/account/rentals/${r.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not book the car.');
      setSubmitting(false);
    }
  }

  let footer: React.ReactNode;
  if (ready && !user) {
    footer = (
      <Link
        href={`/login?next=${encodeURIComponent(returnTo)}`}
        className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand-700 px-5 text-sm font-bold text-white hover:bg-brand-800"
      >
        Log in to book <ArrowRightIcon aria-hidden className="h-4 w-4" />
      </Link>
    );
  } else {
    footer = (
      <div className="flex flex-col gap-2">
        {error && (
          <p role="alert" className="text-center text-sm font-semibold text-flag-700 dark:text-flag-300">
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={submitting}
          onClick={() => void submit()}
          className="flex min-h-12 items-center justify-between gap-2 rounded-full bg-brand-700 px-5 text-sm font-bold text-white shadow-lg shadow-brand-700/25 transition hover:bg-brand-800 disabled:opacity-50"
        >
          <span>
            {submitting ? 'Booking…' : mobile ? 'Submit payment & book' : terms?.instantBook ? 'Book now' : 'Request to book'}
          </span>
          <span>{usd(total)}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {hourlyOffered && (
        <div role="tablist" aria-label="Rent by" className="flex gap-1 self-start rounded-full bg-slate-100 p-1 dark:bg-slate-800">
          {(
            [
              ['day', `By the day · ${usd(listing.pricePerDay)}`],
              ['hour', `By the hour · ${usd(listing.pricePerHour!)}`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={unit === id}
              onClick={() => setUnit(id)}
              className={`min-h-10 rounded-full px-4 text-sm font-semibold transition ${
                unit === id ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-50' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <section aria-label="When" className="grid grid-cols-2 gap-3 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          {hourly ? 'Date' : 'Pickup date'}
          <input
            type="date"
            min={today}
            value={pickupDate}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              setPickupDate(v);
              if (returnDate < v) setReturnDate(addDays(v, Math.max(1, listing.minRentalDays)));
            }}
            className="input mt-1 w-full"
          />
        </label>
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          Pickup time
          <input type="time" value={pickupTime} onChange={(e) => e.target.value && setPickupTime(e.target.value)} className="input mt-1 w-full" />
        </label>
        {!hourly && (
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Return date
            <input
              type="date"
              min={pickupDate}
              value={returnDate}
              onChange={(e) => e.target.value && setReturnDate(e.target.value)}
              className="input mt-1 w-full"
            />
          </label>
        )}
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          Return time
          <input type="time" value={returnTime} onChange={(e) => e.target.value && setReturnTime(e.target.value)} className="input mt-1 w-full" />
        </label>
        <p className="col-span-2 text-sm text-slate-600 dark:text-slate-300">
          {problem ?? `${when(pickupDate, pickupTime)} → ${when(effectiveReturn, returnTime)}`}
        </p>
        {clash && !problem && (
          <p role="alert" className="col-span-2 flex items-start gap-2 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            <ExclamationTriangleIcon aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />
            The car is {clash.source === 'blocked' ? 'off the road' : 'already booked'} from {clash.startDate} to {clash.endDate}. Pick
            other dates.
          </p>
        )}
      </section>

      {(listing.withDriverAvailable || listing.additionalDriverAllowed || listing.deliveryAvailable) && (
        <section aria-label="Extras" className="flex flex-col gap-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50">Make it easier</h3>
          {listing.withDriverAvailable && (
            <Toggle
              checked={withDriver}
              onChange={setWithDriver}
              icon={<UserIcon className="h-5 w-5" />}
              title="Add a driver"
              detail={`A local driver comes with the car${driverRate != null ? `, ${usd(driverRate)} per ${hourly ? 'hour' : 'day'}` : ''}. No licence needed from you.`}
            />
          )}
          {listing.additionalDriverAllowed && !withDriver && (
            <Toggle
              checked={additionalDriver}
              onChange={setAdditionalDriver}
              icon={<IdentificationIcon className="h-5 w-5" />}
              title="Add a second driver"
              detail={`Someone else in your group can drive too${listing.additionalDriverFee ? `, ${usd(listing.additionalDriverFee)} once` : ''}.`}
            />
          )}
          {listing.deliveryAvailable && (
            <Toggle
              checked={delivery}
              onChange={setDelivery}
              icon={<TruckIcon className="h-5 w-5" />}
              title="Deliver the car to me"
              detail={`To your hotel, home or the airport${listing.deliveryFee ? `, ${usd(listing.deliveryFee)}` : ', free'}.`}
            />
          )}
          {delivery && listing.deliveryAvailable && (
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Deliver to
              <input
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                maxLength={300}
                placeholder="e.g. Mamba Point Hotel, or RIA arrivals"
                className="input mt-1 w-full"
              />
            </label>
          )}
        </section>
      )}

      {!delivery && listing.pickupLocation && (
        <p className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
          <MapPinIcon aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          Pick up at {listing.pickupLocation}
        </p>
      )}

      <section aria-label="Price" className="flex flex-col gap-2 rounded-[2rem] bg-slate-50 p-5 text-sm dark:bg-slate-800/60">
        {lines.map((l) => (
          <p key={l.label} className="flex justify-between gap-3 text-slate-700 dark:text-slate-200">
            <span>{l.label}</span>
            <span>{usd(l.amount)}</span>
          </p>
        ))}
        <p className="flex justify-between gap-3 border-t border-slate-200 pt-2 text-base font-bold text-slate-950 dark:border-slate-700 dark:text-slate-50">
          <span>Total</span>
          <span>{usd(total)}</span>
        </p>
        {(terms?.depositAmount ?? listing.securityDeposit) != null && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Plus a refundable deposit of {usd((terms?.depositAmount ?? listing.securityDeposit)!)}, paid in cash at pickup and
            returned when the car comes back.
          </p>
        )}
        {listing.mileageLimitPerDay != null && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Includes {listing.mileageLimitPerDay} miles a day
            {listing.excessMileageFee ? `, then ${usd(listing.excessMileageFee)} a mile` : ''}.
          </p>
        )}
      </section>

      <button
        type="button"
        disabled={Boolean(problem) || Boolean(clash) || !terms}
        onClick={() => {
          setError('');
          setOpen(true);
        }}
        className="flex min-h-12 items-center justify-between gap-2 rounded-full bg-brand-700 px-5 text-sm font-bold text-white shadow-lg shadow-brand-700/25 transition hover:bg-brand-800 disabled:opacity-50"
      >
        <span className="flex items-center gap-1.5">
          {terms?.instantBook && <BoltIcon aria-hidden className="h-4 w-4" />}
          Continue to checkout
        </span>
        <span>{usd(total)}</span>
      </button>
      {terms && terms.paymentOptions.length > 0 && (
        <p className="-mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
          Pay with {terms.paymentOptions.map((o) => o.label).join(', ')}
        </p>
      )}

      <MenuSheet open={open} onClose={() => setOpen(false)} label="Checkout" footer={footer}>
        <div className="flex flex-col gap-5 px-5 pb-5 pt-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">Your rental</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-slate-50">{listing.title}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {when(pickupDate, pickupTime)} → {when(effectiveReturn, returnTime)}
            </p>
          </div>

          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-bold text-slate-900 dark:text-slate-50">Who&apos;s renting</legend>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Full name
              <input value={renterName} onChange={(e) => setRenterName(e.target.value)} autoComplete="name" className="input mt-1 w-full" />
            </label>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Phone
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={renterPhone}
                onChange={(e) => setRenterPhone(e.target.value)}
                placeholder="0886 123 456"
                className="input mt-1 w-full"
              />
            </label>
            {needsLicence && (
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200 sm:col-span-2">
                Driver&apos;s licence number
                <input value={licence} onChange={(e) => setLicence(e.target.value)} maxLength={60} placeholder="As on your licence" className="input mt-1 w-full" />
                <span className="mt-1 block text-xs font-normal text-slate-500">Bring the licence: the owner checks it before handing over the keys.</span>
              </label>
            )}
            {needsLicence && listing.minDriverAge != null && (
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200 sm:col-span-2">
                <input type="checkbox" checked={ageConfirmed} onChange={(e) => setAgeConfirmed(e.target.checked)} className="h-5 w-5 accent-brand-700" />
                I&apos;m at least {listing.minDriverAge} years old
              </label>
            )}
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200 sm:col-span-2">
              Anything the owner should know (optional)
              <textarea rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Flight number, child seat, going upcountry…" className="input mt-1 w-full" />
            </label>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-bold text-slate-900 dark:text-slate-50">How you&apos;ll pay</legend>
            {terms?.paymentOptions.map((o) => (
              <ChoiceCard
                key={o.method}
                name="rental-payment"
                checked={method === o.method}
                onSelect={() => setMethod(o.method)}
                icon={METHOD_ICON[o.method]}
                title={RENTAL_PAYMENT_LABELS[o.method]}
                detail={o.method === 'cash_at_pickup' ? 'Pay the owner when you collect the car' : 'Pay now; the owner checks it and confirms'}
              />
            ))}
          </fieldset>

          {mobile && option?.account && (
            <div className="flex flex-col gap-3 rounded-3xl bg-slate-50 p-4 dark:bg-slate-800/60">
              <p className="text-sm text-slate-700 dark:text-slate-200">
                1. Send <strong>{usd(total)}</strong> by {option.label} to
                {terms?.mobileMoneyAccountName ? ` ${terms.mobileMoneyAccountName}` : ''}
              </p>
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 dark:bg-slate-900">
                <span className="font-mono text-lg font-bold tabular-nums">{option.account}</span>
                <CopyButton value={option.account.replace(/\s/g, '')} label="number" />
              </div>
              <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
                2. Enter the transaction ID from your confirmation SMS
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  maxLength={80}
                  placeholder="e.g. MP240115.1234.A56789"
                  className="w-full rounded-2xl border border-slate-300 bg-white p-3 font-mono text-sm outline-none focus:border-brand-600 dark:border-slate-700 dark:bg-slate-900"
                />
              </label>
            </div>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {terms?.instantBook && !mobile
              ? 'Your car is confirmed straight away.'
              : mobile
                ? 'The owner confirms as soon as they see the payment. The car is held for you meanwhile.'
                : 'The owner confirms your rental, usually within the hour. The car is held for you meanwhile.'}
          </p>
        </div>
      </MenuSheet>
    </div>
  );
}
