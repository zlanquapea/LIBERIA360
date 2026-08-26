'use client';

import { useState, type FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { createAdvertisement, updateAdvertisement } from '@/lib/ads-api';
import { HttpError } from '@/lib/http';
import { formatAdvertisementType } from '@/lib/format';
import { PhotoManager } from './PhotoManager';
import type { Advertisement, AdvertisementType } from '@/lib/types';

const AD_TYPES: AdvertisementType[] = ['digital_product', 'business'];

// Dual-mode create/edit — same shape as NewEventForm: the `ad` prop
// switches it into edit mode and calls `onSaved` instead of redirecting,
// so the caller (the My Ads list) decides what happens next.
export function AdvertisementForm({
  ad,
  onSaved,
  onCancel,
}: {
  ad?: Advertisement;
  onSaved: (ad: Advertisement) => void;
  onCancel?: () => void;
}) {
  const { token } = useAuth();
  const [type, setType] = useState<AdvertisementType>(ad?.type ?? 'digital_product');
  const [title, setTitle] = useState(ad?.title ?? '');
  const [description, setDescription] = useState(ad?.description ?? '');
  const [images, setImages] = useState<string[]>(ad?.images ?? []);
  const [priceLabel, setPriceLabel] = useState(ad?.priceLabel ?? '');
  const [contactPhone, setContactPhone] = useState(ad?.contactPhone ?? '');
  const [contactWhatsapp, setContactWhatsapp] = useState(ad?.contactWhatsapp ?? '');
  const [contactEmail, setContactEmail] = useState(ad?.contactEmail ?? '');
  const [externalLink, setExternalLink] = useState(ad?.externalLink ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      const input = {
        title,
        description,
        images,
        priceLabel: priceLabel.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        contactWhatsapp: contactWhatsapp.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        externalLink: externalLink.trim() || undefined,
      };
      const saved = ad
        ? await updateAdvertisement(token, ad.id, input)
        : await createAdvertisement(token, { type, ...input });
      onSaved(saved);
      if (!ad) {
        setTitle('');
        setDescription('');
        setImages([]);
        setPriceLabel('');
        setContactPhone('');
        setContactWhatsapp('');
        setContactEmail('');
        setExternalLink('');
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
      {!ad && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">What are you advertising?</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as AdvertisementType)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          >
            {AD_TYPES.map((t) => (
              <option key={t} value={t}>
                {formatAdvertisementType(t)}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-200">Title</span>
        <input
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder='e.g. "Monrovia Photography Course" or "CeeCee Tours"'
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-200">Description</span>
        <textarea
          required
          maxLength={2000}
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is it, and why should someone reach out?"
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-200">Price (optional)</span>
        <input
          maxLength={100}
          value={priceLabel}
          onChange={(e) => setPriceLabel(e.target.value)}
          placeholder='e.g. "$20" or "Contact for price"'
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
        />
      </label>

      <PhotoManager token={token} images={images} onChange={setImages} label="Picture / flyer" />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">WhatsApp</span>
          <input
            maxLength={40}
            value={contactWhatsapp}
            onChange={(e) => setContactWhatsapp(e.target.value)}
            placeholder="+231770000000"
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">Phone</span>
          <input
            maxLength={40}
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="+231770000000"
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">Email</span>
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">Link (optional)</span>
          <input
            type="url"
            value={externalLink}
            onChange={(e) => setExternalLink(e.target.value)}
            placeholder="https://…"
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
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
          {submitting ? 'Saving…' : ad ? 'Save changes' : 'Submit for review'}
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
