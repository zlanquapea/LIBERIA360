'use client';

import { useEffect, useState, type FormEvent } from 'react';
import {
  createActivity,
  createBusinessAdmin,
  createPlace,
  deleteActivity,
  deleteBusinessAdmin,
  deletePlace,
  updateActivity,
  updateBusinessAdmin,
  updatePlace,
} from '@/lib/admin-api';
import { getBusinessByPlace, getPlaceBySlug, getPlaces } from '@/lib/api';
import { HttpError } from '@/lib/http';
import { formatBusinessType, formatPlaceType } from '@/lib/format';
import { PhotoManager } from '@/components/PhotoManager';
import type { Activity, ActivityDifficulty, Business, BusinessType, Category, County, Place, PlaceType } from '@/lib/types';
import { BackToListLink, DeleteButton, TabListHeader, inputClass, slugify } from './content-shared';

const PLACE_TYPES: PlaceType[] = ['attraction', 'nature_site', 'hotel', 'restaurant', 'activity_provider'];
const BUSINESS_TYPES: BusinessType[] = ['hotel', 'restaurant', 'tour_operator', 'transport'];
const ACTIVITY_DIFFICULTIES: ActivityDifficulty[] = ['easy', 'moderate', 'challenging'];

type View = { mode: 'list' } | { mode: 'create' } | { mode: 'edit'; slug: string };

