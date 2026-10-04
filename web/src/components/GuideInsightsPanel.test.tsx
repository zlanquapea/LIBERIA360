import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { GuideInsightsPanel } from "./GuideInsightsPanel";
import { apiRequest } from "@/lib/http";
jest.mock("@/lib/http", () => ({ apiRequest: jest.fn() }));
const request = apiRequest as jest.Mock;
const data = {
  available: true,
  totals: { profile_views: 12, experience_views: 8, booking_requests: 3 },
  byDay: [],
  experiences: [],
};
beforeEach(() => request.mockReset());
it("shows guide performance and changes the reporting window", async () => {
  request.mockResolvedValue(data);
  render(<GuideInsightsPanel />);
  expect(await screen.findByText("12")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Insights period"), {
    target: { value: "7" },
  });
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith("/guide-insights/me?days=7", {
      cache: "no-store",
    }),
  );
});
it("hides the guide dashboard for non-guides", async () => {
  request.mockResolvedValue({ available: false });
  const { container } = render(<GuideInsightsPanel />);
  await waitFor(() => expect(container).toBeEmptyDOMElement());
});
it("allows retry after an error without showing fabricated zeros", async () => {
  request.mockRejectedValueOnce(new Error()).mockResolvedValueOnce(data);
  render(<GuideInsightsPanel />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not load");
  fireEvent.click(screen.getByText("Retry"));
  expect(await screen.findByText("12")).toBeInTheDocument();
});
