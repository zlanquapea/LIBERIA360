import { apiRequest } from "./http";
export type BudgetTraveler = { id: string; name: string };
export type TripExpense = {
  id: string;
  description: string;
  category: string;
  amountMinor: number;
  paidBy: string;
  splitBetween: string[];
  date: string;
};
export type TripBudget = {
  version: number;
  currency: "USD" | "LRD";
  budgetMinor: number;
  travelers: BudgetTraveler[];
  expenses: TripExpense[];
  canEdit: boolean;
  summary: {
    spentMinor: number;
    remainingMinor: number;
    categories: Record<string, number>;
    balances: Array<
      BudgetTraveler & {
        paidMinor: number;
        shareMinor: number;
        netMinor: number;
      }
    >;
  };
};
export function parseBudgetAmount(value: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ""] = value.trim().split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(amount) && amount <= 10000000000 ? amount : null;
}
export const getTripBudget = (id: string) =>
  apiRequest<TripBudget>(`/itineraries/${id}/budget`, { cache: "no-store" });
export const saveTripBudget = (id: string, data: TripBudget) =>
  apiRequest<TripBudget>(`/itineraries/${id}/budget`, {
    method: "PUT",
    body: JSON.stringify({
      version: data.version,
      currency: data.currency,
      budgetMinor: data.budgetMinor,
      travelers: data.travelers,
      expenses: data.expenses,
    }),
  });
