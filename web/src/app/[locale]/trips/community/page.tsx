"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { getPublicTrips } from "@/lib/itinerary-api";
import { getFriendlyErrorMessage } from "@/lib/errors";
import { PublicTripCard } from "@/components/PublicTripCard";
import { BrandLoader } from "@/components/BrandLoader";
import type { PublicTripSummary } from "@/lib/types";

// "Trips You Can Join" (Sections 5 & 17 of the Aug 2026 social-trip spec)
// — public trips discoverable by anyone, signed in or not, beyond just
// their creator's own profile. Client-only for the same reason /trips is:
// no server-side auth to key a server component off of, though this page
// itself needs none — GET /itineraries/public is always unauthenticated.
export default function CommunityTripsPage() {
  const t = useTranslations("trips");
  const tCommon = useTranslations("common");
  const [trips, setTrips] = useState<PublicTripSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [filter, setFilter] = useState<"all" | "hosted" | "free" | "paid">(
    "all",
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    getPublicTrips({
      limit: 40,
      ...(filter === "hosted" ? { hosted: true } : {}),
      ...(filter === "free" || filter === "paid" ? { price: filter } : {}),
    })
      .then((page) => {
        if (!cancelled) setTrips(page.data);
      })
      .catch((err) => {
        if (!cancelled)
          setLoadError(
            getFriendlyErrorMessage(err, {
              context: { action: "load-public-trips" },
            }),
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken, filter]);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">
            {t("groupTripsTitle")}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t("groupTripsSubtitle")}{" "}
            <Link
              href="/trips/new"
              className="font-medium text-brand-700 dark:text-brand-300 hover:underline"
            >
              {t("buildYourOwn")}
            </Link>
            .
          </p>
        </div>
        <Link
          href="/trips"
          className="text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline"
        >
          {t("myTripsLink")} →
        </Link>
      </div>

      <div
        role="group"
        aria-label={t("groupTripsTitle")}
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
      >
        {(
          [
            ["all", t("filterAllTrips")],
            ["hosted", t("filterOrganised")],
            ["free", t("filterFree")],
            ["paid", t("filterPaid")],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition ${
              filter === key
                ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                : "border border-slate-300 text-slate-700 hover:border-brand-500 dark:border-slate-700 dark:text-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center dark:border-slate-700">
          <BrandLoader />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            {tCommon("loading")}
          </p>
        </div>
      ) : loadError ? (
        <div
          role="alert"
          className="rounded-lg bg-flag-500/10 px-3 py-3 text-sm text-flag-700 dark:text-flag-300"
        >
          <p>{loadError}</p>
          <button
            type="button"
            onClick={() => setReloadToken((value) => value + 1)}
            className="mt-3 min-h-11 rounded-full border border-flag-300 px-4 font-semibold text-flag-700 hover:bg-flag-500/10 dark:text-flag-300"
          >
            {tCommon("tryAgain")}
          </button>
        </div>
      ) : trips.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-8 text-center text-slate-500 dark:text-slate-400">
          {t("noPublicTrips")}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip) => (
            <PublicTripCard key={trip.id} trip={trip} />
          ))}
        </div>
      )}
    </main>
  );
}
