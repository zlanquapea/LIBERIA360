'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { claimBusiness } from '@/lib/business-api';
import { HttpError } from '@/lib/http';
import { formatBusinessType } from '@/lib/format';
import { whatsappLink } from '@/lib/contact';
import { VerificationBadge } from './VerificationBadge';
import type { Business, BusinessType } from '@/lib/types';

const BUSINESS_TYPES: BusinessType[] = ['hotel', 'restaurant', 'tour_operator', 'transport'];

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
  const [name, setName] = useState('');
  const [type, setType] = useState<BusinessType>(suggestedType);
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium text-slate-900">{business.name}</p>
            <p className="text-xs text-slate-500">{formatBusinessType(business.type)}</p>
          </div>
          <VerificationBadge status={business.verificationStatus} />
        </div>
        {business.description && <p className="text-sm text-slate-600">{business.description}</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          {business.phone && (
            <a
              href={`tel:${business.phone}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-500"
            >
              📞 Call
            </a>
          )}
          {business.whatsapp && (
            <a
              href={whatsappLink(business.whatsapp)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
            >
              💬 WhatsApp
            </a>
          )}
          {business.website && (
            <a
              href={business.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-500"
            >
              🌐 Website
            </a>
          )}
        </div>
        {isOwner && <p className="text-xs text-slate-400">You manage this listing.</p>}
      </div>
    );
  }

  if (!ready) return null;

  if (!user) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500">
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
      <div className="rounded-xl border border-dashed border-slate-300 px-4 py-3">
        <p className="text-sm text-slate-500">Own this business? Claim this listing to manage its contact info.</p>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="mt-2 rounded-full border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:border-brand-500 hover:text-brand-700"
        >
          Claim this listing
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3">
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        Business name
        <input
          type="text"
          required
          maxLength={200}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        Business type
        <select
          value={type}
          onChange={(e) => setType(e.target.value as BusinessType)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        >
          {BUSINESS_TYPES.map((t) => (
            <option key={t} value={t}>
              {formatBusinessType(t)}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Phone
          <input
            type="tel"
            maxLength={40}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          WhatsApp
          <input
            type="tel"
            maxLength={40}
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Website
          <input
            type="url"
            placeholder="https://"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          rows={3}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
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
          {submitting ? 'Submitting…' : 'Submit claim'}
        </button>
        <button
          type="button"
          onClick={() => setShowForm(false)}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-400"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
