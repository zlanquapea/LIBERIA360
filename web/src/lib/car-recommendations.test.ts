import type { CarListing } from "./types";
import { recommendCars } from "./car-recommendations";

function car(id: string, overrides: Partial<CarListing> = {}): CarListing {
  return {
    id,
    make: "Toyota",
    model: "RAV4",
    title: `Car ${id}`,
    year: 2024,
    category: "suv",
    transmission: "automatic",
    fuelType: "petrol",
    seats: 5,
    pricePerDay: 70,
    features: ["Aircon"],
    countyId: "monrovia",
    isActive: true,
    ...overrides,
  } as CarListing;
}

describe("recommendCars", () => {
  it("excludes the selected and inactive vehicles and never duplicates across rails", () => {
    const selected = car("selected");
    const result = recommendCars(
      selected,
      [
        selected,
        car("inactive", { isActive: false }),
        car("same-model"),
        car("priced", { make: "Honda", model: "CR-V", pricePerDay: 72 }),
      ],
      1,
    );
    expect(result.similarCars.map(({ id }) => id)).toEqual(["same-model"]);
    expect(result.similarPrice.map(({ id }) => id)).toEqual(["priced"]);
    expect(
      new Set(
        [...result.similarCars, ...result.similarPrice].map(({ id }) => id),
      ).size,
    ).toBe(2);
  });

  it("keeps price alternatives within twenty percent and filters irrelevant matches", () => {
    const selected = car("selected");
    const result = recommendCars(
      selected,
      [
        car("similar"),
        car("within", { make: "Honda", model: "CR-V", pricePerDay: 84 }),
        car("outside", { make: "Honda", model: "CR-V", pricePerDay: 85 }),
        car("irrelevant", {
          make: "Bus Co",
          model: "Coach",
          category: "minibus",
          seats: 20,
          pricePerDay: 70,
        }),
      ],
      1,
    );
    expect(result.similarPrice.map(({ id }) => id)).toEqual(["within"]);
  });
});
