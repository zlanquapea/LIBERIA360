"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowDownTrayIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import {
  getOfflinePackSummary,
  offlinePacksSupported,
  removeOfflinePack,
  saveOfflinePack,
  type OfflinePackSummary,
} from "@/lib/offline-packs";
import type { ItineraryDetail } from "@/lib/types";

// Explicitly download a trip to use without a connection. Shows when it
// was downloaded, lets the traveler refresh or remove it, and says plainly
// what still needs a connection.
export function OfflinePackControl({
  trip,
  onReadyChange,
}: {
  trip: ItineraryDetail;
  onReadyChange?: (ready: boolean | null) => void;
}) {
  const t = useTranslations("offline");
  const locale = useLocale();
  const [supported, setSupported] = useState(false);
  const [summary, setSummary] = useState<OfflinePackSummary | null>(null);
  const [busy, setBusy] = useState<"save" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    onReadyChange?.(supported ? Boolean(summary) : null);
  }, [supported, summary, onReadyChange]);

  useEffect(() => {
    setSupported(offlinePacksSupported());
    setSummary(getOfflinePackSummary(trip.id));
  }, [trip.id]);

  if (!supported) return null;

  async function download() {
    setBusy("save");
    setError(null);
    try {
      setSummary(await saveOfflinePack(trip));
    } catch {
      setError(t("downloadFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("remove");
    try {
      await removeOfflinePack(trip.id);
      setSummary(null);
    } finally {
      setBusy(null);
    }
  }

  const downloaded = summary
    ? new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(summary.downloadedAt))
    : null;

  return (
    <section
      aria-labelledby="offline-pack"
      className="flex flex-col gap-2 rounded-2xl border border-slate-200 p-4 dark:border-slate-800"
    >
      <h2
        id="offline-pack"
        className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-50"
      >
        {summary ? (
          <CheckCircleIcon
            aria-hidden
            className="h-5 w-5 text-brand-700 dark:text-brand-300"
          />
        ) : (
          <ArrowDownTrayIcon aria-hidden className="h-5 w-5" />
        )}
        {summary ? t("availableOffline") : t("useOffline")}
      </h2>
      {summary ? (
        <>
          <p
            className="text-sm text-slate-600 dark:text-slate-300"
            aria-live="polite"
          >
            {t("downloadedAt", { date: downloaded! })} ·{" "}
            {t("packContents", {
              stops: summary.stopCount,
              photos: summary.imageCount,
            })}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t("staleHint")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/trips/offline?id=${trip.id}`}
              className="inline-flex min-h-10 items-center rounded-full bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800"
            >
              {t("openOffline")}
            </Link>
            <button
              type="button"
              onClick={download}
              disabled={busy !== null}
              className="min-h-10 rounded-full border border-slate-300 px-4 text-sm font-semibold disabled:opacity-60 dark:border-slate-700"
            >
              {busy === "save" ? t("downloading") : t("update")}
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={busy !== null}
              className="min-h-10 px-3 text-sm font-semibold text-flag-700 hover:underline disabled:opacity-60 dark:text-flag-300"
            >
              {t("remove")}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {t("explain")}
          </p>
          <button
            type="button"
            onClick={download}
            disabled={busy !== null}
            className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-full border border-brand-700 px-4 text-sm font-semibold text-brand-800 hover:bg-brand-50 disabled:opacity-60 dark:border-brand-400 dark:text-brand-200 dark:hover:bg-brand-950/30"
          >
            <ArrowDownTrayIcon aria-hidden className="h-4 w-4" />
            {busy === "save" ? t("downloading") : t("download")}
          </button>
        </>
      )}
      <details className="text-xs text-slate-500 dark:text-slate-400">
        <summary className="cursor-pointer font-semibold">
          {t("needsConnection")}
        </summary>
        <ul className="mt-1 list-disc ps-5">
          <li>{t("needEditing")}</li>
          <li>{t("needChat")}</li>
          <li>{t("needMaps")}</li>
          <li>{t("needBooking")}</li>
        </ul>
      </details>
      {error && (
        <p role="alert" className="text-sm text-flag-700 dark:text-flag-300">
          {error}
        </p>
      )}
    </section>
  );
}
