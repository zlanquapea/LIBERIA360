'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  createActivity,
  createBusinessAdmin,
  createPlace,
  updateActivity,
  updateBusinessAdmin,
  updateCountyAdmin,
  updateEventAdmin,
  updatePlace,
} from '@/lib/admin-api';
import { getBusinessByPlace, getCategories, getCounties, getEvents, getPlaceBySlug, getPlaces } from '@/lib/api';
import { HttpError } from '@/lib/http';
import { formatBusinessType, formatEventCategory, formatPlaceType } from '@/lib/format';
import type {
  Activity,
  ActivityDifficulty,
  Business,
  BusinessType,
  Category,
  County,
  Event,
  EventCategory,
  Place,
  PlaceType,
} from '@/lib/types';

const PLACE_TYPES: PlaceType[] = ['attraction', 'nature_site', 'hotel', 'restaurant', 'activity_provider'];
const BUSINESS_TYPES: BusinessType[] = ['hotel', 'restaurant', 'tour_operator', 'transport'];
const ACTIVITY_DIFFICULTIES: ActivityDifficulty[] = ['easy', 'moderate', 'challenging'];
const EVENT_CATEGORIES: EventCategory[] = ['concert', 'festival', 'sports', 'nightlife', 'seasonal', 'other'];

const inputClass =
  'rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500';

// Admin content management (Tech Spec §8) — create/edit Place, Activity,
// Business, Event. All four go through /admin/* rather than the
// user-facing endpoints (e.g. Business's self-claim flow), since an admin
// is seeding or correcting the catalog, not claiming a listing.
export default function AdminContentPage() {
  const { token } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [counties, setCounties] = useState<County[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);

  function reloadPlaces() {
    getPlaces({ limit: 100 }).then((res) => setPlaces(res.data));
  }

  useEffect(() => {
    getCategories().then(setCategories);
    getCounties().then(setCounties);
    reloadPlaces();
  }, []);

  if (!token) return null;

  return (
    <div className="flex flex-col gap-10">
      <h1 className="text-xl font-bold text-slate-900">Content Management</h1>

      <CreatePlaceSection token={token} categories={categories} counties={counties} onCreated={reloadPlaces} />
      <ManagePlaceSection token={token} categories={categories} counties={counties} places={places} onChanged={reloadPlaces} />
      <ManageEventsSection token={token} counties={counties} />
      <ManageCountiesSection token={token} counties={counties} onChanged={setCounties} />
    </div>
  );
}

// --- Create a place -------------------------------------------------------

function CreatePlaceSection({
  token,
  categories,
  counties,
  onCreated,
}: {
  token: string;
  categories: Category[];
  counties: County[];
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<PlaceType>('attraction');
  const [categoryId, setCategoryId] = useState('');
  const [countyId, setCountyId] = useState('');
  const [city, setCity] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!categoryId && categories.length > 0) setCategoryId(categories[0].id);
    if (!countyId && counties.length > 0) setCountyId(counties[0].id);
  }, [categories, counties, categoryId, countyId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
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
      });
      setSuccess(`Created "${place.name}" (${place.slug}).`);
      setName('');
      setSlug('');
      setDescription('');
      setCity('');
      setLatitude('');
      setLongitude('');
      onCreated();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold text-slate-800">Create a place</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Name
            <input required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Slug
            <input
              required
              maxLength={220}
              placeholder="kebab-case"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Description
          <textarea required rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
        </label>

        <div className="grid grid-cols-3 gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Type
            <select value={type} onChange={(e) => setType(e.target.value as PlaceType)} className={inputClass}>
              {PLACE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {formatPlaceType(t)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Category
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
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

        <div className="grid grid-cols-3 gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            City
            <input required maxLength={150} value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Latitude
            <input required type="number" step="any" value={latitude} onChange={(e) => setLatitude(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Longitude
            <input required type="number" step="any" value={longitude} onChange={(e) => setLongitude(e.target.value)} className={inputClass} />
          </label>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700">
            {error}
          </p>
        )}
        {success && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{success}</p>}

        <button
          type="submit"
          disabled={submitting || !categoryId || !countyId}
          className="self-start rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {submitting ? 'Creating…' : 'Create place'}
        </button>
      </form>
    </section>
  );
}

// --- Manage an existing place (edit fields, activities, business) --------

