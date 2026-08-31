/** Same request/confirm/decline/cancel lifecycle as BookingStatus — a food
 * order is another kind of "guest asks, business owner responds" request,
 * just with a cart of menu items instead of a date. No real payment moves
 * through the app yet (same product decision as bookings): the business
 * confirms availability/prep time, payment is settled the same way it
 * already is for a reservation (in person, on pickup/delivery). */
export enum FoodOrderStatus {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  DECLINED = "declined",
  CANCELLED = "cancelled",
}
