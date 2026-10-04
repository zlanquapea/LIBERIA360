import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  WatchGuideDate,
  GuideAvailabilityAlerts,
} from "./GuideAvailabilityAlerts";
import { apiRequest } from "@/lib/http";
import { useAuth } from "@/hooks/useAuth";
jest.mock("@/lib/http", () => ({ apiRequest: jest.fn() }));
jest.mock("@/hooks/useAuth", () => ({ useAuth: jest.fn() }));
const api = apiRequest as jest.Mock;
const auth = useAuth as jest.Mock;
beforeEach(() => {
  jest.clearAllMocks();
  auth.mockReturnValue({ user: { id: "traveler" }, ready: true });
});
it("subscribes to the selected experience and date without submitting the booking form", async () => {
  api.mockResolvedValueOnce([]).mockResolvedValueOnce({ watching: true });
  const submit = jest.fn((event) => event.preventDefault());
  render(
    <form onSubmit={submit}>
      <WatchGuideDate experienceId="experience" date="2026-11-01" />
    </form>,
  );
  const button = await screen.findByRole("button", {
    name: "Notify me when available",
  });
  fireEvent.click(button);
  await screen.findByText("Availability alert active");
  expect(api).toHaveBeenLastCalledWith(
    "/experiences/experience/availability-alerts",
    { method: "POST", body: '{"date":"2026-11-01"}' },
  );
  expect(submit).not.toHaveBeenCalled();
});
it("shows existing active subscriptions instead of a duplicate subscribe button", async () => {
  api.mockResolvedValue([
    {
      id: "alert",
      experienceId: "experience",
      date: "2026-11-01",
      notifiedAt: null,
    },
  ]);
  render(<WatchGuideDate experienceId="experience" date="2026-11-01" />);
  await screen.findByText("Availability alert active");
  expect(
    screen.queryByRole("button", { name: "Notify me when available" }),
  ).not.toBeInTheDocument();
});
it("shows an error rather than claiming an unsuccessful subscription is active", async () => {
  api
    .mockResolvedValueOnce([])
    .mockRejectedValueOnce(new Error("Please retry"));
  render(<WatchGuideDate experienceId="experience" date="2026-11-01" />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Notify me when available" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("Please retry");
  expect(
    screen.queryByText("Availability alert active"),
  ).not.toBeInTheDocument();
});
it("lets users stop an alert from their Account list", async () => {
  api
    .mockResolvedValueOnce([
      {
        id: "alert",
        experienceId: "experience",
        date: "2026-11-01",
        title: "Coastal walk",
        notifiedAt: null,
      },
    ])
    .mockResolvedValueOnce({ removed: true });
  render(<GuideAvailabilityAlerts />);
  fireEvent.click(await screen.findByRole("button", { name: "Stop alert" }));
  await waitFor(() =>
    expect(screen.queryByText("Coastal walk")).not.toBeInTheDocument(),
  );
  expect(api).toHaveBeenLastCalledWith("/guides/availability-alerts/alert", {
    method: "DELETE",
  });
});
it("asks signed-out visitors to sign in and preserves their date", () => {
  auth.mockReturnValue({ user: null, ready: true });
  render(<WatchGuideDate experienceId="experience" date="2026-11-01" />);
  expect(screen.getByRole("link")).toHaveAttribute(
    "href",
    `/login?next=${encodeURIComponent("/experiences/experience?date=2026-11-01")}`,
  );
  expect(api).not.toHaveBeenCalled();
});
