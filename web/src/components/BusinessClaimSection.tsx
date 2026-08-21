'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { PhoneIcon, ChatBubbleLeftRightIcon, GlobeAltIcon, ClockIcon } from '@heroicons/react/24/outline';
import { ExclamationTriangleIcon } from '@heroicons/react/24/solid';
import { useAuth } from '@/hooks/useAuth';
import { claimBusiness, getMyBusinesses, updateBusiness } from '@/lib/business-api';
import { HttpError } from '@/lib/http';
import { formatBusinessReviewStatus, formatBusinessType, formatCost } from '@/lib/format';
import { BUSINESS_TYPES } from '@/lib/business-categories';
import { whatsappLink } from '@/lib/contact';
import { resolveImageUrl } from '@/lib/images';
import { VerificationBadge } from './VerificationBadge';
import { ContactLink } from './ContactLink';
import { PhotoManager } from './PhotoManager';
import { SingleImageUploader } from './SingleImageUploader';
import { SafeImage } from './SafeImage';
import type { Business, BusinessType } from '@/lib/types';

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// The review-lifecycle status the owner sees on their own listing — a
// stranger never reaches this (the public lookup only ever returns an
// APPROVED business, so `business` here is only ever non-approved when
// it came from the isOwner fallback fetch below).
function ReviewStatusBanner({ business }: { business: Business }) {
  if (business.reviewStatus === 'approved') return null;

  const config: Record<Exclude<Business['reviewStatus'], 'approved' | 'draft'>, { tone: string; message: string }> = {
    submitted_for_review: {
      tone: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300',
      message: "Submitted and awaiting admin review — it won't show publicly until approved.",
    },
    under_review: {
      tone: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300',
      message: 'An admin is reviewing this listing.',
    },
    rejected: {
      tone: 'border-flag-300 bg-flag-500/10 text-flag-700 dark:border-flag-800',
      message: 'This listing was rejected. Editing it below resubmits it for review.',
    },
    suspended: {
      tone: 'border-flag-300 bg-flag-500/10 text-flag-700 dark:border-flag-800',
      message: 'This listing has been suspended and is not publicly visible.',
    },
  };
  if (business.reviewStatus === 'draft') return null;
  const { tone, message } = config[business.reviewStatus];

  return (
    <div className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${tone}`}>
      <ExclamationTriangleIcon aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-medium">{formatBusinessReviewStatus(business.reviewStatus)}</p>
        <p>{message}</p>
        {business.rejectionReason && <p className="mt-1 italic">Reviewer note: {business.rejectionReason}</p>}
      </div>
    </div>
  );
}

// "Claim this listing" (Tech Spec §3.2 / Business Plan §8.1 freemium
// funnel). A Place has at most one linked Business — unclaimed shows a
// claim prompt/form, claimed shows the business's public contact card. The
// API enforces one claim per place (409 on a race), surfaced inline rather
// than crashing.
export function BusinessClaimSection({
  placeId,
  suggestedType,
  initialBusiness,
}: {
  placeId: string;
  suggestedType: BusinessType;
  initialBusiness: Business | null;
}) {
  const { user, token, ready } = useAuth();
  const [business, setBusiness] = useState(initialBusiness);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<BusinessType>(suggestedType);
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [description, setDescription] = useState('');
  const [openingHours, setOpeningHours] = useState('');
  const [priceRangeMin, setPriceRangeMin] = useState('');
  const [priceRangeMax, setPriceRangeMax] = useState('');
  const [servicesOffered, setServicesOffered] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The public destination-page fetch (getBusinessByPlace, server-side)
  // only ever returns an APPROVED listing now — a freshly submitted or
  // rejected claim comes back null there, same as "no business at all."
  // Without this, an owner would have no way to see their own listing's
  // status between claiming and approval. GET /businesses/mine is
  // unaffected by the approval gate (it's the owner's own view), so this
  // fills in what the public lookup can't show them.
  useEffect(() => {
    if (business || !ready || !user || !token) return;
    let cancelled = false;
    getMyBusinesses(token).then((list) => {
      if (cancelled) return;
      const mine = list.find((b) => b.linkedPlaceId === placeId);
      if (mine) setBusiness(mine);
    });
    return () => {
      cancelled = true;
    };
  }, [business, ready, user, token, placeId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      const claimed = await claimBusiness(token, {
        placeId,
        name,
        type,
        phone: phone.trim() || undefined,
        whatsapp: whatsapp.trim() || undefined,
        email: email.trim() || undefined,
        website: website.trim() || undefined,
        description: description.trim() || undefined,
        openingHours: openingHours.trim() || undefined,
        priceRangeMin: priceRangeMin ? Number(priceRangeMin) : undefined,
        priceRangeMax: priceRangeMax ? Number(priceRangeMax) : undefined,
        servicesOffered: servicesOffered ? splitList(servicesOffered) : undefined,
      });
      setBusiness(claimed);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (business) {
    const isOwner = user?.id === business.owner?.id;

    if (isOwner && editing && token) {
      return (
        <BusinessEditForm
          token={token}
          business={business}
          onSaved={(updated) => {
            setBusiness(updated);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      );
    }

    const hasPriceRange = business.priceRangeMin !== null || business.priceRangeMax !== null;

    return (
      <div className="flex flex-col gap-2">
        {isOwner && <ReviewStatusBanner business={business} />}
        <div className="flex flex-col gap-2 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-50">{business.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{formatBusinessType(business.type)}</p>
            </div>
            <VerificationBadge status={business.verificationStatus} />
          </div>
          {business.images.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {business.images.map((img) => (
                <SafeImage
                  key={img}
                  src={resolveImageUrl(img)}
                  alt={`${business.name} photo`}
                  className="h-20 w-28 shrink-0 rounded-lg object-cover"
                  fallback={<div aria-hidden className="h-20 w-28 shrink-0 rounded-lg bg-slate-200 dark:bg-slate-700" />}
                />
              ))}
            </div>
          )}
          {business.description && <p className="text-sm text-slate-600 dark:text-slate-300">{business.description}</p>}
          {business.openingHours && (
            <p className="flex items-start gap-1.5 text-sm text-slate-600 dark:text-slate-300">
              <ClockIcon aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
              {business.openingHours}
            </p>
          )}
          {hasPriceRange && (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Price range: {formatCost(business.priceRangeMin)}
              {business.priceRangeMax !== null && ` – ${formatCost(business.priceRangeMax)}`}
            </p>
          )}
          {business.servicesOffered.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {business.servicesOffered.map((service) => (
                <span key={service} className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-300">
                  {service}
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {business.phone && (
              <ContactLink
                placeId={placeId}
                href={`tel:${business.phone}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors hover:border-brand-500 hover:bg-brand-50"
              >
                <PhoneIcon aria-hidden className="h-3.5 w-3.5" />
                Call
              </ContactLink>
            )}
            {business.whatsapp && (
              <ContactLink
                placeId={placeId}
                href={whatsappLink(business.whatsapp)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700"
              >
                <ChatBubbleLeftRightIcon aria-hidden className="h-3.5 w-3.5" />
                WhatsApp
              </ContactLink>
            )}
            {business.website && (
              <ContactLink
                placeId={placeId}
                href={business.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors hover:border-brand-500 hover:bg-brand-50"
              >
                <GlobeAltIcon aria-hidden className="h-3.5 w-3.5" />
                Website
              </ContactLink>
            )}
          </div>
          {business.reviewStatus === 'approved' && (
            <Link href={`/businesses/${business.slug}`} className="self-start text-xs font-medium text-brand-700 hover:underline">
              View full listing
            </Link>
          )}
          {isOwner && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="self-start text-xs font-medium text-brand-700 hover:underline"
            >
              Manage this listing (contact info, photos &amp; more)
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!ready) return null;

  if (!user) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
        Own this business?{' '}
        <Link href="/login" className="font-medium text-brand-700 hover:underline">
          Log in
        </Link>{' '}
        to claim this listing.
      </p>
    );
  }

  if (!showForm) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">Own this business? Claim this listing to manage its contact info.</p>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="mt-2 rounded-full border border-slate-300 dark:border-slate-700 px-4 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-brand-500 hover:text-brand-700"
        >
          Claim this listing
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Business name
        <input
          type="text"
          required
          maxLength={200}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Business type
        <select
          value={type}
          onChange={(e) => setType(e.target.value as BusinessType)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        >
          {BUSINESS_TYPES.map((t) => (
            <option key={t} value={t}>
              {formatBusinessType(t)}
            </option>
          ))}
        </select>
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

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Opening hours
        <input
          type="text"
          placeholder="e.g. Mon–Sat 8am–9pm"
          maxLength={1000}
          value={openingHours}
          onChange={(e) => setOpeningHours(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      </label>

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

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Services offered
        <input
          type="text"
          placeholder="Airport pickup, Guided tours, Room service (comma-separated)"
          value={servicesOffered}
          onChange={(e) => setServicesOffered(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      </label>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Submitting a claim sends it for admin review — it won&apos;t appear publicly until approved.
      </p>

      {error && (
        <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {submitting ? 'Submitting…' : 'Submit claim'}
        </button>
        <button
          type="button"
          onClick={() => setShowForm(false)}
          className="rounded-full border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-500"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// Owner editing their own listing after claiming — contact info plus the
// photos travelers actually want to see (rooms, pool, storefront, menu)
// plus the rest of the profile fields (logo, videos, hours, price range,
// services).
function BusinessEditForm({
  token,
  business,
  onSaved,
  onCancel,
}: {
  token: string;
  business: Business;
  onSaved: (business: Business) => void;
  onCancel: () => void;
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
  const [openingHours, setOpeningHours] = useState(business.openingHours ?? '');
  const [priceRangeMin, setPriceRangeMin] = useState(business.priceRangeMin?.toString() ?? '');
  const [priceRangeMax, setPriceRangeMax] = useState(business.priceRangeMax?.toString() ?? '');
  const [servicesOffered, setServicesOffered] = useState(business.servicesOffered.join(', '));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
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
        openingHours: openingHours.trim() || undefined,
        priceRangeMin: priceRangeMin ? Number(priceRangeMin) : undefined,
        priceRangeMax: priceRangeMax ? Number(priceRangeMax) : undefined,
        servicesOffered: splitList(servicesOffered),
      });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Manage listing</p>
      {business.reviewStatus === 'rejected' && (
        <p className="rounded-lg bg-flag-500/10 px-3 py-2 text-xs text-flag-700">
          Saving resubmits this listing for admin review.
        </p>
      )}

      <SingleImageUploader token={token} value={logoImage} onChange={setLogoImage} label="Logo" className="h-24 w-24" />

      <PhotoManager token={token} images={images} onChange={setImages} label="Photos (rooms, pool, storefront, menu…)" />

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Business name
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

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Opening hours
        <input
          type="text"
          placeholder="e.g. Mon–Sat 8am–9pm"
          maxLength={1000}
          value={openingHours}
          onChange={(e) => setOpeningHours(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      </label>

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

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Services offered
        <input
          type="text"
          placeholder="Airport pickup, Guided tours, Room service (comma-separated)"
          value={servicesOffered}
          onChange={(e) => setServicesOffered(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      </label>

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
        <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700">
          {error}
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
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-500"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
