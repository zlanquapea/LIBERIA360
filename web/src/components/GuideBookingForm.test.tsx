import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { GuideBookingForm } from "./GuideBookingForm";
import { requestGuideBooking } from "../lib/guides-api";
jest.mock("../hooks/useAuth", () => ({ useAuth: () => ({ token: "token" }) }));
jest.mock("../lib/guides-api", () => ({
  requestGuideBooking: jest.fn().mockResolvedValue({}),
}));
jest.mock("../lib/http", () => ({
  apiRequest: jest.fn().mockResolvedValue({
    enabled: false,
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    blockedDates: [],
    bookedDates: [],
  }),
}));
beforeEach(() => jest.clearAllMocks());
it("reviews and edits details before sending exactly one booking request", async () => {
  render(<GuideBookingForm experienceId="experience-1" maxGroupSize={5} />);
  fireEvent.change(screen.getByLabelText("Date"), {
    target: { value: "2099-12-10" },
  });
  fireEvent.change(screen.getByLabelText("Group size"), {
    target: { value: "2" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Review request" }));
  expect(requestGuideBooking).not.toHaveBeenCalled();
  expect(
    screen.getByRole("region", { name: "Review your request" }),
  ).toHaveTextContent("2099-12-10");
  fireEvent.click(screen.getByRole("button", { name: "Edit details" }));
  expect(screen.getByLabelText("Group size")).toHaveValue(2);
  fireEvent.click(screen.getByRole("button", { name: "Review request" }));
  fireEvent.click(screen.getByRole("button", { name: "Send request" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Request sent" })).toBeDisabled(),
  );
  expect(requestGuideBooking).toHaveBeenCalledTimes(1);
  expect(requestGuideBooking).toHaveBeenCalledWith("token", "experience-1", {
    requestedDate: "2099-12-10",
    groupSize: 2,
    note: undefined,
  });
});
it("rejects a past date before review or sending", async () => {
  const { container } = render(
    <GuideBookingForm experienceId="experience-1" maxGroupSize={5} />,
  );
  await screen.findByText(/already-booked dates are unavailable/i);
  fireEvent.change(screen.getByLabelText("Date"), {
    target: { value: "2000-01-01" },
  });
  fireEvent.submit(container.querySelector("form")!);
  expect(screen.getByRole("alert")).toBeInTheDocument();
  expect(requestGuideBooking).not.toHaveBeenCalled();
});

it("rejects a date that is already booked before sending", async () => {
  const { apiRequest } = await import("../lib/http");
  (apiRequest as jest.Mock).mockResolvedValueOnce({
    enabled: false,
    weekdays: [],
    blockedDates: [],
    bookedDates: ["2099-12-10"],
  });
  const { container } = render(
    <GuideBookingForm experienceId="experience-1" maxGroupSize={5} />,
  );
  await screen.findByText(/already-booked dates are unavailable/i);
  fireEvent.change(screen.getByLabelText("Date"), {
    target: { value: "2099-12-10" },
  });
  fireEvent.submit(container.querySelector("form")!);
  expect(await screen.findByRole("alert")).toHaveTextContent("unavailable");
  expect(requestGuideBooking).not.toHaveBeenCalled();
});
