import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import type { Pharmacy } from "@/lib/pharmacy-api";

// Mirrors MenuPreviewSection's own reasoning: a compact teaser that always
// leads to the pharmacy's own dedicated storefront page (product browsing,
// cart, prescription upload) rather than duplicating any of that here.
// Only ever rendered for an APPROVED pharmacy linked to this exact place
// (see PharmaciesService.findByPlace) — a place submitted under the
// dedicated "Pharmacy" category is auto-claimed as one, but stays hidden
// from the public place page until an admin approves it, same as the
// place itself.
export function PharmacyPreviewSection({ pharmacy }: { pharmacy: Pharmacy }) {
  return (
    <section className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
            Pharmacy
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-slate-50">
            Order online
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {pharmacy.pickupEnabled && pharmacy.deliveryEnabled
              ? "Pickup and delivery available"
              : pharmacy.deliveryEnabled
                ? "Delivery available"
                : "Pickup available"}
          </p>
        </div>
        <Link
          href={`/pharmacies/${pharmacy.slug}`}
          className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800"
        >
          Shop this pharmacy
          <ArrowRightIcon aria-hidden className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
