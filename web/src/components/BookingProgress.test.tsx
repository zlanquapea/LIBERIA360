import { render, screen } from "@testing-library/react";
import { BookingProgress } from "./BookingProgress";
it("never describes a pending request as confirmed", () => {
  render(<BookingProgress status="pending" />);
  expect(screen.getByText(/do not have a confirmed reservation/)).toBeInTheDocument();
  expect(screen.queryByText("Completed")).not.toBeInTheDocument();
});
it("shows completion for supported guide bookings", () => {
  render(<BookingProgress status="completed" tracksCompletion />);
  expect(screen.getByText("Completed").closest("li")).toHaveAttribute("aria-current", "step");
});
it("shows a cancelled booking as inactive instead of successful progress", () => {
  render(<BookingProgress status="cancelled" />);
  expect(screen.queryByRole("list")).not.toBeInTheDocument();
  expect(screen.getByText("Booking cancelled")).toBeInTheDocument();
});
