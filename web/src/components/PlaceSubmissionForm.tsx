'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { submitPlace, updateMyPlace, type SubmitPlaceInput } from '@/lib/place-api';
import { getCategories, getCounties } from '@/lib/api';
import { formatPlaceType } from '@/lib/format';
import { HttpError } from '@/lib/http';
import { PhotoManager } from './PhotoManager';
import { PlaceLocationPickerLoader } from '@/app/admin/content/PlaceLocationPickerLoader';
import type { Category, County, Place, PlaceType } from '@/lib/types';

const PLACE_TYPES: PlaceType[] = ['attraction', 'nature_site', 'hotel', 'restaurant', 'activity_provider'];

const inputClass =
  'rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500';

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// The self-service counterpart to the admin's CreatePlaceForm (Content >
// Places) — a traveler or business owner adding a destination that isn't
// in the catalog yet, gated by admin review (see PlaceReviewStatus's doc
// comment) rather than going live immediately. Same component handles
// editing an existing submission (`place` passed in) — a REJECTED
// submission's edit auto-resubmits it, same as claiming/editing a
// business.
export function PlaceSubmissionForm({
  token,
  place,
  onSaved,
}: {
  token: string;
  place?: Place;
  onSaved: (place: Place) => void;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [counties, setCounties] = useState<County[]>([]);
  const [name, setName] = useState(place?.name ?? '');
  const [description, setDescription] = useState(place?.description ?? '');
  const [type, setType] = useState<PlaceType>(place?.type ?? 'attraction');
  const [categoryId, setCategoryId] = useState(place?.category.id ?? '');
  const [countyId, setCountyId] = useState(place?.county.id ?? '');
  const [city, setCity] = useState(place?.city ?? '');
  const [latitude, setLatitude] = useState<number | null>(place?.latitude ?? null);
  const [longitude, setLongitude] = useState<number | null>(place?.longitude ?? null);
  const [tags, setTags] = useState(place?.tags.join(', ') ?? '');
  const [images, setImages] = useState<string[]>(place?.images ?? []);
  const [openingHours, setOpeningHours] = useState(place?.openingHours ?? '');
  const [contactPhone, setContactPhone] = useState(place?.contactPhone ?? '');
  const [whatsapp, setWhatsapp] = useState(place?.whatsapp ?? '');
  const [website, setWebsite] = useState(place?.website ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCategories().then(setCategories);
    getCounties().then(setCounties);
  }, []);

  useEffect(() => {
    if (!categoryId && categories.length > 0) setCategoryId(categories[0].id);
    if (!countyId && counties.length > 0) setCountyId(counties[0].id);
  }, [categories, counties, categoryId, countyId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (latitude === null || longitude === null) return; // guarded by the disabled submit button too
    setSubmitting(true);
    setError(null);
    try {
      const input: SubmitPlaceInput = {
        name,
        description,
        type,
        categoryId,
        countyId,
        city,
        latitude,
        longitude,
        tags: tags ? splitList(tags) : undefined,
        images,
        openingHours: openingHours.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        whatsapp: whatsapp.trim() || undefined,
        website: website.trim() || undefined,
      };
      const saved = place ? await updateMyPlace(token, place.id, input) : await submitPlace(token, input);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
      {place?.reviewStatus === 'rejected' && (
        <p className="rounded-lg bg-flag-500/10 px-3 py-2 text-xs text-flag-700 dark:text-flag-300">
          Saving resubmits this place for admin review.
        </p>
      )}

      <PhotoManager token={token} images={images} onChange={setImages} label="Photos" />

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Name
        <input required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Description
        <textarea
          required
          rows={4}
          maxLength={4000}
          placeholder="What makes this place worth visiting? Be specific — this is what travelers will read."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={inputClass}
        />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Type
          <select value={type} onChange={(e) => setType(e.target.value as PlaceType)} className={inputClass}>
            {PLACE_TYPES.map((t) => (
              <option key={t} value={t}>
                {formatPlaceType(t)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Category
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          County
          <select value={countyId} onChange={(e) => setCountyId(e.target.value)} className={inputClass}>
            {counties.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        City / town
        <input required maxLength={150} value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
      </label>

      <div className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Location
        <PlaceLocationPickerLoader
          latitude={latitude}
          longitude={longitude}
          onChange={(lat, lng) => {
            setLatitude(lat);
            setLongitude(lng);
          }}
        />
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Tags
        <input
          placeholder="waterfall, hiking, family-friendly (comma-separated)"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Opening hours
        <input
          placeholder="e.g. Daily 7am–6pm"
          maxLength={1000}
          value={openingHours}
          onChange={(e) => setOpeningHours(e.target.value)}
          className={inputClass}
        />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Contact phone
          <input type="tel" maxLength={40} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          WhatsApp
          <input type="tel" maxLength={40} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Website
          <input type="url" placeholder="https://" value={website} onChange={(e) => setWebsite(e.target.value)} className={inputClass} />
        </label>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        {place
          ? 'Changes go back to an admin for review before they show publicly.'
          : "Submitting sends this to an admin for review — it won't appear publicly until approved."}
      </p>

      {error && (
        <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700 dark:text-flag-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || !categoryId || !countyId || latitude === null || longitude === null}
        className="self-start rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
      >
        {submitting ? 'Submitting…' : place ? 'Save changes' : 'Submit for review'}
      </button>
    </form>
  );
}
