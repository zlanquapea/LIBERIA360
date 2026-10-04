import { GuidesService } from "./guides.service";
it("distinguishes booking-backed reviews from community reviews without exposing booking IDs", async () => {
  const repo = {
    find: jest.fn().mockResolvedValue([
      { id: "booked", rating: 5, bookingId: "private-booking-id" },
      { id: "community", rating: 4, bookingId: null },
    ]),
  };
  const service = new GuidesService(
    {} as never,
    {} as never,
    {} as never,
    repo as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { assertCanContact: jest.fn().mockResolvedValue(undefined) } as never,
  );
  const result = await service.getGuideReviews("guide");
  expect(result[0].verifiedBooking).toBe(true);
  expect(result[1].verifiedBooking).toBe(false);
  expect(result[0]).not.toHaveProperty("bookingId");
});
