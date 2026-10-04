import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TripVotingPanel } from "./TripVotingPanel";
import { apiRequest } from "@/lib/http";
jest.mock("@/lib/http", () => ({ apiRequest: jest.fn() }));
jest.mock("@/components/AddTripStop", () => ({ AddTripStop: () => null }));
const request = apiRequest as jest.Mock;
const data = {
  isOwner: false,
  items: [
    {
      id: "s",
      title: "Beach",
      input: { day: 1 },
      votes: 1,
      voted: false,
      mine: false,
    },
  ],
};
beforeEach(() => request.mockReset());
it("keeps failed votes unselected and shows the error", async () => {
  request
    .mockResolvedValueOnce(data)
    .mockRejectedValueOnce(new Error("Offline"));
  render(<TripVotingPanel tripId="t" durationDays={2} onAdded={() => {}} />);
  fireEvent.click(await screen.findByRole("button", { name: "Vote" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Offline");
  expect(screen.getByRole("button", { name: "Vote" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  expect(
    screen.queryByRole("button", { name: "Add to itinerary" }),
  ).not.toBeInTheDocument();
});
it("refreshes counts only after a successful vote", async () => {
  request
    .mockResolvedValueOnce(data)
    .mockResolvedValueOnce({ ok: true })
    .mockResolvedValueOnce({
      ...data,
      items: [{ ...data.items[0], votes: 2, voted: true }],
    });
  render(<TripVotingPanel tripId="t" durationDays={2} onAdded={() => {}} />);
  fireEvent.click(await screen.findByRole("button", { name: "Vote" }));
  expect(
    await screen.findByRole("button", { name: "Remove my vote" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText("2 votes")).toBeInTheDocument();
});
it("reloads the itinerary after owner selection", async () => {
  request.mockResolvedValue({ ...data, isOwner: true });
  const added = jest.fn();
  render(<TripVotingPanel tripId="t" durationDays={2} onAdded={added} />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Add to itinerary" }),
  );
  await waitFor(() => expect(added).toHaveBeenCalledTimes(1));
});
