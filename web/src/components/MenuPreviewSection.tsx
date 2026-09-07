import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { formatCost } from "@/lib/format";
import { resolveImageUrl } from "@/lib/images";
import { SafeImage } from "@/components/SafeImage";
import type { MenuItem } from "@/lib/types";

// How many dishes to tease inline before pointing to the full menu page.
const PREVIEW_COUNT = 6;

// Redesign (Sep 2026, "the menu is not well developed" feedback): the old
// MenuSection crammed a read-only menu grid, a full ordering cart, and a
// checkout form into one inline section of the Place/Business profile
// page — a scroll-heavy wall that gave a restaurant's actual dishes no
// visual room to breathe, and (see RestaurantMenuOrdering.tsx) collided
// with StickyBookingBar once an order was in progress. This is the new
// front door instead: a compact, appetizing teaser — a handful of dishes
// with real photos — that always leads to `menuHref`, a dedicated full
// menu + ordering page with the space a menu actually deserves. No
// quantity steppers or cart here; this component is pure Server Component
// (no client JS at all) since it's just images and links.
//
// Shared by both the Place page (see MenuSection's old doc comment for why
// the menu itself is modeled as information about the place) and the
// Business page (kept for anyone who lands there directly).
export function MenuPreviewSection({
  items,
  menuHref,
}: {
  items: MenuItem[];
  menuHref: string;
}) {
  if (items.length === 0) return null;

  const preview = items.slice(0, PREVIEW_COUNT);
  const remaining = items.length - preview.length;
  const categoryCount = new Set(items.map((item) => item.category ?? "Menu")).size;

  return (
    <section className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">What&apos;s on offer</p>
          <h2 className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-slate-50">Menu</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {items.length} dish{items.length === 1 ? "" : "es"}
            {categoryCount > 1 ? ` across ${categoryCount} sections` : ""}
          </p>
        </div>
        <Link
          href={menuHref}
          className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800"
        >
          See full menu
          <ArrowRightIcon aria-hidden className="h-4 w-4" />
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1">
        {preview.map((item) => (
          <Link
            key={item.id}
            href={menuHref}
            className="flex w-36 shrink-0 flex-col gap-2 rounded-2xl border border-slate-200 p-2 transition-colors hover:border-brand-300 hover:bg-brand-50/50 dark:border-slate-800 dark:hover:border-brand-700 dark:hover:bg-brand-950/20 sm:w-40"
          >
            <SafeImage
              src={item.image ? resolveImageUrl(item.image) : null}
              alt=""
              className="h-24 w-full rounded-xl object-cover sm:h-28"
              fallback={
                <div
                  aria-hidden
                  className="flex h-24 w-full items-center justify-center rounded-xl bg-slate-100 text-2xl dark:bg-slate-800 sm:h-28"
                >
                  🍽️
                </div>
              }
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">{item.name}</p>
              <p className="text-sm font-semibold text-brand-700 dark:text-brand-300">{formatCost(item.price)}</p>
            </div>
          </Link>
        ))}

        {remaining > 0 && (
          <Link
            href={menuHref}
            className="flex w-36 shrink-0 flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-slate-300 p-2 text-center text-sm font-semibold text-brand-700 hover:border-brand-400 hover:bg-brand-50 dark:border-slate-700 dark:text-brand-300 dark:hover:bg-brand-950/30 sm:w-40 sm:h-[8.5rem]"
          >
            +{remaining} more
            <ArrowRightIcon aria-hidden className="h-4 w-4" />
          </Link>
        )}
      </div>
    </section>
  );
}
