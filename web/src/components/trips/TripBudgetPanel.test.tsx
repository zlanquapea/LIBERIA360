import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TripBudgetPanel } from "./TripBudgetPanel";
import {
  getTripBudget,
  saveTripBudget,
  parseBudgetAmount,
  type TripBudget,
} from "@/lib/trip-budget-api";
import { HttpError } from "@/lib/http";
jest.mock("@/lib/trip-budget-api", () => ({
  ...jest.requireActual("@/lib/trip-budget-api"),
  getTripBudget: jest.fn(),
  saveTripBudget: jest.fn(),
}));
const get = getTripBudget as jest.Mock;
const save = saveTripBudget as jest.Mock;
const budget = (): TripBudget => ({
  version: 1,
  currency: "USD",
  budgetMinor: 5000,
  travelers: [{ id: "person", name: "Wonders" }],
  expenses: [],
  canEdit: true,
  summary: {
    spentMinor: 0,
    remainingMinor: 5000,
    categories: {},
    balances: [],
  },
});
beforeEach(() => {
  jest.clearAllMocks();
  get.mockResolvedValue(budget());
});
it("records decimal input in exact cents and respects selected travelers", async () => {
  save.mockResolvedValue({ ...budget(), version: 2 });
  render(<TripBudgetPanel tripId="trip" />);
  fireEvent.click(await screen.findByRole("button", { name: "Add expense" }));
  fireEvent.change(screen.getByLabelText("Description"), {
    target: { value: "Lunch" },
  });
  fireEvent.change(screen.getByLabelText("Amount (USD)"), {
    target: { value: "12.35" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save expense" }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      "trip",
      expect.objectContaining({
        version: 1,
        expenses: [
          expect.objectContaining({
            description: "Lunch",
            amountMinor: 1235,
            paidBy: "person",
            splitBetween: ["person"],
          }),
        ],
      }),
    ),
  );
  await screen.findByText("Changes saved.");
});
it("retains an expense draft after a failed save", async () => {
  save.mockRejectedValue(new Error("Network unavailable"));
  render(<TripBudgetPanel tripId="trip" />);
  fireEvent.click(await screen.findByRole("button", { name: "Add expense" }));
  fireEvent.change(screen.getByLabelText("Description"), {
    target: { value: "Transport" },
  });
  fireEvent.change(screen.getByLabelText("Amount (USD)"), {
    target: { value: "5" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save expense" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Network unavailable",
  );
  expect(screen.getByLabelText("Description")).toHaveValue("Transport");
  expect(screen.getByRole("button", { name: "Save expense" })).toBeEnabled();
});
it("stops stale writes and offers an explicit reload", async () => {
  save.mockRejectedValue(new HttpError(409, "Someone updated this budget."));
  render(<TripBudgetPanel tripId="trip" />);
  await screen.findByText("Budget & expenses");
  fireEvent.click(screen.getByText("Budget settings & travelers"));
  fireEvent.click(screen.getByRole("button", { name: "Save budget" }));
  await screen.findByRole("alert");
  expect(screen.getByRole("button", { name: "Save budget" })).toBeDisabled();
  fireEvent.click(
    screen.getByRole("button", {
      name: "Reload latest budget (discard draft)",
    }),
  );
  await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
});
it("never exposes edit controls to viewers", async () => {
  get.mockResolvedValue({ ...budget(), canEdit: false });
  render(<TripBudgetPanel tripId="trip" />);
  await screen.findByText(/You have view-only access/);
  expect(
    screen.queryByRole("button", { name: "Add expense" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText("Budget settings & travelers"),
  ).not.toBeInTheDocument();
});
it("does not erase an expense before deletion is confirmed", async () => {
  get.mockResolvedValue({
    ...budget(),
    expenses: [
      {
        id: "expense",
        description: "Taxi",
        category: "transport",
        amountMinor: 100,
        paidBy: "person",
        splitBetween: ["person"],
        date: "2026-10-04",
      },
    ],
  });
  save.mockResolvedValue({ ...budget(), version: 2 });
  render(<TripBudgetPanel tripId="trip" />);
  fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      "trip",
      expect.objectContaining({ expenses: [] }),
    ),
  );
});
it("parses amounts without binary floating-point rounding or ambiguous formats", () => {
  expect(parseBudgetAmount("0.29")).toBe(29);
  expect(parseBudgetAmount("10.1")).toBe(1010);
  for (const value of ["1.001", "1e3", "-2", "1,20", "Infinity", ""])
    expect(parseBudgetAmount(value)).toBeNull();
});
