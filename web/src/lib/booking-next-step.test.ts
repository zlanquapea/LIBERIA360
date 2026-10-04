import { bookingNextStep, bookingPeriod } from "./booking-next-step";
it("separates upcoming, ended, and past dates without claiming completion", () => {
  expect(bookingPeriod("confirmed", "2026-10-06", "2026-10-04")).toBe(
    "upcoming",
  );
  expect(bookingPeriod("cancelled", "2026-10-06", "2026-10-04")).toBe(
    "history",
  );
  expect(bookingPeriod("confirmed", "2026-10-01", "2026-10-04")).toBe(
    "history",
  );
  expect(bookingNextStep("confirmed", false, true)).toContain(
    "status needs clarification",
  );
  expect(bookingNextStep("requested")).toContain("not confirmed");
  expect(bookingNextStep("pending", true)).toContain("confirm or decline");
});
