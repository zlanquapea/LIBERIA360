import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { DataSource } from "typeorm";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { TripBudgetController } from "./trip-budget.controller";
import { SaveTripBudgetDto } from "./trip-budget.dto";
import { budgetSummary, TripBudgetService } from "./trip-budget.service";

const ids = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
];
const fixture = (): SaveTripBudgetDto => ({
  version: 0,
  currency: "USD",
  budgetMinor: 10000,
  travelers: ids.map((id, index) => ({ id, name: `Traveler ${index}` })),
  expenses: [
    {
      id: "44444444-4444-4444-8444-444444444444",
      description: "Transport",
      category: "transport",
      amountMinor: 1000,
      paidBy: ids[0],
      splitBetween: [...ids],
      date: "2026-10-04",
    },
  ],
});

describe("Trip budget calculations", () => {
  it("allocates every cent, with stable rounding and zero-sum balances", () => {
    const budget = fixture();
    const result = budgetSummary(budget);
    expect(result.spentMinor).toBe(1000);
    expect(result.remainingMinor).toBe(9000);
    expect(result.balances.map((person) => person.shareMinor)).toEqual([
      334, 333, 333,
    ]);
    expect(
      result.balances.reduce((sum, person) => sum + person.netMinor, 0),
    ).toBe(0);
    budget.expenses[0].splitBetween.reverse();
    expect(budgetSummary(budget)).toEqual(result);
  });
  it("supports personal expenses, payer exclusion, and over-budget totals", () => {
    const budget = fixture();
    budget.budgetMinor = 500;
    budget.expenses[0].splitBetween = [ids[1]];
    const result = budgetSummary(budget);
    expect(result.remainingMinor).toBe(-500);
    expect(result.balances.map((person) => person.netMinor)).toEqual([
      1000, -1000, 0,
    ]);
  });
  it("handles tiny amounts without inventing cents", () => {
    const budget = fixture();
    budget.expenses[0].amountMinor = 1;
    expect(
      budgetSummary(budget).balances.map((person) => person.shareMinor),
    ).toEqual([1, 0, 0]);
  });
});

describe("Trip budget permissions and conflicts", () => {
  const query = jest.fn();
  const db = {
    manager: { query },
    query,
    transaction: (fn: any) => fn({ query }),
  };
  const service = new TripBudgetService(db as unknown as DataSource);
  beforeEach(() => query.mockReset());
  it("requires authentication on the entire controller", () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, TripBudgetController),
    ).toContain(JwtAuthGuard);
  });
  it("denies outsiders even when a trip is public", async () => {
    query
      .mockResolvedValueOnce([{ user_id: "owner" }])
      .mockResolvedValueOnce([]);
    await expect(service.get("outsider", "trip")).rejects.toThrow(
      "Trip not found",
    );
    expect(query).toHaveBeenCalledTimes(2);
  });
  it("allows viewers to read but not edit", async () => {
    query
      .mockResolvedValueOnce([{ user_id: "owner" }])
      .mockResolvedValueOnce([{ role: "viewer" }])
      .mockResolvedValueOnce([]);
    expect((await service.get("viewer", "trip")).canEdit).toBe(false);
    query
      .mockResolvedValueOnce([{ user_id: "owner" }])
      .mockResolvedValueOnce([{ role: "viewer" }]);
    await expect(service.save("viewer", "trip", fixture())).rejects.toThrow(
      "Only trip owners",
    );
    expect(query.mock.calls.some(([sql]) => sql.startsWith("INSERT"))).toBe(
      false,
    );
  });
  it("locks the trip row and prevents stale clients overwriting expenses", async () => {
    query
      .mockResolvedValueOnce([{ user_id: "owner" }])
      .mockResolvedValueOnce([{ version: 2, data: fixture() }]);
    await expect(service.save("owner", "trip", fixture())).rejects.toThrow(
      "Someone updated",
    );
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("FOR UPDATE"),
      ["trip"],
    );
    expect(query).toHaveBeenCalledTimes(2);
  });
  it("allows editors to save and increments the version", async () => {
    query
      .mockResolvedValueOnce([{ user_id: "owner" }])
      .mockResolvedValueOnce([{ role: "editor" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const result = await service.save("editor", "trip", fixture());
    expect(result.version).toBe(1);
    expect(result.summary.spentMinor).toBe(1000);
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining("INSERT INTO trip_budgets"),
      expect.arrayContaining(["trip", 1, "editor"]),
    );
  });
  it("prevents currency reinterpretation when expenses exist", async () => {
    query
      .mockResolvedValueOnce([{ user_id: "owner" }])
      .mockResolvedValueOnce([{ version: 0, data: fixture() }]);
    await expect(
      service.save("owner", "trip", { ...fixture(), currency: "LRD" }),
    ).rejects.toThrow("changing currency");
  });
  it("rejects removing travelers referenced by expenses and duplicate IDs", async () => {
    const budget = fixture();
    budget.travelers.pop();
    await expect(service.save("owner", "trip", budget)).rejects.toThrow(
      "valid travelers",
    );
    const duplicate = fixture();
    duplicate.expenses.push(duplicate.expenses[0]);
    await expect(service.save("owner", "trip", duplicate)).rejects.toThrow(
      "Duplicate expense",
    );
    expect(query).not.toHaveBeenCalled();
  });
});

describe("Trip budget request validation", () => {
  it.each([
    "fractional",
    "emptySplit",
    "duplicateSplit",
    "unknownCurrency",
    "invalidDate",
  ])("rejects %s input", async (invalid) => {
    const value = fixture();
    if (invalid === "fractional") value.expenses[0].amountMinor = 1.5;
    if (invalid === "emptySplit") value.expenses[0].splitBetween = [];
    if (invalid === "duplicateSplit")
      value.expenses[0].splitBetween = [ids[0], ids[0]];
    if (invalid === "unknownCurrency") value.currency = "EUR" as never;
    if (invalid === "invalidDate") value.expenses[0].date = "2026-02-30";
    expect(
      (await validate(plainToInstance(SaveTripBudgetDto, value))).length,
    ).toBeGreaterThan(0);
  });
  it("accepts valid nested expenses", async () => {
    expect(
      await validate(plainToInstance(SaveTripBudgetDto, fixture())),
    ).toHaveLength(0);
  });
});
