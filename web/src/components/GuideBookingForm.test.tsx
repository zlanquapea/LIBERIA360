import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { GuideBookingForm } from "./GuideBookingForm";
import { requestGuideBooking } from "../lib/guides-api";
jest.mock("../hooks/useAuth", () => ({ useAuth: () => ({ token: "token" }) }));
jest.mock("../lib/guides-api", () => ({
  requestGuideBooking: jest.fn().mockResolvedValue({}),
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
it("rejects a past date before review or sending", () => {
  const { container } = render(
    <GuideBookingForm experienceId="experience-1" maxGroupSize={5} />,
  );
  fireEvent.change(screen.getByLabelText("Date"), {
    target: { value: "2000-01-01" },
  });
  fireEvent.submit(container.querySelector("form")!);
  expect(screen.getByRole("alert")).toBeInTheDocument();
  expect(requestGuideBooking).not.toHaveBeenCalled();
});
