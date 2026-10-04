"use client";
import {
  CheckCircleIcon,
  ChevronDownIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
type Destination = "itinerary" | "people" | "budget" | "packing" | "offline";
export function BeforeYouGo({
  datesSet,
  hasPlaces,
  hasPartners,
  budgetReady,
  packingReady,
  offlineReady,
  onOpen,
  canAddPlace = true,
}: {
  datesSet: boolean;
  hasPlaces: boolean;
  hasPartners: boolean;
  budgetReady: boolean | null;
  packingReady: boolean | null;
  offlineReady: boolean | null;
  onOpen: (destination: Destination) => void;
  canAddPlace?: boolean;
}) {
  const items: {
    label: string;
    done: boolean | null;
    destination?: Destination;
    hint?: string;
    optional?: boolean;
  }[] = [
    {
      label: "Travel dates",
      done: datesSet,
      hint: datesSet
        ? undefined
        : "Dates are set when creating a trip. This trip has no date range.",
    },
    { label: "Add a place", done: hasPlaces, destination: canAddPlace ? "itinerary" : undefined, hint: !hasPlaces && !canAddPlace ? "Ask a trip editor to add the first place." : undefined },
    { label: "Set a budget", done: budgetReady, destination: "budget" },
    { label: "Finish packing", done: packingReady, destination: "packing" },
    {
      label: "Save for offline access",
      done: offlineReady,
      destination: "offline",
      hint: "Download on this device. Update the download after changing the plan.",
    },
    {
      label: "Invite travel partners",
      done: hasPartners,
      destination: "people",
      optional: true,
      hint: "Optional for solo trips. Checked when a partner joins.",
    },
  ];
  const required = items.filter((item) => !item.optional);
  const complete = required.filter((item) => item.done === true).length;
  return (
    <details className="group rounded-2xl border border-brand-200 bg-brand-50/40 dark:border-neutral-700 dark:bg-neutral-900">
      <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 [&::-webkit-details-marker]:hidden">
        <CheckCircleIcon
          aria-hidden="true"
          className="h-6 w-6 shrink-0 text-brand-700 dark:text-brand-300"
        />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Before you go</h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-neutral-400">
            {complete} of {required.length} ready · Tap to{" "}
            {complete === required.length ? "review" : "see what’s left"}
          </p>
        </div>
        <ChevronDownIcon
          aria-hidden="true"
          className="h-5 w-5 shrink-0 transition group-open:rotate-180"
        />
      </summary>
      <div className="space-y-3 px-4 pb-4">
        <progress
          aria-label="Trip preparation progress"
          className="h-2 w-full accent-emerald-600"
          max={required.length}
          value={complete}
        />
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.label}
              className="rounded-xl bg-white p-3 dark:bg-neutral-800"
            >
              <div className="flex items-center gap-3">
                <CheckCircleIcon
                  aria-hidden="true"
                  className={`h-5 w-5 shrink-0 ${item.done ? "text-emerald-600 dark:text-emerald-400" : "text-slate-300 dark:text-neutral-500"}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {item.label}
                    {item.optional && (
                      <span className="text-xs font-normal text-slate-500 dark:text-neutral-400">
                        {" "}
                        · Optional
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-neutral-400">
                    {item.done === null
                      ? "Status not available yet"
                      : item.done
                        ? "Done"
                        : "Not done yet"}
                  </p>
                </div>
                {item.destination && (
                  <button
                    type="button"
                    aria-label={`Open ${item.label.toLowerCase()}`}
                    onClick={() => onOpen(item.destination!)}
                    className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-brand-700 hover:bg-brand-50 focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-brand-300 dark:hover:bg-neutral-700"
                  >
                    <ArrowRightIcon aria-hidden="true" className="h-5 w-5" />
                  </button>
                )}
              </div>
              {item.hint && (
                <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-neutral-400">
                  {item.hint}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