function ManagePlaceSection({
  token,
  categories,
  counties,
  places,
  onChanged,
}: {
  token: string;
  categories: Category[];
  counties: County[];
  places: Place[];
  onChanged: () => void;
}) {
  const [selectedSlug, setSelectedSlug] = useState('');
  const [place, setPlace] = useState<Place | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);

  function reload(slug: string) {
    if (!slug) {
      setPlace(null);
      setBusiness(null);
      return;
    }
    getPlaceBySlug(slug).then(async (p) => {
      setPlace(p);
      setBusiness(await getBusinessByPlace(p.id));
    });
  }

  useEffect(() => {
    reload(selectedSlug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSlug]);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold text-slate-800">Manage a place</h2>
      <select
        value={selectedSlug}
        onChange={(e) => setSelectedSlug(e.target.value)}
        className={inputClass}
      >
        <option value="">Select a place…</option>
        {places.map((p) => (
          <option key={p.id} value={p.slug}>
            {p.name} ({p.county.name})
          </option>
        ))}
      </select>

      {place && (
        <div className="flex flex-col gap-6">
          <PlaceEditForm
            token={token}
            place={place}
            categories={categories}
            counties={counties}
            onSaved={(updated) => {
              setPlace(updated);
              onChanged();
            }}
          />
          <ActivitiesEditor
            token={token}
            place={place}
            onChanged={() => reload(selectedSlug)}
          />
          <BusinessEditor token={token} place={place} business={business} onChanged={() => reload(selectedSlug)} />
        </div>
      )}
    </section>
  );
}

