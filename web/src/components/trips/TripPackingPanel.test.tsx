import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TripPackingPanel } from "./TripPackingPanel";
import {
  getTripPacking,
  saveTripPacking,
  addPackingStarter,
} from "@/lib/trip-packing-api";
import { HttpError } from "@/lib/http";
jest.mock("@/lib/trip-packing-api", () => ({
  ...jest.requireActual("@/lib/trip-packing-api"),
  getTripPacking: jest.fn(),
  saveTripPacking: jest.fn(),
}));
const get = getTripPacking as jest.Mock;
const save = saveTripPacking as jest.Mock;
const item = {
  id: "item",
  name: "Charger",
  category: "gear",
  quantity: 1,
  packed: false,
};
beforeEach(() => {
  jest.clearAllMocks();
  get.mockResolvedValue({ version: 1, items: [{ ...item }] });
});
it("saves packed progress before displaying success", async () => {
  save.mockImplementation(async (_id, next) => ({ ...next, version: 2 }));
  render(<TripPackingPanel tripId="trip" />);
  fireEvent.click(
    await screen.findByRole("checkbox", { name: "Packed: Charger" }),
  );
  await screen.findByText("1 of 1 packed");
  expect(save).toHaveBeenCalledWith("trip", {
    version: 1,
    items: [{ ...item, packed: true }],
  });
});
it("does not show failed updates as packed", async () => {
  save.mockRejectedValue(new Error("Offline. Please retry."));
  render(<TripPackingPanel tripId="trip" />);
  fireEvent.click(
    await screen.findByRole("checkbox", { name: "Packed: Charger" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("Offline");
  expect(
    screen.getByRole("checkbox", { name: "Packed: Charger" }),
  ).not.toBeChecked();
});
it("deduplicates starter lists without resetting saved progress", () => {
  const first = addPackingStarter([], "Essentials");
  first[0].packed = true;
  const next = addPackingStarter(first, "Essentials");
  expect(next).toEqual(first);
  const outdoors = addPackingStarter(next, "Outdoors");
  expect(
    outdoors.filter((entry) => entry.name === "Reusable water bottle"),
  ).toHaveLength(1);
  expect(outdoors[0].packed).toBe(true);
});
it("keeps the item draft after a failed save", async () => {
  save.mockRejectedValue(new Error("Please retry"));
  render(<TripPackingPanel tripId="trip" />);
  fireEvent.click(await screen.findByRole("button", { name: "Add item" }));
  fireEvent.change(screen.getByLabelText("Item name"), {
    target: { value: "Rain jacket" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save item" }));
  await screen.findByRole("alert");
  expect(screen.getByLabelText("Item name")).toHaveValue("Rain jacket");
});
it("blocks stale updates and explicitly reloads the checklist", async () => {
  save.mockRejectedValue(new HttpError(409, "Your checklist changed."));
  render(<TripPackingPanel tripId="trip" />);
  fireEvent.click(
    await screen.findByRole("checkbox", { name: "Packed: Charger" }),
  );
  await screen.findByRole("alert");
  expect(
    screen.getByRole("checkbox", { name: "Packed: Charger" }),
  ).toBeDisabled();
  fireEvent.click(
    screen.getByRole("button", {
      name: "Reload latest checklist (discard draft)",
    }),
  );
  await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
});
it("requires confirmation to remove an item", async () => {
  save.mockResolvedValue({ version: 2, items: [] });
  render(<TripPackingPanel tripId="trip" />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Remove Charger" }),
  );
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirm remove" }));
  await screen.findByText("0 of 0 packed");
  expect(save).toHaveBeenCalledWith("trip", { version: 1, items: [] });
});