export function PlacesTab({
  token,
  categories,
  counties,
  isSuperAdmin,
}: {
  token: string;
  categories: Category[];
  counties: County[];
  isSuperAdmin: boolean;
}) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [view, setView] = useState<View>({ mode: 'list' });

  function reload() {
    // 100 is QueryPlacesDto's own validated ceiling (@Max(100)) — going
    // over it 400s. Fine at the catalog's current size; this list has no
    // pagination yet, so revisit once the catalog actually approaches it.
    getPlaces({ limit: 100 }).then((res) => setPlaces(res.data));
  }

  useEffect(reload, []);

  if (view.mode === 'create') {
    return (
      <div className="flex flex-col gap-3">
        <BackToListLink label="Back to places" onClick={() => setView({ mode: 'list' })} />
        <CreatePlaceForm
          token={token}
          categories={categories}
          counties={counties}
          places={places}
          onCreated={(place) => {
            reload();
            setView({ mode: 'edit', slug: place.slug });
          }}
        />
      </div>
    );
  }

  if (view.mode === 'edit') {
    return (
      <div className="flex flex-col gap-3">
        <BackToListLink label="Back to places" onClick={() => setView({ mode: 'list' })} />
        <PlaceDetail
          token={token}
          slug={view.slug}
          categories={categories}
          counties={counties}
          places={places}
          isSuperAdmin={isSuperAdmin}
          onChanged={reload}
          onDeleted={() => {
            reload();
            setView({ mode: 'list' });
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <TabListHeader title="Places" count={places.length} createLabel="+ New place" onCreate={() => setView({ mode: 'create' })} />
      {places.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
          No places yet — add the first one.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2">Place</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">County</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {places.map((place) => (
                <tr key={place.id} onClick={() => setView({ mode: 'edit', slug: place.slug })} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                  <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-50">{place.name}</td>
                  <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{formatPlaceType(place.type)}</td>
                  <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{place.category.name}</td>
                  <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{place.county.name}</td>
                  <td className="px-4 py-2.5 text-right text-xs font-medium text-brand-700">Edit →</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// --- Detail view: place fields + its activities + its business --------

function PlaceDetail({
  token,
  slug,
  categories,
  counties,
  places,
  isSuperAdmin,
  onChanged,
  onDeleted,
}: {
  token: string;
  slug: string;
  categories: Category[];
  counties: County[];
  places: Place[];
  isSuperAdmin: boolean;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [place, setPlace] = useState<Place | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);

  function reload() {
    getPlaceBySlug(slug).then(async (p) => {
      setPlace(p);
      setBusiness(await getBusinessByPlace(p.id));
    });
  }

  useEffect(reload, [slug]);

  if (!place) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <PlaceEditForm
        token={token}
        place={place}
        categories={categories}
        counties={counties}
        isSuperAdmin={isSuperAdmin}
        onSaved={(updated) => {
          setPlace(updated);
          onChanged();
        }}
        onDeleted={onDeleted}
      />
      <ActivitiesEditor token={token} place={place} isSuperAdmin={isSuperAdmin} onChanged={reload} />
      <BusinessEditor token={token} place={place} business={business} isSuperAdmin={isSuperAdmin} onChanged={reload} />
    </div>
  );
}

// --- Create a place -------------------------------------------------------

function CreatePlaceForm({
  token,
  categories,
  counties,
  places,
  onCreated,
}: {
  token: string;
  categories: Category[];
  counties: County[];
  places: Place[];
  onCreated: (place: Place) => void;
}) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [type, setType] = useState<PlaceType>('attraction');
  const [categoryId, setCategoryId] = useState('');
  const [countyId, setCountyId] = useState('');
  const [city, setCity] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!categoryId && categories.length > 0) setCategoryId(categories[0].id);
    if (!countyId && counties.length > 0) setCountyId(counties[0].id);
  }, [categories, counties, categoryId, countyId]);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  // Cities already used in the selected county — offered as suggestions
  // (not a hard list) via a <datalist>, so the very first place in a
  // county can still name a brand-new city.
  const citiesInCounty = Array.from(new Set(places.filter((p) => p.county.id === countyId).map((p) => p.city))).sort();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const place = await createPlace(token, {
        name,
        slug,
        description,
        type,
        categoryId,
        countyId,
        city,
        latitude: Number(latitude),
        longitude: Number(longitude),
        images,
      });
      onCreated(place);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">New place</h3>
      <PhotoManager token={token} images={images} onChange={setImages} label="Photos" />

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Name
          <input required maxLength={200} value={name} onChange={(e) => handleNameChange(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Slug
          <input
            required
            maxLength={220}
            placeholder="auto-generated from name"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugTouched(true);
            }}
            className={inputClass}
          />
          <span className="text-xs font-normal text-slate-400 dark:text-slate-500">
            Auto-filled from the name — the web address for this place. Edit it if you want something different.
          </span>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Description
        <textarea required rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
      </label>

      <div className="grid grid-cols-3 gap-3">
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
          <select
            value={countyId}
            onChange={(e) => {
              setCountyId(e.target.value);
              setCity(''); // last county's city no longer applies
            }}
            className={inputClass}
          >
            {counties.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          City
          <input
            required
            maxLength={150}
            list="city-suggestions"
            placeholder={citiesInCounty.length ? 'Pick or type a city' : 'Type a city'}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className={inputClass}
          />
          <datalist id="city-suggestions">
            {citiesInCounty.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Latitude
          <input required type="number" step="any" value={latitude} onChange={(e) => setLatitude(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Longitude
          <input required type="number" step="any" value={longitude} onChange={(e) => setLongitude(e.target.value)} className={inputClass} />
        </label>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || !categoryId || !countyId}
        className="self-start rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
      >
        {submitting ? 'Creating…' : 'Create place'}
      </button>
    </form>
  );
}

// --- Edit a place's own fields ---------------------------------------------

function PlaceEditForm({
  token,
  place,
  categories,
  counties,
  isSuperAdmin,
  onSaved,
  onDeleted,
}: {
  token: string;
  place: Place;
  categories: Category[];
  counties: County[];
  isSuperAdmin: boolean;
  onSaved: (place: Place) => void;
  onDeleted: () => void;
}) {
  const [name, setName] = useState(place.name);
  const [description, setDescription] = useState(place.description);
  const [type, setType] = useState<PlaceType>(place.type);
  const [categoryId, setCategoryId] = useState(place.category.id);
  const [countyId, setCountyId] = useState(place.county.id);
  const [city, setCity] = useState(place.city);
  const [contactPhone, setContactPhone] = useState(place.contactPhone ?? '');
  const [whatsapp, setWhatsapp] = useState(place.whatsapp ?? '');
  const [images, setImages] = useState(place.images);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setName(place.name);
    setDescription(place.description);
    setType(place.type);
    setCategoryId(place.category.id);
    setCountyId(place.county.id);
    setCity(place.city);
    setContactPhone(place.contactPhone ?? '');
    setWhatsapp(place.whatsapp ?? '');
    setImages(place.images);
    setSuccess(false);
    // Keyed on place.id, not the whole place object: a save re-fetches the
    // same place (new object, same id) to refresh other sections below —
    // that must not stomp the success message this form just set. Only
    // switching to a genuinely different place should reset the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place.id]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      const updated = await updatePlace(token, place.id, {
        name,
        description,
        type,
        categoryId,
        countyId,
        city,
        contactPhone: contactPhone.trim() || undefined,
        whatsapp: whatsapp.trim() || undefined,
        images,
      });
      setSuccess(true);
      onSaved(updated);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Place details</h3>
        {isSuperAdmin && (
          <DeleteButton label="Delete place" onDelete={() => deletePlace(token, place.id)} onDeleted={onDeleted} />
        )}
      </div>
      <PhotoManager token={token} images={images} onChange={setImages} label="Photos" />
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Name
          <input required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          City
          <input required maxLength={150} value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Description
        <textarea required rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
      </label>
      <div className="grid grid-cols-3 gap-3">
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
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Contact phone
          <input maxLength={40} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          WhatsApp
          <input maxLength={40} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className={inputClass} />
        </label>
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700">
          {error}
        </p>
      )}
      {success && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Saved.</p>}
      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
      >
        {submitting ? 'Saving…' : 'Save place'}
      </button>
    </form>
  );
}

// --- Activities (sub-resource of a place) -----------------------------------

