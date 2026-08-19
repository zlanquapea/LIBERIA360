'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ComponentType, SVGProps } from 'react';
import {
  ClockIcon,
  KeyIcon,
  MapPinIcon,
  UsersIcon,
  ArrowTrendingUpIcon,
  ChatBubbleBottomCenterTextIcon,
  CalendarDaysIcon,
  BuildingStorefrontIcon,
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
import { useAuth } from '@/hooks/useAuth';
import {
  deleteEventAdmin,
  deleteReviewAdmin,
  getModerationQueue,
  getPlatformKpis,
  getTeamRoster,
  setBusinessVerification,
  setCreatorFeatured,
} from '@/lib/admin-api';
import { getActiveSponsoredPlacements, getCreatorByUsername, getPlaces } from '@/lib/api';
import { formatBusinessType } from '@/lib/format';
import { HttpError } from '@/lib/http';
import type { Creator, FlaggedContent, ModerationQueue, PlatformKpis, VerificationStatus } from '@/lib/types';

const VERIFICATION_OPTIONS: { value: VerificationStatus; label: string }[] = [
  { value: 'verified', label: 'Verified' },
  { value: 'recommended', label: 'Recommended' },
  { value: 'official', label: 'Official' },
  { value: 'eco_certified', label: 'Eco-certified' },
  { value: 'community_favorite', label: 'Community favorite' },
];

interface Kpis {
  totalPlaces: number;
  activePlacements: number;
  teamSize: number | null; // null when not a super admin — nothing to show
}

// Admin dashboard home (Tech Spec §7/§8) — KPI tiles for at-a-glance
// platform health, then "needs attention" (pending business claims,
// followed by browsing/lower-urgency sections. Gated + given its sidebar
// by admin/layout.tsx, so this is content only.
export default function AdminPage() {
  const { user, token } = useAuth();
  const [queue, setQueue] = useState<ModerationQueue | null>(null);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [platformKpis, setPlatformKpis] = useState<PlatformKpis | null>(null);

  function reload() {
    if (!token) return;
    getModerationQueue(token).then(setQueue);
  }

  useEffect(reload, [token]);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      getPlaces({ limit: 1 }),
      getActiveSponsoredPlacements(),
      user?.isSuperAdmin ? getTeamRoster(token) : Promise.resolve(null),
    ]).then(([places, placements, team]) => {
      setKpis({
        totalPlaces: places.meta.total,
        activePlacements: placements.length,
        teamSize: team ? team.length : null,
      });
    });
  }, [token, user?.isSuperAdmin]);

  useEffect(() => {
    if (!token || !user?.isSuperAdmin) return;
    getPlatformKpis(token).then(setPlatformKpis);
  }, [token, user?.isSuperAdmin]);

  if (!token) return null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            user?.isSuperAdmin ? 'bg-gold-400/20 text-gold-600' : 'bg-brand-700/10 text-brand-700'
          }`}
        >
          {user?.isSuperAdmin && <StarIcon aria-hidden className="mr-1 inline h-3 w-3 align-[-1px]" />}
          {user?.isSuperAdmin ? 'Super Admin' : 'Admin'}
        </span>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile label="Catalog places" value={kpis?.totalPlaces} icon={MapPinIcon} />
        <KpiTile
          label="Needs attention"
          value={queue?.pendingBusinesses.length}
          icon={ClockIcon}
          tone={queue && queue.pendingBusinesses.length > 0 ? 'warning' : undefined}
        />
        <KpiTile label="Featured this week" value={kpis?.activePlacements} icon={StarIcon} />
        <KpiTile
          label="Team members"
          value={kpis?.teamSize ?? undefined}
          icon={KeyIcon}
          hint={user?.isSuperAdmin ? undefined : 'Super admin only'}
        />
      </section>

      {user?.isSuperAdmin && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-slate-800">Platform</h2>
            <div className="flex gap-2 text-xs font-medium text-brand-700">
              <Link href="/admin/security" className="hover:underline">
                Security →
              </Link>
              <Link href="/admin/audit-log" className="hover:underline">
                Audit Log →
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiTile label="Total users" value={platformKpis?.totalUsers} icon={UsersIcon} />
            <KpiTile label="New users (7d)" value={platformKpis?.newUsersLast7Days} icon={ArrowTrendingUpIcon} />
            <KpiTile label="Total reviews" value={platformKpis?.totalReviews} icon={ChatBubbleBottomCenterTextIcon} />
            <KpiTile label="Total bookings" value={platformKpis?.totalBookings} icon={CalendarDaysIcon} />
          </div>
          {platformKpis && (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
              <BuildingStorefrontIcon aria-hidden className="h-5 w-5 shrink-0 text-brand-600" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">
                  {platformKpis.claimedBusinessCount} of {platformKpis.totalPlaces} places claimed by a business
                </p>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-brand-600"
                    style={{ width: `${Math.round(platformKpis.businessClaimRate * 100)}%` }}
                  />
                </div>
              </div>
              <span className="shrink-0 text-sm font-bold tabular-nums text-slate-900">
                {Math.round(platformKpis.businessClaimRate * 100)}%
              </span>
            </div>
          )}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 font-semibold text-slate-800">
          Needs attention
          {queue && queue.pendingBusinesses.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
              {queue.pendingBusinesses.length}
            </span>
          )}
        </h2>
        {!queue ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : queue.pendingBusinesses.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
            Nothing pending — the queue is clear.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {queue.pendingBusinesses.map((business) => (
              <li key={business.id} className="rounded-xl border border-amber-200 bg-amber-50/40 p-3">
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

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 font-semibold text-slate-800">
          Possibly closed
          {queue && queue.possiblyClosedPlaces.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
              {queue.possiblyClosedPlaces.length}
            </span>
          )}
        </h2>
        <p className="text-xs text-slate-500">
          Places where {/* keep in sync with FRESHNESS_FLAG_THRESHOLD */}3+ visitors independently reported
          &quot;no longer here&quot; in the last 90 days.
        </p>
        {!queue ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : queue.possiblyClosedPlaces.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
            Nothing flagged.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {queue.possiblyClosedPlaces.map(({ place, noLongerHereCount }) => (
              <li
                key={place.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/40 p-3"
              >
                <div>
                  <p className="font-medium text-slate-900">{place.name}</p>
                  <p className="text-xs text-slate-500">
                    {noLongerHereCount} report{noLongerHereCount === 1 ? '' : 's'} · {place.city}
                  </p>
                </div>
                <Link
                  href={`/places/${place.slug}`}
                  target="_blank"
                  className="shrink-0 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-500"
                >
                  View listing
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 font-semibold text-slate-800">
          Flagged content
          {queue && queue.flaggedContent.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
              {queue.flaggedContent.length}
            </span>
          )}
        </h2>
        <p className="text-xs text-slate-500">
          Reviews/events {/* keep in sync with REPORT_FLAG_THRESHOLD */}3+ users independently reported in the last
          90 days.
        </p>
        {!queue ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : queue.flaggedContent.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
            Nothing flagged.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {queue.flaggedContent.map((flagged) => (
              <FlaggedContentRow key={`${flagged.targetType}-${flagged.targetId}`} flagged={flagged} onDone={reload} />
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
                  <p className="flex items-center gap-0.5 text-slate-500">
                    {review.overallRating.toFixed(1)}
                    <StarIcon aria-hidden className="h-3.5 w-3.5 text-gold-500" />
                  </p>
                </div>
                {review.comment && <p className="mt-1 text-slate-600">{review.comment}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function KpiTile({
  label,
  value,
  icon: Icon,
  tone,
  hint,
}: {
  label: string;
  value: number | undefined;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  tone?: 'warning';
  hint?: string;
}) {
  return (
    <div
      className={`rounded-xl border p-3 shadow-card transition-shadow hover:shadow-card-hover ${tone === 'warning' && value ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`}
    >
      <div className="flex items-center justify-between">
        <Icon aria-hidden className="h-5 w-5 text-brand-600" />
        {tone === 'warning' && Boolean(value) && (
          <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />
        )}
      </div>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value ?? (hint ? '—' : '…')}</p>
      <p className="text-xs text-slate-500">{hint ?? label}</p>
    </div>
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

const REASON_LABELS: Record<string, string> = {
  spam: 'spam',
  inappropriate: 'inappropriate',
  fake: 'fake',
  other: 'other',
};

function FlaggedContentRow({ flagged, onDone }: { flagged: FlaggedContent; onDone: () => void }) {
  const { token } = useAuth();
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reasonSummary = Object.entries(flagged.reasons)
    .filter(([, count]) => count > 0)
    .map(([reason, count]) => `${count} ${REASON_LABELS[reason] ?? reason}`)
    .join(', ');

  async function remove() {
    if (!token) return;
    setRemoving(true);
    setError(null);
    try {
      if (flagged.targetType === 'review') {
        await deleteReviewAdmin(token, flagged.targetId);
      } else {
        await deleteEventAdmin(token, flagged.targetId);
      }
      onDone();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
      setRemoving(false);
    }
  }

  return (
    <li className="flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/40 p-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
          {flagged.targetType} · {flagged.reportCount} report{flagged.reportCount === 1 ? '' : 's'} ({reasonSummary})
        </p>
        {flagged.review && (
          <>
            <p className="mt-1 text-sm font-medium text-slate-900">{flagged.review.user?.name ?? 'A guest'}</p>
            {flagged.review.comment && <p className="text-sm text-slate-600">{flagged.review.comment}</p>}
          </>
        )}
        {flagged.event && (
          <p className="mt-1 text-sm font-medium text-slate-900">{flagged.event.name}</p>
        )}
        {error && <p className="mt-1 text-xs text-flag-700">{error}</p>}
      </div>
      <button
        type="button"
        disabled={removing}
        onClick={remove}
        className="shrink-0 rounded-full border border-flag-600 px-3 py-1.5 text-xs font-semibold text-flag-700 hover:bg-flag-600 hover:text-white disabled:opacity-60"
      >
        {removing ? 'Removing…' : 'Remove'}
      </button>
    </li>
  );
}
