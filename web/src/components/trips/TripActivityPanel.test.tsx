import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TripActivityPanel } from "./TripActivityPanel";
import { apiRequest } from "@/lib/http";
jest.mock("@/lib/http", () => ({ apiRequest: jest.fn() }));
const request = apiRequest as jest.Mock;
const feed = {
  muted: false,
  hasMore: false,
  items: [
    {
      id: "a",
      kind: "suggested",
      title: "Beach",
      actor: "Wonders",
      target: "trip-suggestion-s",
      createdAt: "2026-10-04T12:00:00Z",
    },
  ],
};
beforeEach(() => request.mockReset());
it("shows history with a link to the suggestion", async () => {
  request.mockResolvedValue(feed);
  render(<TripActivityPanel tripId="t" />);
  expect(await screen.findByRole("link", { name: "Beach" })).toHaveAttribute(
    "href",
    "#trip-suggestion-s",
  );
  expect(screen.getByText("Wonders")).toBeInTheDocument();
});
it("persists mute without hiding history", async () => {
  request.mockResolvedValueOnce(feed).mockResolvedValueOnce({ muted: true });
  render(<TripActivityPanel tripId="t" />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Mute trip updates" }),
  );
  expect(
    await screen.findByRole("button", { name: "Unmute trip updates" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(request).toHaveBeenLastCalledWith(
    "/itineraries/t/activity/preferences",
    { method: "PUT", body: '{"muted":true}' },
  );
  expect(screen.getByRole("link", { name: "Beach" })).toBeInTheDocument();
});
it("keeps the previous preference when saving fails", async () => {
  request
    .mockResolvedValueOnce(feed)
    .mockRejectedValueOnce(new Error("Offline"));
  render(<TripActivityPanel tripId="t" />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Mute trip updates" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not save");
  expect(
    screen.getByRole("button", { name: "Mute trip updates" }),
  ).toHaveAttribute("aria-pressed", "false");
});
it("loads older activity pages", async () => {
  request
    .mockResolvedValueOnce({ ...feed, hasMore: true })
    .mockResolvedValueOnce({ ...feed, items: [] });
  render(<TripActivityPanel tripId="t" />);
  fireEvent.click(await screen.findByRole("button", { name: "Older" }));
  await waitFor(() =>
    expect(request).toHaveBeenLastCalledWith("/itineraries/t/activity?page=1", {
      cache: "no-store",
    }),
  );
});
