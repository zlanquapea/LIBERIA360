"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ComponentType, SVGProps } from "react";
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  ChevronRightIcon,
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
  MapIcon,
  MapPinIcon,
  MegaphoneIcon,
  ShieldExclamationIcon,
} from "@heroicons/react/24/outline";
import { StarIcon } from "@heroicons/react/24/solid";
import { useAuth } from "@/hooks/useAuth";
import { BrandLoader } from "@/components/BrandLoader";
import {
  getAnalyticsOverview,
  getAuditLog,
  getModerationQueue,
  getPlatformKpis,
  getSecurityOverview,
  getTeamRoster,
} from "@/lib/admin-api";
import { getActiveSponsoredPlacements, getPlaces } from "@/lib/api";
import { formatBookingStatus } from "@/lib/format";
import type {
  AdminAction,
  AnalyticsOverview,
  BookingStatus,
  ModerationQueue,
  PlatformKpis,
  SecurityOverview,
} from "@/lib/types";
import { visibleAdminNav } from "@/lib/admin-nav";
import { KpiCard, Panel } from "@/components/admin-ui";

// Fixed status colors, validated for categorical/CVD separation against this
// app's own brand palette (see dataviz skill) — not arbitrary. pending/
// confirmed/declined reuse the semantic meaning readers already expect;
// cancelled uses the app's existing brand-400 blue rather than a generic
// gray, which failed the palette's chroma-floor check on its own.
const BOOKING_STATUS_META: { key: BookingStatus; color: string }[] = [
  { key: "confirmed", color: "#059669" },
  { key: "pending", color: "#d97706" },
  { key: "declined", color: "#c80305" },
  { key: "cancelled", color: "#6478c2" },
];

interface AtAGlanceKpis {
  totalPlaces: number;
  activePlacements: number;
  teamSize: number | null; // null when not a super admin — nothing to show
}

