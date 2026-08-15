'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AdminGate } from '@/components/AdminGate';
import { useAuth } from '@/hooks/useAuth';
import { getModerationQueue, setBusinessVerification, setCreatorFeatured } from '@/lib/admin-api';
import { getCreatorByUsername } from '@/lib/api';
import { formatBusinessType } from '@/lib/format';
import { HttpError } from '@/lib/http';
import type { Creator, ModerationQueue, VerificationStatus } from '@/lib/types';

const VERIFICATION_OPTIONS: { value: VerificationStatus; label: string }[] = [
  { value: 'verified', label: 'Verified' },
  { value: 'recommended', label: 'Recommended' },
  { value: 'official', label: 'Official' },
  { value: 'eco_certified', label: 'Eco-certified' },
  { value: 'community_favorite', label: 'Community favorite' },
];

// Admin dashboard home (Tech Spec §7/§8) — moderation queue (pending
// business claims + recent reviews) plus quick links into the other admin
// sections. Gated on User.isAdmin via AdminGate.
export default function AdminPage() {
  return (
    <AdminGate>
      <AdminDashboard />
    </AdminGate>
  );
}

function AdminDashboard() {
  const { token } = useAuth();
  const [queue, setQueue] = useState<ModerationQueue | null>(null);

  function reload() {
    if (!token) return;
    getModerationQueue(token).then(setQueue);
  }

  useEffect(reload, [token]);

  if (!token) return null;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-6">
      <h1 className="text-xl font-bold text-slate-900">Admin</h1>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <AdminNavCard href="/admin/content" icon="📝" label="Content management" />
        <AdminNavCard href="/admin/sponsored-placements" icon="⭐" label="Sponsored placements" />
        <AdminNavCard href="/admin/analytics" icon="📊" label="B2B analytics" />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-slate-800">Pending business claims</h2>
        {!queue ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : queue.pendingBusinesses.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing pending.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {queue.pendingBusinesses.map((business) => (
              <li key={business.id} className="rounded-xl border border-slate-200 p-3">
                <p className="font-medium text-slate-900">{business.name}</p>
                <p className="text-xs text-slate-500">
                  {formatBusinessType(business.type)} · owner: {business.owner?.name ?? 'unclaimed'}
                </p>
                <VerifyBusinessControl businessId={business.id} onDone={reload} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <FeaturedCreatorToggle token={token} />

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-slate-800">Recent reviews</h2>
        {!queue ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : queue.recentReviews.length === 0 ? (
          <p className="text-sm text-slate-500">No reviews yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {queue.recentReviews.map((review) => (
              <li key={review.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-slate-900">{review.user?.name ?? 'A guest'}</p>
                  <p className="text-slate-500">{review.overallRating.toFixed(1)} ★</p>
                </div>
                {review.comment && <p className="mt-1 text-slate-600">{review.comment}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function AdminNavCard({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-4 text-center hover:border-brand-500"
    >
      <span aria-hidden className="text-2xl">
        {icon}
      </span>
      <span className="text-sm font-medium text-slate-700">{label}</span>
    </Link>
  );
}

function FeaturedCreatorToggle({ token }: { token: string }) {
  const [username, setUsername] = useState('');
  const [creator, setCreator] = useState<Creator | null>(null);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lookup() {
    setLoading(true);
    setError(null);
    setCreator(null);
    try {
      setCreator(await getCreatorByUsername(username.trim().replace(/^@/, '')));
    } catch {
      setError('No creator found with that username.');
    } finally {
      setLoading(false);
    }
  }

  async function toggle() {
    if (!creator) return;
    setToggling(true);
    try {
      const updated = await setCreatorFeatured(token, creator.id, !creator.featured);
      setCreator(updated);
    } finally {
      setToggling(false);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold text-slate-800">Feature a creator</h2>
      <div className="flex gap-2">
        <input
          placeholder="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && lookup()}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
        <button
          type="button"
          disabled={loading || !username.trim()}
          onClick={lookup}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-brand-500 disabled:opacity-60"
        >
          {loading ? 'Looking up…' : 'Find'}
        </button>
      </div>
      {error && <p className="text-sm text-flag-700">{error}</p>}
      {creator && (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
          <div>
            <p className="font-medium text-slate-900">{creator.name}</p>
            <p className="text-xs text-slate-500">@{creator.username} · currently {creator.featured ? 'featured' : 'not featured'}</p>
          </div>
          <button
            type="button"
            disabled={toggling}
            onClick={toggle}
            className="rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
          >
            {toggling ? 'Saving…' : creator.featured ? 'Unfeature' : 'Feature'}
          </button>
        </div>
      )}
    </section>
  );
}

function VerifyBusinessControl({ businessId, onDone }: { businessId: string; onDone: () => void }) {
  const { token } = useAuth();
  const [status, setStatus] = useState<VerificationStatus>('verified');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply() {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      await setBusinessVerification(token, businessId, status);
      onDone();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as VerificationStatus)}
        className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
      >
        {VERIFICATION_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={submitting}
        onClick={apply}
        className="rounded-full bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
      >
        {submitting ? 'Applying…' : 'Apply'}
      </button>
      {error && <span className="text-xs text-flag-700">{error}</span>}
    </div>
  );
}
