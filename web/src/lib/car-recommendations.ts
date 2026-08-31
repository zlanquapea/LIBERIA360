import type { CarListing } from "./types";

export const CAR_RECOMMENDATION_PRICE_TOLERANCE = 0.2;

export interface CarRecommendations {
  similarCars: CarListing[];
  similarPrice: CarListing[];
}

const relatedCategories: Record<
  CarListing["category"],
  CarListing["category"][]
> = {
  economy: ["compact", "sedan"],
  compact: ["economy", "sedan"],
  sedan: ["compact", "economy", "luxury"],
  suv: ["pickup", "luxury"],
  van: ["minibus", "suv"],
  minibus: ["van"],
  pickup: ["suv", "van"],
  luxury: ["sedan", "suv"],
};

const normalized = (value: string) => value.trim().toLocaleLowerCase();
const priceDistance = (candidate: CarListing, selected: CarListing) =>
  Math.abs(candidate.pricePerDay - selected.pricePerDay) /
  Math.max(selected.pricePerDay, 1);

function sharedFeatureCount(a: CarListing, b: CarListing) {
  const features = new Set(a.features.map(normalized));
  return b.features.reduce(
    (count, feature) => count + Number(features.has(normalized(feature))),
    0,
  );
}

function relevance(candidate: CarListing, selected: CarListing) {
  const sameMake = normalized(candidate.make) === normalized(selected.make);
  const sameModel = normalized(candidate.model) === normalized(selected.model);
  const sameCategory = candidate.category === selected.category;
  const relatedCategory = relatedCategories[selected.category].includes(
    candidate.category,
  );
  return {
    score:
      Number(sameMake && sameModel) * 100 +
      Number(sameMake) * 20 +
      Number(sameCategory) * 30 +
      Number(relatedCategory) * 12 +
      Number(Math.abs(candidate.seats - selected.seats) <= 1) * 10 +
      Number(candidate.transmission === selected.transmission) * 8 +
      sharedFeatureCount(candidate, selected) * 3 +
      Number(candidate.countyId === selected.countyId) * 5 -
      priceDistance(candidate, selected) * 10,
    relevant:
      sameMake ||
      sameCategory ||
      relatedCategory ||
      Math.abs(candidate.seats - selected.seats) <= 1,
  };
}

/** Rank active catalog vehicles into mutually exclusive recommendation rails. */
export function recommendCars(
  selected: CarListing,
  catalog: CarListing[],
  limit = 6,
): CarRecommendations {
  const candidates = catalog.filter(
    (car) => car.id !== selected.id && car.isActive,
  );
  const ranked = candidates
    .map((car) => ({ car, ...relevance(car, selected) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        priceDistance(a.car, selected) - priceDistance(b.car, selected),
    );

  const similarCars = ranked
    .filter(({ relevant }) => relevant)
    .slice(0, limit)
    .map(({ car }) => car);
  const used = new Set(similarCars.map((car) => car.id));
  const similarPrice = ranked
    .filter(
      ({ car, relevant }) =>
        !used.has(car.id) &&
        relevant &&
        priceDistance(car, selected) <= CAR_RECOMMENDATION_PRICE_TOLERANCE,
    )
    .sort(
      (a, b) =>
        priceDistance(a.car, selected) - priceDistance(b.car, selected) ||
        b.score - a.score,
    )
    .slice(0, limit)
    .map(({ car }) => car);

  return { similarCars, similarPrice };
}