// Admin dashboard home — an executive-level overview an admin can read in
// a few seconds, built around the three questions the redesign is meant
// to answer: what's happening (At a Glance / What's Happening), why it
// matters (deltas + insight sentences on every KPI, not bare numbers),
// and what to do about it (Needs Attention links straight into the
// relevant management page; Quick Actions is the launchpad for
// everything else). The working queues themselves (verify a business,
// remove flagged content) now live on their own pages under Content —
// see admin/content/moderation and admin/content/reports — so this page
// stays a control-center summary, not a second copy of those forms.
export default function AdminPage() {
  const { user, token } = useAuth();
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [queue, setQueue] = useState<ModerationQueue | null>(null);
  const [kpis, setKpis] = useState<AtAGlanceKpis | null>(null);
  const [platformKpis, setPlatformKpis] = useState<PlatformKpis | null>(null);
  const [securityOverview, setSecurityOverview] =
    useState<SecurityOverview | null>(null);
  const [recentActions, setRecentActions] = useState<AdminAction[] | null>(
    null,
  );

  useEffect(() => {
    if (!token) return;
    getAnalyticsOverview(token).then(setOverview);
    getModerationQueue(token).then(setQueue);
  }, [token]);

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
    getAuditLog(token, 1, 5).then((res) => setRecentActions(res.data));
  }, [token, user?.isSuperAdmin]);

  if (!token) return null;

  const metric = (key: AnalyticsOverview["metrics"][number]["key"]) =>
    overview?.metrics.find((m) => m.key === key);

  const needsAttentionTotal =
    (queue?.pendingBusinesses.length ?? 0) +
    (queue?.pendingPlaces.length ?? 0) +
    (queue?.pendingAdvertisements.length ?? 0) +
    (queue?.pendingEvents.length ?? 0) +
    (queue?.flaggedContent.length ?? 0) +
    (queue?.possiblyClosedPlaces.length ?? 0) +
    (securityOverview?.failedLoginsLast24h ?? 0);

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <header className="relative overflow-hidden rounded-[2rem] border border-brand-800/70 bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800 px-5 py-7 text-white shadow-xl shadow-brand-950/15 sm:px-8 sm:py-9">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-10 -top-12 h-64 w-40 rounded-[48%] bg-brand-700/60 blur-[1px] sm:h-80 sm:w-52"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-0 h-28 w-52 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.5)_1px,transparent_0)] [background-size:10px_10px]"
        />
        <div className="relative z-10 flex flex-col gap-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-gold-300">
                Control center
              </p>
              <h1 className="mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl">
                Dashboard
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-brand-100 sm:text-base">
                Monitor Liberia360, review what needs attention, and move quickly
                to the right workspace.
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white/10 px-2.5 py-2 text-[11px] font-semibold text-white/90 sm:px-3 sm:text-xs">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.16)]" />
              Workspace ready
            </span>
          </div>
          <span
            className={`inline-flex w-fit items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
              user?.isSuperAdmin
                ? "border-gold-300/40 bg-gold-300/15 text-gold-200"
                : "border-white/20 bg-white/10 text-white"
            }`}
          >
            {user?.isSuperAdmin && (
              <StarIcon aria-hidden className="h-4 w-4 text-gold-300" />
            )}
            {user?.isSuperAdmin ? "Super Admin" : "Admin"}
          </span>
        </div>
      </header>

      <QuickActions />

      {/* 1. What is happening? — At a Glance */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold text-slate-800 dark:text-slate-100">
            At a Glance
          </h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            The latest platform signals at a glance.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="Catalog places" value={kpis?.totalPlaces ?? "…"} />
          <KpiCard
            label="Featured this week"
            value={kpis?.activePlacements ?? "…"}
          />
          {(() => {
            const m = metric("newUsers");
            return (
              <KpiCard
                label="New sign-ups (7d)"
                value={m?.current ?? "…"}
                direction={m?.direction}
                deltaPct={m?.deltaPct}
              />
            );
          })()}
          {(() => {
            const m = metric("pageViews");
            return (
              <KpiCard
                label="Place views (7d)"
                value={m?.current ?? "…"}
                direction={m?.direction}
                deltaPct={m?.deltaPct}
              />
            );
          })()}
          {user?.isSuperAdmin && (
            <>
              <KpiCard label="Team members" value={kpis?.teamSize ?? "…"} />
              <KpiCard
                label="Total users"
                value={platformKpis?.totalUsers ?? "…"}
              />
              {(() => {
                const m = metric("newReviews");
                return (
                  <KpiCard
                    label="New reviews (7d)"
                    value={m?.current ?? "…"}
                    direction={m?.direction}
                    deltaPct={m?.deltaPct}
                  />
                );
              })()}
              {(() => {
                const m = metric("newBookings");
                return (
                  <KpiCard
                    label="New bookings (7d)"
                    value={m?.current ?? "…"}
                    direction={m?.direction}
                    deltaPct={m?.deltaPct}
                  />
                );
              })()}
            </>
          )}
        </div>
      </section>

      {/* 2. Why does it matter? — What's Happening */}
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">
          What&apos;s Happening
        </h2>
        <Panel>
          {!overview ? (
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <BrandLoader size="sm" />
              Loading…
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {overview.insights.map((insight, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200"
                >
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600"
                    aria-hidden
                  />
                  {insight}
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <div className="grid gap-3 sm:grid-cols-2">
          <Panel
            title="Top places by engagement"
            action={
              <Link
                href="/admin/analytics"
                className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
              >
                Full analytics →
              </Link>
            }
          >
            {!overview ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <BrandLoader size="sm" />
                Loading…
              </div>
            ) : overview.topPlaces.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No activity recorded yet — views, saves, and bookings will show
                up here.
              </p>
            ) : (
              <TopPlacesChart places={overview.topPlaces} />
            )}
          </Panel>

          {user?.isSuperAdmin ? (
            <Panel title="Bookings by status">
              {platformKpis ? (
                <BookingStatusBar counts={platformKpis.bookingsByStatus} />
              ) : (
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <BrandLoader size="sm" />
                  Loading…
                </div>
              )}
            </Panel>
          ) : (
            <Panel title="Getting no attention">
              {!overview ? (
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <BrandLoader size="sm" />
                  Loading…
                </div>
              ) : overview.neglectedPlaces.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Every place got at least one view this period.
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {overview.neglectedPlaces.map((p) => (
                    <li key={p.placeId}>
                      <Link
                        href={`/places/${p.slug}`}
                        target="_blank"
                        className="text-sm text-slate-700 hover:text-brand-700 dark:hover:text-brand-300 hover:underline dark:text-slate-200"
                      >
                        {p.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}
        </div>
      </section>

      {/* 3. What can I do about it? — Needs Attention */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
            Needs Attention
            {needsAttentionTotal > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                {needsAttentionTotal}
              </span>
            )}
          </h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Open items that may need an admin decision.
          </p>
        </div>
        {!queue ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"><BrandLoader size="sm" /> Loading…</div>
        ) : needsAttentionTotal === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            All clear — nothing pending review right now.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <NeedsAttentionCard
              label="Pending places"
              count={queue.pendingPlaces.length}
              href="/admin/content/moderation"
              icon={MapIcon}
            />
            <NeedsAttentionCard
              label="Pending business claims"
              count={queue.pendingBusinesses.length}
              href="/admin/content/moderation"
              icon={ClipboardDocumentListIcon}
            />
            <NeedsAttentionCard
              label="Pending advertisements"
              count={queue.pendingAdvertisements.length}
              href="/admin/content/moderation"
              icon={MegaphoneIcon}
            />
            <NeedsAttentionCard
              label="Pending events"
              count={queue.pendingEvents.length}
              href="/admin/content/moderation"
              icon={CalendarDaysIcon}
            />
            <NeedsAttentionCard
              label="Flagged reviews & events"
              count={queue.flaggedContent.length}
              href="/admin/content/moderation"
              icon={ExclamationTriangleIcon}
            />
            <NeedsAttentionCard
              label="Possibly closed places"
              count={queue.possiblyClosedPlaces.length}
              href="/admin/content/reports"
              icon={MapPinIcon}
            />
            {user?.isSuperAdmin && (
              <NeedsAttentionCard
                label="Failed logins (24h)"
                count={securityOverview?.failedLoginsLast24h ?? 0}
                href="/admin/security/alerts"
                icon={ShieldExclamationIcon}
              />
            )}
          </div>
        )}
      </section>

      {/* 4. Recent Activity */}
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">
          Recent Activity
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Panel title="Recent reviews">
            {!queue ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <BrandLoader size="sm" />
                Loading…
              </div>
            ) : queue.recentReviews.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No reviews yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {queue.recentReviews.slice(0, 5).map((review) => (
                  <li
                    key={review.id}
                    className="rounded-lg border border-slate-200 p-2.5 text-sm dark:border-slate-800"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-slate-900 dark:text-slate-50">
                        {review.user?.name ?? "A guest"}
                      </p>
                      <p className="flex items-center gap-0.5 text-slate-500 dark:text-slate-400">
                        {review.overallRating.toFixed(1)}
                        <StarIcon
                          aria-hidden
                          className="h-3.5 w-3.5 text-gold-500"
                        />
                      </p>
                    </div>
                    {review.comment && (
                      <p className="mt-0.5 truncate text-slate-600 dark:text-slate-300">
                        {review.comment}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {user?.isSuperAdmin && (
            <Panel
              title="Recent admin actions"
              action={
                <Link
                  href="/admin/audit-log"
                  className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
                >
                  Full log →
                </Link>
              }
            >
              {!recentActions ? (
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <BrandLoader size="sm" />
                  Loading…
                </div>
              ) : recentActions.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No admin actions recorded yet.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {recentActions.map((action) => (
                    <li key={action.id} className="text-sm">
                      <p className="text-slate-800 dark:text-slate-100">
                        <span className="font-medium">
                          {action.adminUser.name}
                        </span>{" "}
                        <span className="text-slate-500 dark:text-slate-400">
                          {action.action.replace(/_/g, " ")}
                        </span>
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-400">
                        {new Date(action.createdAt).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}
        </div>
      </section>
    </div>
  );
}

function NeedsAttentionCard({
  label,
  count,
  href,
  icon: Icon,
}: {
  label: string;
  count: number;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}) {
  if (count === 0) return null;
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/40 p-3 transition-colors hover:border-amber-400 dark:border-amber-800 dark:bg-amber-900/20"
    >
      <div className="flex items-center gap-2.5">
        <Icon
          aria-hidden
          className="h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300"
        />
        <div>
          <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-50">
            {count}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300">{label}</p>
        </div>
      </div>
      <ArrowRightIcon
        aria-hidden
        className="h-4 w-4 shrink-0 text-amber-700 opacity-0 transition-opacity group-hover:opacity-100 dark:text-amber-300"
      />
    </Link>
  );
}

// A launchpad into every management surface a real admin panel needs to
// get to fast — driven by the same admin-nav.ts the sidebar uses, so it
// can never drift out of sync with what's actually in the IA (or with
// what this user can actually see).
function QuickActions() {
  const { user } = useAuth();
  const groups = visibleAdminNav(user).filter((g) => g.id !== "dashboard");

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 border-l-4 border-brand-700 pl-3 text-2xl font-extrabold tracking-tight text-slate-950 dark:border-brand-400 dark:text-slate-50 sm:text-3xl">
            Manage Liberia360
          </h2>
          <p className="mt-1 pl-4 text-sm text-slate-500 dark:text-slate-400 sm:text-base">
            Jump into the workspace you need.
          </p>
        </div>
        <Link
          href="/admin/analytics"
          aria-label="Open analytics"
          className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-brand-800 shadow-sm hover:border-brand-300 hover:bg-brand-50 dark:border-slate-800 dark:bg-slate-900 dark:text-brand-300 dark:hover:bg-slate-800"
        >
          <ChartBarIcon aria-hidden className="h-7 w-7" />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {groups.map((group) => {
          const Icon = group.icon;
          const href = group.href ?? group.items?.[0]?.href ?? "/admin";
          return (
            <Link
              key={group.id}
              href={href}
              className="group flex min-h-36 flex-col justify-between rounded-[1.45rem] border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(8,26,80,0.08)] transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-[0_14px_30px_rgba(8,26,80,0.12)] dark:border-slate-800 dark:bg-slate-900 sm:min-h-40 sm:p-5"
            >
              <span className="flex items-start justify-between gap-2">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-800 group-hover:bg-brand-100 dark:bg-brand-950/60 dark:text-brand-300 dark:group-hover:bg-brand-900/60">
                  <Icon aria-hidden className="h-8 w-8" />
                </span>
                <ChevronRightIcon
                  aria-hidden
                  className="mt-1 h-5 w-5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-700 dark:text-slate-500 dark:group-hover:text-brand-300"
                />
              </span>
              <span className="mt-4 min-w-0">
                <span className="block text-base font-bold leading-tight text-slate-950 dark:text-slate-50 sm:text-lg">
                  {group.label}
                </span>
                <span className="mt-1 block truncate text-sm text-slate-500 dark:text-slate-400">
                  {group.items ? `${group.items.length} sections` : "Overview"}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// Ranked magnitude across places → a single-hue horizontal bar chart, not a
// categorical one (this is one measure compared across items, not identity).
// Value sits at the tip per the bar's own end, never crammed inside a short
// bar. See the dataviz skill: ≤24px thick, 4px rounded tip, square origin.
function TopPlacesChart({
  places,
}: {
  places: AnalyticsOverview["topPlaces"];
}) {
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
              className="group -mx-1 flex items-center gap-3 rounded-lg px-1 py-0.5 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <span className="w-32 shrink-0 truncate text-sm text-slate-700 group-hover:text-brand-700 dark:group-hover:text-brand-300 dark:hover:text-brand-300 dark:text-slate-200 sm:w-44">
                {place.name}
              </span>
              <span className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <span
                  className="block h-full rounded-l-none rounded-r bg-brand-600"
                  style={{ width: `${pct}%` }}
                />
              </span>
              <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300">
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
function BookingStatusBar({
  counts,
}: {
  counts: Record<BookingStatus, number>;
}) {
  const total = BOOKING_STATUS_META.reduce(
    (sum, s) => sum + (counts[s.key] ?? 0),
    0,
  );

  if (total === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        No bookings yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex h-4 w-full gap-0.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
        role="img"
        aria-label="Bookings by status"
      >
        {BOOKING_STATUS_META.filter((s) => (counts[s.key] ?? 0) > 0).map(
          (s) => (
            <div
              key={s.key}
              style={{
                width: `${((counts[s.key] ?? 0) / total) * 100}%`,
                backgroundColor: s.color,
              }}
              title={`${formatBookingStatus(s.key)}: ${counts[s.key]}`}
            />
          ),
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {BOOKING_STATUS_META.map((s) => (
          <div
            key={s.key}
            className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300"
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: s.color }}
              aria-hidden
            />
            {formatBookingStatus(s.key)}
            <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-50">
              {counts[s.key] ?? 0}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
