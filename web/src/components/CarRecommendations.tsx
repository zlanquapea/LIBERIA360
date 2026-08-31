import Link from "next/link";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  TruckIcon,
  UserGroupIcon,
} from "@heroicons/react/24/solid";
import type { CarListing } from "@/lib/types";
import {
  formatCarCategory,
  formatCarTransmission,
  formatCost,
} from "@/lib/format";
import { resolveImageUrl, resolveThumbUrl } from "@/lib/images";
import { gradientForCategory } from "@/lib/category-colors";
import { SafeImage } from "./SafeImage";

type Badge = "Similar Vehicle" | "Similar Price";

function comparison(car: CarListing, selected: CarListing) {
  const difference = car.pricePerDay - selected.pricePerDay;
  if (Math.abs(difference) < 0.01) return "Same daily price";
  return difference < 0
    ? `Save ${formatCost(Math.abs(difference))}/day`
    : `Upgrade for +${formatCost(difference)}/day`;
}

function RecommendationCard({
  car,
  selected,
  badge,
  query,
}: {
  car: CarListing;
  selected: CarListing;
  badge: Badge;
  query: string;
}) {
  const image = car.images[0];
  const href = `/car-rentals/${car.id}${query}`;
  return (
    <article className="w-[17rem] shrink-0 snap-start overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900 sm:w-72">
      <div className="relative h-36 overflow-hidden">
        <SafeImage
          src={image ? resolveImageUrl(image) : null}
          thumbSrc={image ? resolveThumbUrl(image) : null}
          alt=""
          className="h-full w-full object-cover"
          fallback={
            <div
              className="flex h-full items-center justify-center"
              style={{ backgroundImage: gradientForCategory(car.category) }}
            >
              <TruckIcon className="h-10 w-10 text-white" />
            </div>
          }
        />
        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-brand-700 shadow-sm">
          {badge}
        </span>
      </div>
      <div className="flex flex-col gap-2 p-4">
        <div>
          <h4 className="truncate font-display text-lg font-bold text-slate-950 dark:text-slate-50">
            {car.title}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {car.year} · {formatCarCategory(car.category)}
          </p>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
          <UserGroupIcon className="h-4 w-4 text-sky-500" />
          {car.seats} seats · {formatCarTransmission(car.transmission)}
        </p>
        <p className="flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          <CheckCircleIcon className="h-4 w-4" />
          Available now
        </p>
        <div className="flex items-end justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
          <div>
            <p className="font-display text-xl font-bold text-slate-950 dark:text-slate-50">
              {formatCost(car.pricePerDay)}
              <span className="text-xs font-normal text-slate-500">/day</span>
            </p>
            <p className="text-xs font-semibold text-sky-700 dark:text-sky-300">
              {comparison(car, selected)}
            </p>
          </div>
          <Link
            href={href}
            aria-label={`View ${car.title}`}
            className="inline-flex items-center gap-1 rounded-full bg-brand-700 px-3 py-2 text-xs font-bold text-white hover:bg-brand-800"
          >
            View car <ArrowRightIcon className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}

function Rail({
  title,
  description,
  cars,
  selected,
  badge,
  query,
}: {
  title: string;
  description: string;
  cars: CarListing[];
  selected: CarListing;
  badge: Badge;
  query: string;
}) {
  if (!cars.length) return null;
  return (
    <section
      aria-labelledby={`${badge.replace(" ", "-").toLowerCase()}-heading`}
    >
      <h3
        id={`${badge.replace(" ", "-").toLowerCase()}-heading`}
        className="font-display text-xl font-bold text-slate-950 dark:text-slate-50"
      >
        {title}
      </h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {description}
      </p>
      <div className="-mx-4 mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
        {cars.map((car) => (
          <RecommendationCard
            key={car.id}
            car={car}
            selected={selected}
            badge={badge}
            query={query}
          />
        ))}
      </div>
    </section>
  );
}

export function CarRecommendations({
  selected,
  similarCars,
  similarPrice,
  query,
}: {
  selected: CarListing;
  similarCars: CarListing[];
  similarPrice: CarListing[];
  query: string;
}) {
  const hasRecommendations = similarCars.length > 0 || similarPrice.length > 0;
  return (
    <section className="flex flex-col gap-7 rounded-[2rem] border border-slate-200 bg-slate-100/60 p-5 dark:border-slate-800 dark:bg-slate-900/50 sm:p-7">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
          Keep exploring
        </p>
        <h2 className="mt-1 font-display text-2xl font-extrabold text-slate-950 dark:text-slate-50">
          You may also like
        </h2>
      </div>
      {hasRecommendations ? (
        <>
          <Rail
            title="Similar Cars"
            description="Vehicles similar to the one you're viewing."
            cars={similarCars}
            selected={selected}
            badge="Similar Vehicle"
            query={query}
          />
          <Rail
            title="Similar Price Options"
            description="Other vehicles around your current rental budget."
            cars={similarPrice}
            selected={selected}
            badge="Similar Price"
            query={query}
          />
        </>
      ) : (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          No close matches right now. Explore the full fleet to find your next
          ride.
        </p>
      )}
      <Link
        href={`/car-rentals${query}`}
        className="inline-flex w-fit items-center gap-2 rounded-full border border-brand-700 px-4 py-2 text-sm font-bold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950/30"
      >
        {hasRecommendations ? "View more cars" : "Explore more cars"}{" "}
        <ArrowRightIcon className="h-4 w-4" />
      </Link>
    </section>
  );
}
