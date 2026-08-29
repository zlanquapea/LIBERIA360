'use client';

import { useState, type FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { createCarListing, updateCarListing } from '@/lib/car-rentals-api';
import { HttpError } from '@/lib/http';
import { formatCarCategory, formatCarFuelType, formatCarTransmission } from '@/lib/format';
import { PhotoManager } from './PhotoManager';
import type { Business, CarCategory, CarFuelType, CarListing, County, CarTransmission } from '@/lib/types';

const CAR_CATEGORIES: CarCategory[] = [
  'economy',
  'compact',
  'sedan',
  'suv',
  'van',
  'minibus',
  'pickup',
  'luxury',
];
const CAR_TRANSMISSIONS: CarTransmission[] = ['automatic', 'manual'];
const CAR_FUEL_TYPES: CarFuelType[] = ['petrol', 'diesel', 'hybrid', 'electric'];

const CURRENT_YEAR = new Date().getFullYear();

const inputClass =
  'rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500';

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// Dual-mode create/edit — same shape as AdvertisementForm/NewEventForm:
// the `listing` prop switches it into edit mode and calls `onSaved`
// instead of redirecting. Anyone signed in can list a car here — no
// Business or Place required (see CarListing's doc comment) — so the
// only required location input is a county. `businesses` is purely an
// optional convenience for the rare registered rental company that
// already has an approved car_rental Business and wants this listing to
// also show up there; leaving it unlinked is the normal case.
export function CarListingForm({
  listing,
  businesses,
  counties,
  onSaved,
  onCancel,
}: {
  listing?: CarListing;
  businesses?: Business[];
  counties: County[];
  onSaved: (listing: CarListing) => void;
  onCancel?: () => void;
}) {
  const { token } = useAuth();
  const [countyId, setCountyId] = useState(listing?.county?.id ?? counties[0]?.id ?? '');
  const [businessId, setBusinessId] = useState(listing?.business?.id ?? '');
  const [title, setTitle] = useState(listing?.title ?? '');
  const [make, setMake] = useState(listing?.make ?? '');
  const [model, setModel] = useState(listing?.model ?? '');
  const [year, setYear] = useState(String(listing?.year ?? CURRENT_YEAR));
  const [category, setCategory] = useState<CarCategory>(listing?.category ?? 'sedan');
  const [transmission, setTransmission] = useState<CarTransmission>(listing?.transmission ?? 'automatic');
  const [fuelType, setFuelType] = useState<CarFuelType>(listing?.fuelType ?? 'petrol');
  const [seats, setSeats] = useState(String(listing?.seats ?? 5));
  const [pricePerDay, setPricePerDay] = useState(String(listing?.pricePerDay ?? ''));
  const [withDriverAvailable, setWithDriverAvailable] = useState(listing?.withDriverAvailable ?? false);
  const [driverFeePerDay, setDriverFeePerDay] = useState(
    listing?.driverFeePerDay != null ? String(listing.driverFeePerDay) : '',
  );
  const [minRentalDays, setMinRentalDays] = useState(String(listing?.minRentalDays ?? 1));
  const [securityDeposit, setSecurityDeposit] = useState(
    listing?.securityDeposit != null ? String(listing.securityDeposit) : '',
  );
  const [features, setFeatures] = useState(listing?.features.join(', ') ?? '');
  const [images, setImages] = useState<string[]>(listing?.images ?? []);
  const [description, setDescription] = useState(listing?.description ?? '');
  const [pickupLocation, setPickupLocation] = useState(listing?.pickupLocation ?? '');
  const [contactPhone, setContactPhone] = useState(listing?.contactPhone ?? '');
  const [contactWhatsapp, setContactWhatsapp] = useState(listing?.contactWhatsapp ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (!listing && !countyId) {
      setError('Choose which county the car is in.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const shared = {
        countyId,
        title,
        make,
        model,
        year: Number(year),
        category,
        transmission,
        fuelType,
        seats: Number(seats),
        pricePerDay: Number(pricePerDay),
        withDriverAvailable,
        driverFeePerDay: withDriverAvailable && driverFeePerDay ? Number(driverFeePerDay) : undefined,
        minRentalDays: Number(minRentalDays),
        securityDeposit: securityDeposit ? Number(securityDeposit) : undefined,
        features: splitList(features),
        images,
        description: description.trim() || undefined,
        pickupLocation: pickupLocation.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        contactWhatsapp: contactWhatsapp.trim() || undefined,
      };
      const saved = listing
        ? await updateCarListing(token, listing.id, shared)
        : await createCarListing(token, { businessId: businessId || undefined, ...shared });
      onSaved(saved);
      if (!listing) {
        setTitle('');
        setMake('');
        setModel('');
        setYear(String(CURRENT_YEAR));
        setPricePerDay('');
        setDriverFeePerDay('');
        setSecurityDeposit('');
        setFeatures('');
        setImages([]);
        setDescription('');
        setPickupLocation('');
        setContactPhone('');
        setContactWhatsapp('');
      }
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) return null;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-200">County</span>
        <select required value={countyId} onChange={(e) => setCountyId(e.target.value)} className={inputClass}>
          {counties.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      {businesses && businesses.length > 0 && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">
            Link to my registered rental business (optional)
          </span>
          <select value={businessId} onChange={(e) => setBusinessId(e.target.value)} className={inputClass}>
            <option value="">Don&apos;t link — list as an individual</option>
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-200">Listing title</span>
        <input
          required
          maxLength={150}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder='e.g. "2022 Toyota RAV4"'
          className={inputClass}
        />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">Make</span>
          <input required maxLength={60} value={make} onChange={(e) => setMake(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">Model</span>
          <input required maxLength={60} value={model} onChange={(e) => setModel(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">Year</span>
          <input
            required
            type="number"
            min={1990}
            max={CURRENT_YEAR + 1}
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value as CarCategory)} className={inputClass}>
            {CAR_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {formatCarCategory(c)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">Transmission</span>
          <select
            value={transmission}
            onChange={(e) => setTransmission(e.target.value as CarTransmission)}
            className={inputClass}
          >
            {CAR_TRANSMISSIONS.map((t) => (
              <option key={t} value={t}>
                {formatCarTransmission(t)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">Fuel type</span>
          <select value={fuelType} onChange={(e) => setFuelType(e.target.value as CarFuelType)} className={inputClass}>
            {CAR_FUEL_TYPES.map((f) => (
              <option key={f} value={f}>
                {formatCarFuelType(f)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">Seats</span>
          <input
            required
            type="number"
            min={1}
            max={30}
            value={seats}
            onChange={(e) => setSeats(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">Price per day ($)</span>
          <input
            required
            type="number"
            min={0}
            max={100000}
            step="0.01"
            value={pricePerDay}
            onChange={(e) => setPricePerDay(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">Minimum rental days</span>
          <input
            type="number"
            min={1}
            max={90}
            value={minRentalDays}
            onChange={(e) => setMinRentalDays(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
        <input
          type="checkbox"
          checked={withDriverAvailable}
          onChange={(e) => setWithDriverAvailable(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500 dark:border-slate-700"
        />
        Driver available on request
      </label>

      {withDriverAvailable && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">Driver fee per day ($, optional)</span>
          <input
            type="number"
            min={0}
            max={50000}
            step="0.01"
            value={driverFeePerDay}
            onChange={(e) => setDriverFeePerDay(e.target.value)}
            className={inputClass}
          />
        </label>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-200">Security deposit ($, optional)</span>
        <input
          type="number"
          min={0}
          max={500000}
          step="0.01"
          value={securityDeposit}
          onChange={(e) => setSecurityDeposit(e.target.value)}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-200">Features (comma-separated, optional)</span>
        <input
          value={features}
          onChange={(e) => setFeatures(e.target.value)}
          placeholder="AC, Bluetooth, GPS, 4WD"
          className={inputClass}
        />
      </label>

      <PhotoManager token={token} images={images} onChange={setImages} label="Photos" />

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-200">Description (optional)</span>
        <textarea
          maxLength={2000}
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-200">Default pickup location (optional)</span>
        <input
          maxLength={200}
          value={pickupLocation}
          onChange={(e) => setPickupLocation(e.target.value)}
          placeholder="e.g. Roberts International Airport"
          className={inputClass}
        />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">WhatsApp (optional)</span>
          <input
            maxLength={40}
            value={contactWhatsapp}
            onChange={(e) => setContactWhatsapp(e.target.value)}
            placeholder="+231770000000"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">Phone (optional)</span>
          <input
            maxLength={40}
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="+231770000000"
            className={inputClass}
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700 dark:text-flag-300">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {submitting ? 'Saving…' : listing ? 'Save changes' : 'Submit for review'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:underline"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