function ActivitiesEditor({
  token,
  place,
  isSuperAdmin,
  onChanged,
}: {
  token: string;
  place: Place;
  isSuperAdmin: boolean;
  onChanged: () => void;
}) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [difficulty, setDifficulty] = useState<ActivityDifficulty | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createActivity(token, {
        placeId: place.id,
        name,
        price: price ? Number(price) : undefined,
        difficulty: difficulty || undefined,
      });
      setName('');
      setPrice('');
      setDifficulty('');
      onChanged();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Activities</h3>
      {(place.activities ?? []).length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">No activities yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {(place.activities ?? []).map((activity) => (
            <ActivityRow key={activity.id} token={token} activity={activity} isSuperAdmin={isSuperAdmin} onChanged={onChanged} />
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="grid grid-cols-3 gap-2">
        <input
          required
          placeholder="New activity name"
          maxLength={200}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`col-span-3 sm:col-span-1 ${inputClass}`}
        />
        <input
          type="number"
          placeholder="Price"
          min={0}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className={inputClass}
        />
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as ActivityDifficulty | '')} className={inputClass}>
          <option value="">Difficulty…</option>
          {ACTIVITY_DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={submitting}
          className="col-span-3 self-start rounded-full border border-slate-300 dark:border-slate-700 px-4 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-brand-500 disabled:opacity-60 sm:col-span-3"
        >
          {submitting ? 'Adding…' : '+ Add activity'}
        </button>
        {error && <p className="col-span-3 text-xs text-flag-700">{error}</p>}
      </form>
    </div>
  );
}

function ActivityRow({
  token,
  activity,
  isSuperAdmin,
  onChanged,
}: {
  token: string;
  activity: Activity;
  isSuperAdmin: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(activity.name);
  const [price, setPrice] = useState(activity.price?.toString() ?? '');
  const [submitting, setSubmitting] = useState(false);

  async function save() {
    setSubmitting(true);
    try {
      await updateActivity(token, activity.id, { name, price: price ? Number(price) : undefined });
      setEditing(false);
      onChanged();
    } finally {
      setSubmitting(false);
    }
  }

  if (!editing) {
    return (
      <li className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm">
        <span>
          {activity.name}
          {activity.price !== null && <span className="text-slate-500 dark:text-slate-400"> · ${activity.price}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={() => setEditing(true)} className="text-xs font-medium text-brand-700 hover:underline">
            Edit
          </button>
          {isSuperAdmin && <DeleteButton label="Delete" onDelete={() => deleteActivity(token, activity.id)} onDeleted={onChanged} />}
        </span>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2">
      <input value={name} onChange={(e) => setName(e.target.value)} className={`flex-1 ${inputClass}`} />
      <input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} className={`w-24 ${inputClass}`} />
      <button
        type="button"
        disabled={submitting}
        onClick={save}
        className="rounded-full bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
      >
        {submitting ? 'Saving…' : 'Save'}
      </button>
    </li>
  );
}

// --- Business (sub-resource of a place) -------------------------------------

function BusinessEditor({
  token,
  place,
  business,
  isSuperAdmin,
  onChanged,
}: {
  token: string;
  place: Place;
  business: Business | null;
  isSuperAdmin: boolean;
  onChanged: () => void;
}) {
  const [name, setName] = useState(business?.name ?? '');
  const [type, setType] = useState<BusinessType>(business?.type ?? 'hotel');
  const [phone, setPhone] = useState(business?.phone ?? '');
  const [ownerUserId, setOwnerUserId] = useState(business?.owner?.id ?? '');
  const [images, setImages] = useState(business?.images ?? []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(business?.name ?? '');
    setType(business?.type ?? 'hotel');
    setPhone(business?.phone ?? '');
    setOwnerUserId(business?.owner?.id ?? '');
    setImages(business?.images ?? []);
  }, [business]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (business) {
        await updateBusinessAdmin(token, business.id, {
          name,
          type,
          phone: phone.trim() || undefined,
          ownerUserId: ownerUserId.trim() || null,
          images,
        });
      } else {
        await createBusinessAdmin(token, {
          placeId: place.id,
          name,
          type,
          phone: phone.trim() || undefined,
          images,
        });
      }
      onChanged();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {business ? 'Business listing' : 'Seed a business listing (unclaimed until an owner claims it)'}
        </h3>
        {isSuperAdmin && business && (
          <DeleteButton label="Delete business" onDelete={() => deleteBusinessAdmin(token, business.id)} onDeleted={onChanged} />
        )}
      </div>
      <PhotoManager token={token} images={images} onChange={setImages} label="Photos" />
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Name
          <input required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Type
          <select value={type} onChange={(e) => setType(e.target.value as BusinessType)} className={inputClass}>
            {BUSINESS_TYPES.map((t) => (
              <option key={t} value={t}>
                {formatBusinessType(t)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Phone
          <input maxLength={40} value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </label>
        {business && (
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
            Owner user ID
            <input
              placeholder="blank = unclaimed"
              value={ownerUserId}
              onChange={(e) => setOwnerUserId(e.target.value)}
              className={inputClass}
            />
          </label>
        )}
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
      >
        {submitting ? 'Saving…' : business ? 'Save business' : 'Create business'}
      </button>
    </form>
  );
}
