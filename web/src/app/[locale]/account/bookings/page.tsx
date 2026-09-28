"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import {
  getBusinessBookings,
  getCarListingOwnerBookings,
  getCreatorBookings,
  getMyBookings,
} from "@/lib/booking-api";
import { getMyBusinesses } from "@/lib/business-api";
import { getMyCreatorProfile } from "@/lib/creator-api";
import { getMyCarListings } from "@/lib/car-rentals-api";
import { getMyGuideBookings, type GuideBookingSummary } from "@/lib/guides-api";
import {
  BookingDetailModal,
  StatusBadge,
  counterpartName,
  type SelectedBooking,
} from "@/components/booking-ui";
import {
  CalendarDaysIcon,
  ArrowUpRightIcon,
  MagnifyingGlassIcon,
  TicketIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import { formatBookingWhen } from "@/lib/format";
import { BrandLoader } from "@/components/BrandLoader";
import type { Booking, Business, CarListing, Creator } from "@/lib/types";

// "My Bookings" (Tech Spec §3.3) — client-only, same reasoning as
// /trips: JWT auth lives in localStorage, so a server component can't
// know who's asking. Three independent sections on one page since a user
// can be a guest (requests they sent), a business owner, and/or a
// creator (requests either has received) all at once — the account
// model doesn't distinguish "roles", so neither does this page.
//
// Each list renders compact rows only (product feedback, Aug 2026: "don't
// put the messaging and the booking on that one page to make things
// long") — the full detail, the confirm/decline or cancel action, and the
// message thread all live in one BookingDetailModal opened by clicking a
// row, so a page with many bookings stays a short scannable list instead
// of a wall of inline forms and chat threads.
export default function BookingsPage() {
  const { user, token, ready } = useAuth();
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [creator, setCreator] = useState<Creator | null>(null);
  const [carListings, setCarListings] = useState<CarListing[]>([]);
  const [incoming, setIncoming] = useState<Record<string, Booking[]>>({});
  const [incomingCreator, setIncomingCreator] = useState<Booking[]>([]);
  const [incomingCarListings, setIncomingCarListings] = useState<Booking[]>([]);
  const [guideBookings, setGuideBookings] = useState<GuideBookingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"mine" | "hosting">("mine");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<SelectedBooking | null>(null);

  const reloadMine = useCallback(() => {
    if (!token) return;
    getMyBookings(token).then(setMyBookings);
  }, [token]);

  const reloadIncoming = useCallback(
    (businessId: string) => {
      if (!token) return;
      getBusinessBookings(token, businessId).then((bookings) =>
        setIncoming((prev) => ({ ...prev, [businessId]: bookings })),
      );
    },
    [token],
  );

  const reloadIncomingCreator = useCallback(() => {
    if (!token || !creator) return;
    getCreatorBookings(token, creator.id).then(setIncomingCreator);
  }, [token, creator]);

  const reloadIncomingCarListings = useCallback(() => {
    if (!token) return;
    getCarListingOwnerBookings(token).then(setIncomingCarListings);
  }, [token]);

  useEffect(() => {
    if (!ready || !token) {
      if (ready) setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    Promise.all([
      getMyBookings(token),
      getMyBusinesses(token),
      getMyCreatorProfile(token),
      getMyCarListings(token),
      getMyGuideBookings(token),
    ])
      .then(
        async ([
          bookings,
          myBusinesses,
          myCreator,
          myCarListings,
          myGuideBookings,
        ]) => {
          if (cancelled) return;
          setMyBookings(bookings);
          setBusinesses(myBusinesses);
          setCreator(myCreator);
          setCarListings(myCarListings);
          setGuideBookings(myGuideBookings);
          const entries = await Promise.all(
            myBusinesses.map(
              async (b) =>
                [b.id, await getBusinessBookings(token, b.id)] as const,
            ),
          );
          const creatorBookings = myCreator
            ? await getCreatorBookings(token, myCreator.id)
            : [];
          const carListingBookings =
            myCarListings.length > 0
              ? await getCarListingOwnerBookings(token)
              : [];
          if (!cancelled) {
            setIncoming(Object.fromEntries(entries));
            setIncomingCreator(creatorBookings);
            setIncomingCarListings(carListingBookings);
            setLoading(false);
          }
        },
      )
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ready, token, attempt]);

  if (!ready || loading) {
    return (
      <main className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-4">
        <BrandLoader />
        <p className="text-sm font-medium tracking-wide text-slate-500 dark:text-slate-400">
          Loading…
        </p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-10 text-center">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">
          My Bookings
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Log in to see your booking requests.
        </p>
        <Link
          href="/login"
          className="mx-auto rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
        >
          Log in
        </Link>
      </main>
    );
  }

  const hosting = [
    ...businesses.flatMap((business) =>
      (incoming[business.id] ?? []).map((booking) => ({
        booking,
        reload: () => reloadIncoming(business.id),
      })),
    ),
    ...incomingCreator.map((booking) => ({
      booking,
      reload: reloadIncomingCreator,
    })),
    ...incomingCarListings.map((booking) => ({
      booking,
      reload: reloadIncomingCarListings,
    })),
  ];
  const rows =
    view === "mine"
      ? myBookings.map((booking) => ({ booking, reload: reloadMine }))
      : hosting;
  const guides = view === "mine" ? guideBookings : [];
  const all = [...rows.map(({ booking }) => booking), ...guides];
  const matches = (status: string, title: string) =>
    (filter === "all" || status === filter) &&
    title.toLowerCase().includes(query.trim().toLowerCase());
  const visible = rows.filter(({ booking }) =>
    matches(booking.status, counterpartName(booking, view === "hosting")),
  );
  const visibleGuides = guides.filter((booking) =>
    matches(booking.status, booking.experience.title),
  );
  const hasHosting =
    businesses.length > 0 || !!creator || carListings.length > 0;

  return (
    <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 sm:px-6 sm:pt-10">
      <header className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-teal-950 via-teal-900 to-teal-700 p-6 text-white sm:p-9">
        <div
          aria-hidden
          className="absolute -right-16 -top-24 h-64 w-64 rounded-full border-[35px] border-white/5"
        />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-teal-200">
              Your plans, in one place
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
              Bookings
            </h1>
            <p className="mt-3 max-w-sm text-sm leading-6 text-teal-100">
              A little less planning. A lot more exploring.
            </p>
          </div>
          <CalendarDaysIcon
            aria-hidden
            className="h-10 w-10 shrink-0 text-teal-200"
          />
        </div>
        <Link
          href="/explore"
          className="relative mt-6 inline-flex min-h-11 items-center gap-3 rounded-full bg-white px-5 text-sm font-bold text-teal-950 transition hover:bg-teal-50"
        >
          Discover somewhere new{" "}
          <ArrowUpRightIcon aria-hidden className="h-4 w-4" />
        </Link>
      </header>

      {hasHosting && (
        <div
          className="mt-6 flex rounded-2xl bg-slate-100 p-1.5 dark:bg-slate-900"
          aria-label="Booking view"
        >
          {(
            [
              ["mine", "My bookings"],
              ["hosting", "Hosting"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={view === key}
              onClick={() => {
                setView(key);
                setFilter("all");
                setQuery("");
              }}
              className={`min-h-12 flex-1 rounded-xl text-sm font-bold transition ${view === key ? "bg-white text-teal-900 shadow-sm dark:bg-slate-800 dark:text-teal-200" : "text-slate-500 dark:text-slate-400"}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="my-6 grid grid-cols-3 gap-3">
        {[
          ["All bookings", all.length],
          ["Confirmed", all.filter((b) => b.status === "confirmed").length],
          ["Pending", all.filter((b) => b.status === "pending").length],
        ].map(([label, count]) => (
          <div
            key={label}
            className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <p className="text-2xl font-bold tracking-tight text-teal-900 dark:text-teal-200">
              {error ? "—" : count}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {label}
            </p>
          </div>
        ))}
      </div>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold tracking-tight">
          {view === "mine" ? "Your reservations" : "Guest requests"}
        </h2>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900">
          <MagnifyingGlassIcon aria-hidden className="h-5 w-5 text-slate-400" />
          <input
            aria-label="Search bookings"
            placeholder="Search bookings"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-h-11 min-w-0 w-full bg-transparent text-sm outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          />
        </div>
      </div>
      <div
        className="mb-6 flex gap-2 overflow-x-auto pb-2"
        aria-label="Filter by booking status"
      >
        {["all", "pending", "confirmed", "declined", "cancelled"].map(
          (status) => (
            <button
              key={status}
              type="button"
              aria-pressed={filter === status}
              onClick={() => setFilter(status)}
              className={`min-h-11 shrink-0 rounded-full px-5 text-sm font-semibold capitalize transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500 ${filter === status ? "bg-teal-900 text-white dark:bg-teal-300 dark:text-teal-950" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300"}`}
            >
              {status === "all" ? "All bookings" : status}
            </button>
          ),
        )}
      </div>
      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950"
        >
          <p>We couldn’t load your bookings. Please try again.</p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="mt-3 min-h-11 rounded-full bg-amber-950 px-5 text-sm font-bold text-white"
          >
            Try again
          </button>
        </div>
      ) : visible.length + visibleGuides.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900">
          <TicketIcon
            aria-hidden
            className="mx-auto mb-4 h-12 w-12 text-teal-600"
          />
          <h3 className="text-lg font-bold">
            {all.length
              ? "No matching bookings"
              : view === "hosting"
                ? "Ready for your first guest"
                : "Your next adventure starts here"}
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">
            {all.length
              ? "Try another status or search to find your reservation."
              : view === "hosting"
                ? "Requests for your listings will appear here when guests book."
                : "Find a place, meet a local guide, or plan your next experience."}
          </p>
          {all.length ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setFilter("all");
              }}
              className="mt-5 min-h-11 px-4 font-semibold text-teal-700 dark:text-teal-300"
            >
              Clear filters
            </button>
          ) : (
            view === "mine" && (
              <Link
                href="/explore"
                className="mt-5 inline-flex min-h-11 items-center rounded-full bg-teal-900 px-6 text-sm font-bold text-white"
              >
                Explore Liberia
              </Link>
            )
          )}
        </section>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {visible.map(({ booking, reload }) => (
            <li key={booking.id}>
              <button
                type="button"
                onClick={() =>
                  setSelected({
                    booking,
                    showGuest: view === "hosting",
                    canRespond:
                      view === "hosting" && booking.status === "pending",
                    canCancel:
                      view === "mine" &&
                      ["pending", "confirmed"].includes(booking.status),
                    onCancelled: () => {
                      reload();
                      setSelected(null);
                    },
                    onResponded: () => {
                      reload();
                      setSelected(null);
                    },
                  })
                }
                className="group flex h-full w-full flex-col rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-teal-400 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500 dark:border-slate-800 dark:bg-slate-900"
              >
                <span className="mb-5 flex w-full items-center justify-between gap-2">
                  <span className="rounded-xl bg-teal-50 p-3 text-teal-700 dark:bg-teal-950 dark:text-teal-200">
                    <CalendarDaysIcon aria-hidden className="h-6 w-6" />
                  </span>
                  <StatusBadge status={booking.status} />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  {booking.carListing
                    ? "Car rental"
                    : booking.creator
                      ? "Creator booking"
                      : "Reservation"}
                </span>
                <strong className="mt-1 break-words text-lg tracking-tight">
                  {counterpartName(booking, view === "hosting")}
                </strong>
                <span className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  {formatBookingWhen(
                    booking.requestedDate,
                    booking.requestedEndDate,
                    booking.rentalUnit,
                    booking.requestedStartTime,
                    booking.requestedEndTime,
                  )}
                </span>
                {booking.partySize && (
                  <span className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                    <UsersIcon aria-hidden className="h-4 w-4" />
                    {booking.partySize} guests
                  </span>
                )}
                <span className="mt-auto w-full pt-5">
                  <span className="flex items-center justify-between border-t border-slate-100 pt-4 text-sm font-semibold text-teal-800 dark:border-slate-800 dark:text-teal-200">
                    Details & messages{" "}
                    <ArrowUpRightIcon aria-hidden className="h-4 w-4" />
                  </span>
                </span>
              </button>
            </li>
          ))}
          {visibleGuides.map((booking) => (
            <li
              key={booking.id}
              className="flex flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="mb-5 flex items-center justify-between gap-2">
                <span className="rounded-xl bg-amber-50 p-3 text-amber-700 dark:bg-amber-950">
                  <TicketIcon aria-hidden className="h-6 w-6" />
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize dark:bg-slate-800">
                  {booking.status}
                </span>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Guide experience
              </p>
              <h3 className="mt-1 text-lg font-bold tracking-tight">
                {booking.experience.title}
              </h3>
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                {booking.requestedDate} · {booking.groupSize} guests
              </p>
              <p className="mt-2 text-sm font-semibold">
                ${Number(booking.priceUsdSnapshot).toFixed(2)}{" "}
                <span className="font-normal text-slate-500">
                  · {booking.paymentStatus}
                </span>
              </p>
              <Link
                href={`/experiences/${booking.experience.id}`}
                className="mt-5 flex min-h-11 items-center justify-between border-t border-slate-100 pt-4 text-sm font-semibold text-teal-800 dark:border-slate-800 dark:text-teal-200"
              >
                View experience{" "}
                <ArrowUpRightIcon aria-hidden className="h-4 w-4" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {selected && token && (
        <BookingDetailModal
          selected={selected}
          token={token}
          onClose={() => setSelected(null)}
        />
      )}
    </main>
  );
}
