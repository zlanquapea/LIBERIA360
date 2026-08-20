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
  DocumentTextIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  ShieldCheckIcon,
  ShieldExclamationIcon,
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
import { useAuth } from '@/hooks/useAuth';
import {
  deleteEventAdmin,
  deleteReviewAdmin,
  getAggregateAnalytics,
  getModerationQueue,
  getPlatformKpis,
  getSecurityOverview,
  getTeamRoster,
  setBusinessVerification,
  setCreatorFeatured,
} from '@/lib/admin-api';
import { getActiveSponsoredPlacements, getCreatorByUsername, getPlaces } from '@/lib/api';
import { formatBookingStatus, formatBusinessType } from '@/lib/format';
import { HttpError } from '@/lib/http';
import type {
  BookingStatus,
  Creator,
  FlaggedContent,
  ModerationQueue,
  PlatformKpis,
  SecurityOverview,
  TopPlace,
  VerificationStatus,
} from '@/lib/types';

// Fixed status colors, validated for categorical/CVD separation against this
// app's own brand palette (see dataviz skill) — not arbitrary. pending/
// confirmed/declined reuse the semantic meaning readers already expect;
// cancelled uses the app's existing brand-400 blue rather than a generic
// gray, which failed the palette's chroma-floor check on its own.
const BOOKING_STATUS_META: { key: BookingStatus; color: string }[] = [
  { key: 'confirmed', color: '#059669' },
  { key: 'pending', color: '#d97706' },
  { key: 'declined', color: '#c80305' },
  { key: 'cancelled', color: '#6478c2' },
];

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
  const [topPlaces, setTopPlaces] = useState<TopPlace[] | null>(null);
  const [securityOverview, setSecurityOverview] = useState<SecurityOverview | null>(null);

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
    getSecurityOverview(token).then(setSecurityOverview);
  }, [token, user?.isSuperAdmin]);

  // Top places by engagement — same B2B analytics endpoint the dedicated
  // Analytics page uses, any admin (not just super admin) can already call
  // it; surfacing the top 5 here means the dashboard leads with something
  // real instead of only a wall of counters.
  useEffect(() => {
    if (!token) return;
    getAggregateAnalytics(token, 5).then((data) => setTopPlaces(data.topPlaces));
  }, [token]);

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

      <QuickActions isSuperAdmin={Boolean(user?.isSuperAdmin)} />

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

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-800">Top places by engagement</h2>
          <Link href="/admin/analytics" className="text-xs font-medium text-brand-700 hover:underline">
            Full analytics →
          </Link>
        </div>
        <div className="rounded-xl border border-slate-200 p-4">
          {!topPlaces ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : topPlaces.length === 0 ? (
            <p className="text-sm text-slate-500">No activity recorded yet — views, saves, and bookings will show up here.</p>
          ) : (
            <TopPlacesChart places={topPlaces} />
          )}
        </div>
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

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="mb-3 text-sm font-medium text-slate-900">Bookings by status</p>
              {platformKpis ? (
                <BookingStatusBar counts={platformKpis.bookingsByStatus} />
              ) : (
                <p className="text-sm text-slate-500">Loading…</p>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-900">Security snapshot</p>
                <Link href="/admin/security" className="text-xs font-medium text-brand-700 hover:underline">
                  Details →
                </Link>
              </div>
              {securityOverview ? <SecuritySnapshot overview={securityOverview} /> : <p className="text-sm text-slate-500">Loading…</p>}
            </div>
          </div>
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

// A launchpad into every management surface, not just a report page — the
// sidebar already links these, but a dashboard that's supposed to feel like
// a command center should surface them here too, not make you go find them.
function QuickActions({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const actions: { href: string; label: string; description: string; icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
    { href: '/admin/content', label: 'Content', description: 'Places, categories, events, counties', icon: DocumentTextIcon },
    { href: '/admin/sponsored-placements', label: 'Sponsored placements', description: 'Featured listing slots', icon: StarIcon },
    { href: '/admin/analytics', label: 'B2B analytics', description: 'Engagement by place & category', icon: ChartBarIcon },
    ...(isSuperAdmin
      ? [
          { href: '/admin/team', label: 'Team & Access', description: 'Promote admins, manage roles', icon: KeyIcon },
          { href: '/admin/audit-log', label: 'Audit Log', description: 'Every admin action, with device info', icon: ClipboardDocumentListIcon },
          { href: '/admin/security', label: 'Security', description: 'Login activity, force sign-out', icon: ShieldCheckIcon },
        ]
      : []),
  ];

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {actions.map(({ href, label, description, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="group flex items-start gap-3 rounded-xl border border-slate-200 p-3 shadow-card transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card-hover"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-700/10 text-brand-700 transition-colors group-hover:bg-brand-700 group-hover:text-white">
            <Icon aria-hidden className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-900">{label}</span>
            <span className="block truncate text-xs text-slate-500">{description}</span>
          </span>
        </Link>
      ))}
    </section>
  );
}

// Ranked magnitude across places → a single-hue horizontal bar chart, not a
// categorical one (this is one measure compared across items, not identity).
// Value sits at the tip per the bar's own end, never crammed inside a short
// bar. See the dataviz skill: ≤24px thick, 4px rounded tip, square origin.
function TopPlacesChart({ places }: { places: TopPlace[] }) {
  const max = Math.max(...places.map((p) => p.total), 1);
  return (
    <ul className="flex flex-col gap-3">
      {places.map((place) => {
        const pct = Math.max((place.total / max) * 100, 3);
        return (
          <li key={place.placeId}>
            <Link
              href={`/places/${place.slug}`}
              target="_blank"
              className="group flex items-center gap-3 rounded-lg -mx-1 px-1 py-0.5 hover:bg-slate-50"
            >
              <span className="w-32 shrink-0 truncate text-sm text-slate-700 group-hover:text-brand-700 sm:w-44">
                {place.name}
              </span>
              <span className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                <span
                  className="block h-full rounded-r rounded-l-none bg-brand-600"
                  style={{ width: `${pct}%` }}
                />
              </span>
              <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-600">
                {place.total.toLocaleString()}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// Part-of-whole across a fixed, known set of statuses → one segmented bar
// (not 4 separate bars, not a pie — see the dataviz skill's anti-patterns).
// Colors are the validated BOOKING_STATUS_META set; a legend is mandatory
// here since this is 4 series and color can't be the only identity channel.
function BookingStatusBar({ counts }: { counts: Record<BookingStatus, number> }) {
  const total = BOOKING_STATUS_META.reduce((sum, s) => sum + (counts[s.key] ?? 0), 0);

  if (total === 0) {
    return <p className="text-sm text-slate-500">No bookings yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-4 w-full gap-0.5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label="Bookings by status">
        {BOOKING_STATUS_META.filter((s) => (counts[s.key] ?? 0) > 0).map((s) => (
          <div
            key={s.key}
            style={{ width: `${((counts[s.key] ?? 0) / total) * 100}%`, backgroundColor: s.color }}
            title={`${formatBookingStatus(s.key)}: ${counts[s.key]}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {BOOKING_STATUS_META.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
            {formatBookingStatus(s.key)}
            <span className="font-semibold tabular-nums text-slate-900">{counts[s.key] ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// A handful of numbers, not a chart — correctly a stat row per the dataviz
// skill's "is it even a chart?" check. The 2FA-adoption meter is the one
// exception: severity reads across a filled track (danger below half,
// warning below full, accent at/above), same convention as a battery meter.
function SecuritySnapshot({ overview }: { overview: SecurityOverview }) {
  const { total, enabled } = overview.adminTwoFactorAdoption;
  const adoptionPct = total > 0 ? Math.round((enabled / total) * 100) : 0;
  const meterColor = adoptionPct >= 100 ? '#059669' : adoptionPct >= 50 ? '#d97706' : '#c80305';

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="flex items-center gap-1 text-lg font-bold tabular-nums text-slate-900">
            {overview.failedLoginsLast1h > 0 && <ShieldExclamationIcon aria-hidden className="h-4 w-4 text-amber-500" />}
            {overview.failedLoginsLast1h}
          </p>
          <p className="text-xs text-slate-500">Failed logins (1h)</p>
        </div>
        <div>
          <p className="text-lg font-bold tabular-nums text-slate-900">{overview.failedLoginsLast24h}</p>
          <p className="text-xs text-slate-500">Failed logins (24h)</p>
        </div>
        <div>
          <p className="text-lg font-bold tabular-nums text-slate-900">{overview.distinctFailingIpsLast24h}</p>
          <p className="text-xs text-slate-500">Distinct failing IPs (24h)</p>
        </div>
        <div>
          <p className="text-lg font-bold tabular-nums text-slate-900">
            {enabled}/{total}
          </p>
          <p className="text-xs text-slate-500">Admin 2FA enabled</p>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>2FA adoption</span>
          <span className="font-semibold tabular-nums text-slate-900">{adoptionPct}%</span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full transition-[width]" style={{ width: `${adoptionPct}%`, backgroundColor: meterColor }} />
        </div>
      </div>
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
