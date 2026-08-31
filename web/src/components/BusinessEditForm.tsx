'use client';

import { useState, type FormEvent } from 'react';
import { updateBusiness } from '@/lib/business-api';
import { HttpError } from '@/lib/http';
import { DEFAULT_CLOSE_TIME, DEFAULT_OPEN_TIME, formatDailyHours, parseDailyHours } from '@/lib/opening-hours';
import { DailyHoursPicker } from './DailyHoursPicker';
import { AmenitiesPicker } from './AmenitiesPicker';
import { PhotoManager } from './PhotoManager';
import { SingleImageUploader } from './SingleImageUploader';
import type { Business } from '@/lib/types';

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// Owner editing their own listing after claiming — contact info plus the
// photos travelers actually want to see (rooms, pool, storefront, menu)
// plus the rest of the profile fields (logo, videos, hours, price range,
// services). Extracted out of BusinessClaimSection so it can be reused as
// its own "Profile" page in the business owner's dashboard
// (/account/my-businesses/[id]/profile) rather than only living inline on
// the public place page.
export function BusinessEditForm({
  token,
  business,
  onSaved,
  onCancel,
}: {
  token: string;
  business: Business;
  onSaved: (business: Business) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(business.name);
  const [phone, setPhone] = useState(business.phone ?? '');
  const [whatsapp, setWhatsapp] = useState(business.whatsapp ?? '');
  const [email, setEmail] = useState(business.email ?? '');
  const [website, setWebsite] = useState(business.website ?? '');
  const [description, setDescription] = useState(business.description ?? '');
  const [images, setImages] = useState(business.images);
  const [logoImage, setLogoImage] = useState<string | null>(business.logoImage);
  const [videos, setVideos] = useState(business.videos.join(', '));
  const initialHours = parseDailyHours(business.openingHours);
  const [openTime, setOpenTime] = useState(initialHours.open);
  const [closeTime, setCloseTime] = useState(initialHours.close);
  const [priceRangeMin, setPriceRangeMin] = useState(business.priceRangeMin?.toString() ?? '');
  const [priceRangeMax, setPriceRangeMax] = useState(business.priceRangeMax?.toString() ?? '');
  const [servicesOffered, setServicesOffered] = useState(business.servicesOffered);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateBusiness(token, business.id, {
        name,
        phone: phone.trim() || undefined,
        whatsapp: whatsapp.trim() || undefined,
        email: email.trim() || undefined,
        website: website.trim() || undefined,
        description: description.trim() || undefined,
        images,
        logoImage: logoImage ?? undefined,
        videos: splitList(videos),
        openingHours: formatDailyHours(openTime, closeTime),
        priceRangeMin: priceRangeMin ? Number(priceRangeMin) : undefined,
        priceRangeMax: priceRangeMax ? Number(priceRangeMax) : undefined,
        servicesOffered,
      });
      setSaved(true);
      onSaved(updated);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Manage this place</p>
      {business.reviewStatus === 'rejected' && (
        <p className="rounded-lg bg-flag-500/10 px-3 py-2 text-xs text-flag-700 dark:text-flag-300">
          Saving resubmits this listing for admin review.
        </p>
      )}

      <SingleImageUploader token={token} value={logoImage} onChange={setLogoImage} label="Logo" className="h-24 w-24" />

      <PhotoManager token={token} images={images} onChange={setImages} label="Photos (rooms, pool, storefront, menu…)" />

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Place name
        <input
          type="text"
          required
          maxLength={200}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Phone
          <input
            type="tel"
            maxLength={40}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          WhatsApp
          <input
            type="tel"
            maxLength={40}
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Website
          <input
            type="url"
            placeholder="https://"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          rows={3}
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      </label>

      <DailyHoursPicker open={openTime} close={closeTime} onChange={(o, c) => { setOpenTime(o); setCloseTime(c); }} />

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Price from (USD)
          <input
            type="number"
            min={0}
            value={priceRangeMin}
            onChange={(e) => setPriceRangeMin(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Price up to (USD)
          <input
            type="number"
            min={0}
            value={priceRangeMax}
            onChange={(e) => setPriceRangeMax(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </label>
      </div>

      <AmenitiesPicker value={servicesOffered} onChange={setServicesOffered} />

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Video links
        <input
          type="text"
          placeholder="https://youtube.com/..., https://... (comma-separated)"
          value={videos}
          onChange={(e) => setVideos(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      </label>

      {error && (
        <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700 dark:text-flag-300">
          {error}
        </p>
      )}
      {saved && !error && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
          Saved.
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {submitting ? 'Saving…' : 'Save changes'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-500"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