function PlaceEditForm({
  token,
  place,
  categories,
  counties,
  onSaved,
}: {
  token: string;
  place: Place;
  categories: Category[];
  counties: County[];
  onSaved: (place: Place) => void;
}) {
  const [name, setName] = useState(place.name);
  const [description, setDescription] = useState(place.description);
  const [type, setType] = useState<PlaceType>(place.type);
  const [categoryId, setCategoryId] = useState(place.category.id);
  const [countyId, setCountyId] = useState(place.county.id);
  const [city, setCity] = useState(place.city);
  const [contactPhone, setContactPhone] = useState(place.contactPhone ?? '');
  const [whatsapp, setWhatsapp] = useState(place.whatsapp ?? '');
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3">
      <h3 className="text-sm font-semibold text-slate-700">Place details</h3>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Name
          <input required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          City
          <input required maxLength={150} value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        Description
        <textarea required rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
      </label>
      <div className="grid grid-cols-3 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Type
          <select value={type} onChange={(e) => setType(e.target.value as PlaceType)} className={inputClass}>
            {PLACE_TYPES.map((t) => (
              <option key={t} value={t}>
                {formatPlaceType(t)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Category
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
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
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Contact phone
          <input maxLength={40} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
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

function ActivitiesEditor({ token, place, onChanged }: { token: string; place: Place; onChanged: () => void }) {
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
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3">
      <h3 className="text-sm font-semibold text-slate-700">Activities</h3>
      {(place.activities ?? []).length === 0 ? (
        <p className="text-sm text-slate-500">No activities yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {(place.activities ?? []).map((activity) => (
            <ActivityRow key={activity.id} token={token} activity={activity} onChanged={onChanged} />
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
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as ActivityDifficulty | '')}
          className={inputClass}
        >
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
          className="col-span-3 self-start rounded-full border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:border-brand-500 disabled:opacity-60 sm:col-span-3"
        >
          {submitting ? 'Adding…' : '+ Add activity'}
        </button>
        {error && <p className="col-span-3 text-xs text-flag-700">{error}</p>}
      </form>
    </div>
  );
}

function ActivityRow({ token, activity, onChanged }: { token: string; activity: Activity; onChanged: () => void }) {
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
      <li className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
        <span>
          {activity.name}
          {activity.price !== null && <span className="text-slate-500"> · ${activity.price}</span>}
        </span>
        <button type="button" onClick={() => setEditing(true)} className="text-xs font-medium text-brand-700 hover:underline">
          Edit
        </button>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
      <input value={name} onChange={(e) => setName(e.target.value)} className={`flex-1 ${inputClass}`} />
      <input
        type="number"
        min={0}
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        className={`w-24 ${inputClass}`}
      />
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

function BusinessEditor({
  token,
  place,
  business,
  onChanged,
}: {
  token: string;
  place: Place;
  business: Business | null;
  onChanged: () => void;
}) {
  const [name, setName] = useState(business?.name ?? '');
  const [type, setType] = useState<BusinessType>(business?.type ?? 'hotel');
  const [phone, setPhone] = useState(business?.phone ?? '');
  const [ownerUserId, setOwnerUserId] = useState(business?.owner?.id ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(business?.name ?? '');
    setType(business?.type ?? 'hotel');
    setPhone(business?.phone ?? '');
    setOwnerUserId(business?.owner?.id ?? '');
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
        });
      } else {
        await createBusinessAdmin(token, { placeId: place.id, name, type, phone: phone.trim() || undefined });
      }
      onChanged();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3">
      <h3 className="text-sm font-semibold text-slate-700">
        {business ? 'Business listing' : 'Seed a business listing (unclaimed until an owner claims it)'}
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Name
          <input required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
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
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Phone
          <input maxLength={40} value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </label>
        {business && (
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
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

// --- Edit events -----------------------------------------------------------

function ManageEventsSection({ token, counties }: { token: string; counties: County[] }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    getEvents({ limit: 50 }).then((res) => setEvents(res.data));
  }, []);

  const selected = events.find((e) => e.id === selectedId) ?? null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold text-slate-800">Edit an event</h2>
      <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className={inputClass}>
        <option value="">Select an event…</option>
        {events.map((ev) => (
          <option key={ev.id} value={ev.id}>
            {ev.name} ({formatEventCategory(ev.category)})
          </option>
        ))}
      </select>

      {selected && (
        <EventEditForm
          token={token}
          event={selected}
          counties={counties}
          onSaved={(updated) => setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))}
        />
      )}
    </section>
  );
}

function EventEditForm({
  token,
  event,
  counties,
  onSaved,
}: {
  token: string;
  event: Event;
  counties: County[];
  onSaved: (event: Event) => void;
}) {
  const [name, setName] = useState(event.name);
  const [category, setCategory] = useState<EventCategory>(event.category);
  const [countyId, setCountyId] = useState(event.county.id);
  const [description, setDescription] = useState(event.description ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setName(event.name);
    setCategory(event.category);
    setCountyId(event.county.id);
    setDescription(event.description ?? '');
    setSuccess(false);
    // Keyed on event.id, not the whole event object — same reasoning as
    // PlaceEditForm above: a save replaces this event with a new object of
    // the same id, which must not wipe the success message just set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      const updated = await updateEventAdmin(token, event.id, {
        name,
        category,
        countyId,
        description: description.trim() || undefined,
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Name
          <input required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value as EventCategory)} className={inputClass}>
            {EVENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {formatEventCategory(c)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        County
        <select value={countyId} onChange={(e) => setCountyId(e.target.value)} className={inputClass}>
          {counties.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        Description
        <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
      </label>
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
        {submitting ? 'Saving…' : 'Save event'}
      </button>
    </form>
  );
}

// --- Edit a county's safety & practical-info panel -------------------------

function ManageCountiesSection({
  token,
  counties,
  onChanged,
}: {
  token: string;
  counties: County[];
  onChanged: (counties: County[]) => void;
}) {
  const [selectedId, setSelectedId] = useState('');
  const selected = counties.find((c) => c.id === selectedId) ?? null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold text-slate-800">County safety &amp; practical info</h2>
      <p className="text-sm text-slate-500">
        Shown as a &quot;Before you go&quot; panel on the county page — left blank on purpose until set here rather
        than guessed at seed time (a wrong emergency number is worse than no number at all).
      </p>
      <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className={inputClass}>
        <option value="">Select a county…</option>
        {counties.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      {selected && (
        <CountyEditForm
          token={token}
          county={selected}
          onSaved={(updated) => onChanged(counties.map((c) => (c.id === updated.id ? updated : c)))}
        />
      )}
    </section>
  );
}

function CountyEditForm({
  token,
  county,
  onSaved,
}: {
  token: string;
  county: County;
  onSaved: (county: County) => void;
}) {
  const [emergencyNumber, setEmergencyNumber] = useState(county.emergencyNumber ?? '');
  // One tip per line in the textarea — simplest editing UI for a string
  // array; split/filter on save and on load, same as photos elsewhere.
  const [safetyTipsText, setSafetyTipsText] = useState(county.safetyTips.join('\n'));
  const [localCustoms, setLocalCustoms] = useState(county.localCustoms ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setEmergencyNumber(county.emergencyNumber ?? '');
    setSafetyTipsText(county.safetyTips.join('\n'));
    setLocalCustoms(county.localCustoms ?? '');
    setSuccess(false);
    // Keyed on county.id, not the whole county object — same reasoning as
    // EventEditForm above: a save replaces this county with a new object of
    // the same id, which must not wipe the success message just set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [county.id]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      const updated = await updateCountyAdmin(token, county.id, {
        emergencyNumber: emergencyNumber.trim() || undefined,
        safetyTips: safetyTipsText
          .split('\n')
          .map((tip) => tip.trim())
          .filter(Boolean),
        localCustoms: localCustoms.trim() || undefined,
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3">
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        Emergency number
        <input
          maxLength={100}
          placeholder="e.g. 911"
          value={emergencyNumber}
          onChange={(e) => setEmergencyNumber(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        Safety tips (one per line)
        <textarea rows={4} value={safetyTipsText} onChange={(e) => setSafetyTipsText(e.target.value)} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        Local customs
        <textarea rows={3} value={localCustoms} onChange={(e) => setLocalCustoms(e.target.value)} className={inputClass} />
      </label>
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
        {submitting ? 'Saving…' : 'Save county info'}
      </button>
    </form>
  );
}
