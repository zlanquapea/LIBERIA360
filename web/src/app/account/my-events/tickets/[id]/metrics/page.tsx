"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeftIcon,
  BanknotesIcon,
  CheckBadgeIcon,
  ChartBarIcon,
  TicketIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "@/hooks/useAuth";
import { BrandLoader } from "@/components/BrandLoader";
import { getEvent } from "@/lib/api";
import { getEventAnalytics } from "@/lib/analytics-api";
import { getEventTicketMetrics } from "@/lib/event-ticket-api";
import { HttpError } from "@/lib/http";
import type { Event, EventTicketMetrics, TicketTypeMetrics } from "@/lib/types";

function formatMoney(currency: string, amount: string | number) {
  return `${currency} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// A simple ASCII/CSS progress bar for "X of Y sold" — no chart library
// needed for one number.
function SalesProgressBar({ percent }: { percent: number | null }) {
  const clamped = percent == null ? 0 : Math.min(100, Math.max(0, percent));
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
      role="progressbar"
      aria-valuenow={percent ?? undefined}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-brand-600 transition-[width]"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof ChartBarIcon;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        <Icon aria-hidden className="h-4 w-4" /> {label}
      </p>
      <p className="mt-1.5 text-2xl font-black text-slate-900 dark:text-slate-50">
        {value}
      </p>
    </div>
  );
}

const SOLD_OUT_LABEL: Record<TicketTypeMetrics["soldOutState"], string | null> = {
  available: null,
  almost_sold_out: "Almost Sold Out",
  sold_out: "Sold Out",
};

function TicketTypeCard({
  type,
  currency,
}: {
  type: TicketTypeMetrics;
  currency: string;
}) {
  const badge = SOLD_OUT_LABEL[type.soldOutState];
  return (
    <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
      <div className="flex items-center justify-between gap-2">
        <p className="text-base font-bold text-slate-900 dark:text-slate-50">
          {type.name}
        </p>
        {badge && (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
              type.soldOutState === "sold_out"
                ? "bg-flag-500/10 text-flag-700 dark:text-flag-300"
                : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
            }`}
          >
            {badge}
          </span>
        )}
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        <div>
          <dt className="text-xs text-slate-500 dark:text-slate-400">Sold</dt>
          <dd className="font-semibold text-slate-900 dark:text-slate-50">
            {type.sold}
            {type.totalAvailable != null ? ` of ${type.totalAvailable}` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500 dark:text-slate-400">
            Remaining
          </dt>
          <dd className="font-semibold text-slate-900 dark:text-slate-50">
            {type.remaining ?? "Unlimited"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500 dark:text-slate-400">
            Revenue
          </dt>
          <dd className="font-semibold text-slate-900 dark:text-slate-50">
            {formatMoney(currency, type.revenue)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500 dark:text-slate-400">
            Checked In
          </dt>
          <dd className="font-semibold text-slate-900 dark:text-slate-50">
            {type.checkedIn} · {type.notCheckedIn} not yet
          </dd>
        </div>
      </dl>
      {type.percentSold != null && (
        <div className="mt-3">
          <SalesProgressBar percent={type.percentSold} />
          <p className="mt-1 text-right text-xs font-semibold text-slate-500 dark:text-slate-400">
            {type.percentSold}%
          </p>
        </div>
      )}
      {type.cancelled > 0 && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {type.cancelled} cancelled ticket{type.cancelled === 1 ? "" : "s"} —
          not counted as sold.
        </p>
      )}
    </div>
  );
}

const NAV_SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "ticket-types", label: "Ticket Types" },
  { id: "revenue", label: "Revenue" },
  { id: "orders", label: "Orders" },
  { id: "attendance", label: "Attendance" },
];

