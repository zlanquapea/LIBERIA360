import Link from "next/link";
import type { Pharmacy } from "@/lib/pharmacy-api";

export function PharmacyCard({ pharmacy }: { pharmacy: Pharmacy }) {
  return (
    <article className="card overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div
        className="h-28 bg-gradient-to-br from-emerald-700 to-brand-900 bg-cover bg-center"
        style={
          pharmacy.coverUrl
            ? { backgroundImage: `url(${pharmacy.coverUrl})` }
            : undefined
        }
      />
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg font-bold">
                {pharmacy.name}
              </h2>
              <span
                title="Verified pharmacy"
                className="text-emerald-600"
                aria-label="Verified pharmacy"
              >
                ✓
              </span>
            </div>
            {pharmacy.sponsored && (
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Sponsored
              </span>
            )}
          </div>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {pharmacy.address}, {pharmacy.location}
        </p>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            {pharmacy.pickupEnabled ? "Pickup" : "No pickup"}
          </span>
          <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-800 dark:bg-blue-950 dark:text-blue-200">
            {pharmacy.deliveryEnabled ? "Delivery" : "No delivery"}
          </span>
        </div>
        <Link
          className="inline-flex min-h-11 items-center font-semibold text-brand-700 hover:underline dark:text-brand-300"
          href={`/pharmacies/${pharmacy.slug}`}
        >
          View pharmacy →
        </Link>
      </div>
    </article>
  );
}
