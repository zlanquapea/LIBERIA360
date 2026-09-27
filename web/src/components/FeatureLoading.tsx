"use client";
import { useTranslations } from "next-intl";
import { FeatureNavigation } from "./FeatureNavigation";
export function FeatureLoading() {
  const t = useTranslations("common");
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 pb-28" aria-busy="true">
      <FeatureNavigation />
      <p
        role="status"
        className="mb-4 text-sm text-slate-500 dark:text-slate-400"
      >
        {t("loading")}
      </p>
      <div aria-hidden className="space-y-4 motion-safe:animate-pulse">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="mb-4 h-5 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-3 w-full rounded bg-slate-100 dark:bg-slate-800" />
            <div className="mt-2 h-3 w-4/5 rounded bg-slate-100 dark:bg-slate-800" />
          </div>
        ))}
      </div>
    </main>
  );
}