export default function EventTicketMetricsPage() {
  const params = useParams<{ id: string }>();
  const { token, ready, user } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [metrics, setMetrics] = useState<EventTicketMetrics | null>(null);
  const [pageViews, setPageViews] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token || !params.id) return;
    setLoading(true);
    setError(null);
    try {
      const [eventData, metricsData, analytics] = await Promise.all([
        getEvent(params.id),
        getEventTicketMetrics(token, params.id),
        // Page views/interested/going aren't part of the ticket-metrics
        // payload (that's sales performance, not discovery) — pulled in
        // here so this one Insights page still answers "is anyone finding
        // this event?" without a second destination to visit.
        getEventAnalytics(token, params.id).catch(() => null),
      ]);
      setEvent(eventData);
      setMetrics(metricsData);
      setPageViews(analytics?.totals.view ?? null);
    } catch (err) {
      setError(
        err instanceof HttpError ? err.message : "Unable to load insights.",
      );
    } finally {
      setLoading(false);
    }
  }, [token, params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!ready)
    return (
      <main className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-4">
        <BrandLoader />
        <p className="text-sm font-medium tracking-wide text-slate-500 dark:text-slate-400">Loading…</p>
      </main>
    );
  if (!user)
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 text-center">
        <h1 className="text-xl font-bold">Insights</h1>
        <p className="mt-2 text-sm text-slate-500">Log in to continue.</p>
        <Link
          href="/login"
          className="mt-4 inline-block rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Log in
        </Link>
      </main>
    );

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-8">
      <div>
        <Link
          href={`/account/my-events/tickets/${params.id}`}
          className="text-sm text-brand-700 hover:underline dark:text-brand-300"
        >
          ← Manage Event
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-slate-50">
          <ChartBarIcon aria-hidden className="h-6 w-6 text-brand-700 dark:text-brand-300" />
          Insights
        </h1>
        {event && (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {event.name}
          </p>
        )}
      </div>

      {event && (pageViews != null || event.interestedCount != null) && (
        <div className="flex flex-wrap gap-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
          {pageViews != null && (
            <span>
              <strong className="text-slate-900 dark:text-slate-50">{pageViews}</strong> views
            </span>
          )}
          <span>
            <strong className="text-slate-900 dark:text-slate-50">{event.interestedCount}</strong> interested
          </span>
          <span>
            <strong className="text-slate-900 dark:text-slate-50">{event.goingCount}</strong> going
          </span>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700 dark:text-flag-300"
        >
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Loading insights…
        </p>
      ) : metrics ? (
        <>
          {/* Section jump-links — a flat scrolling page beats a full tab
              router here: the whole dashboard is still one URL, and the
              most important numbers (Overview) are already the first
              thing on screen without clicking anything. */}
          <nav
            aria-label="Insights sections"
            className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
          >
            {NAV_SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="shrink-0 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-brand-400 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-brand-300"
              >
                {section.label}
              </a>
            ))}
          </nav>

          <section id="overview" className="scroll-mt-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Overview
            </h2>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {metrics.isFreeEvent ? (
                <>
                  <StatCard
                    label="Registrations"
                    value={String(metrics.freeEvent?.totalRegistrations ?? 0)}
                    icon={UsersIcon}
                  />
                  <StatCard
                    label="Remaining Capacity"
                    value={
                      metrics.freeEvent?.remainingCapacity != null
                        ? String(metrics.freeEvent.remainingCapacity)
                        : "Unlimited"
                    }
                    icon={TicketIcon}
                  />
                  <StatCard
                    label="Registration Rate"
                    value={
                      metrics.freeEvent?.registrationRatePercent != null
                        ? `${metrics.freeEvent.registrationRatePercent}%`
                        : "—"
                    }
                    icon={ChartBarIcon}
                  />
                </>
              ) : (
                <>
                  <StatCard
                    label="Tickets Sold"
                    value={String(metrics.overview.totalTicketsSold)}
                    icon={TicketIcon}
                  />
                  <StatCard
                    label="Tickets Remaining"
                    value={
                      metrics.overview.totalTicketsRemaining != null
                        ? String(metrics.overview.totalTicketsRemaining)
                        : "Unlimited"
                    }
                    icon={TicketIcon}
                  />
                  <StatCard
                    label="Total Revenue"
                    value={formatMoney(metrics.currency, metrics.overview.totalRevenue)}
                    icon={BanknotesIcon}
                  />
                  <StatCard
                    label="Total Orders"
                    value={String(metrics.overview.totalOrders)}
                    icon={UsersIcon}
                  />
                  <StatCard
                    label="Checked In"
                    value={String(metrics.overview.totalCheckedIn)}
                    icon={CheckBadgeIcon}
                  />
                  <StatCard
                    label="Attendees Expected"
                    value={String(metrics.overview.totalAttendeesExpected)}
                    icon={UsersIcon}
                  />
                </>
              )}
            </div>
          </section>

          {!metrics.isFreeEvent && (
            <>
              <section id="ticket-types" className="scroll-mt-4">
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Ticket Types
                </h2>
                <div className="mt-2 flex flex-col gap-3">
                  {metrics.byTicketType.map((type) => (
                    <TicketTypeCard
                      key={type.ticketTypeId ?? "general"}
                      type={type}
                      currency={metrics.currency}
                    />
                  ))}
                </div>
              </section>

              <section id="revenue" className="scroll-mt-4">
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Revenue
                </h2>
                <div className="mt-2 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">
                      Gross Revenue
                    </span>
                    <span className="font-bold text-slate-900 dark:text-slate-50">
                      {formatMoney(metrics.currency, metrics.revenue.gross)}
                    </span>
                  </div>
                  {(Number(metrics.revenue.platformFees) > 0 ||
                    Number(metrics.revenue.refunds) > 0) && (
                    <>
                      {Number(metrics.revenue.platformFees) > 0 && (
                        <div className="mt-1.5 flex items-center justify-between text-sm">
                          <span className="text-slate-500 dark:text-slate-400">
                            Platform Fees
                          </span>
                          <span className="text-slate-700 dark:text-slate-300">
                            −{formatMoney(metrics.currency, metrics.revenue.platformFees)}
                          </span>
                        </div>
                      )}
                      {Number(metrics.revenue.refunds) > 0 && (
                        <div className="mt-1.5 flex items-center justify-between text-sm">
                          <span className="text-slate-500 dark:text-slate-400">
                            Refunds
                          </span>
                          <span className="text-slate-700 dark:text-slate-300">
                            −{formatMoney(metrics.currency, metrics.revenue.refunds)}
                          </span>
                        </div>
                      )}
                      <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 text-sm dark:border-slate-700">
                        <span className="font-semibold text-slate-900 dark:text-slate-50">
                          Net Revenue
                        </span>
                        <span className="font-bold text-slate-900 dark:text-slate-50">
                          {formatMoney(metrics.currency, metrics.revenue.net)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </section>

              <section id="orders" className="scroll-mt-4">
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Orders
                </h2>
                <dl className="mt-2 grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 p-4 text-sm dark:border-slate-800 sm:grid-cols-4">
                  <div>
                    <dt className="text-xs text-slate-500 dark:text-slate-400">Total Orders</dt>
                    <dd className="text-lg font-bold text-slate-900 dark:text-slate-50">
                      {metrics.orders.totalOrders}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500 dark:text-slate-400">Tickets Sold</dt>
                    <dd className="text-lg font-bold text-slate-900 dark:text-slate-50">
                      {metrics.orders.totalTicketsSold}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500 dark:text-slate-400">Avg. Tickets / Order</dt>
                    <dd className="text-lg font-bold text-slate-900 dark:text-slate-50">
                      {metrics.orders.averageTicketsPerOrder}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500 dark:text-slate-400">Largest Order</dt>
                    <dd className="text-lg font-bold text-slate-900 dark:text-slate-50">
                      {metrics.orders.largestOrderQuantity}
                    </dd>
                  </div>
                </dl>
                {metrics.orders.multiTypeOrders > 0 && (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {metrics.orders.multiTypeOrders} order
                    {metrics.orders.multiTypeOrders === 1 ? "" : "s"} contained
                    more than one ticket type.
                  </p>
                )}
              </section>

              <section id="attendance" className="scroll-mt-4">
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Attendance
                </h2>
                <div className="mt-2 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <dl className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-slate-400">Sold</dt>
                      <dd className="text-lg font-bold text-slate-900 dark:text-slate-50">
                        {metrics.attendance.ticketsSold}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-slate-400">Checked In</dt>
                      <dd className="text-lg font-bold text-slate-900 dark:text-slate-50">
                        {metrics.attendance.checkedIn}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-slate-400">Not Yet</dt>
                      <dd className="text-lg font-bold text-slate-900 dark:text-slate-50">
                        {metrics.attendance.notCheckedIn}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-3">
                    <SalesProgressBar percent={metrics.attendance.checkInRatePercent} />
                    <p className="mt-1 text-right text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {metrics.attendance.checkInRatePercent}% checked in
                    </p>
                  </div>
                </div>
              </section>
            </>
          )}
        </>
      ) : null}
    </main>
  );
}
