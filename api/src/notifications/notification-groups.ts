export const notificationGroups = [
  "bookings",
  "messages",
  "trips",
  "creators",
] as const;
export type NotificationGroup = (typeof notificationGroups)[number];
export function notificationGroup(type: string): NotificationGroup | null {
  if (type.includes("message")) return "messages";
  if (
    type.startsWith("booking.") ||
    type.startsWith("food_order.") ||
    type.startsWith("pharmacy_order.") ||
    type.startsWith("prescription.") ||
    type.startsWith("consultation.") ||
    type.startsWith("stay.") ||
    type.startsWith("rental.")
  )
    return "bookings";
  if (type.startsWith("trip.")) return "trips";
  if (type.startsWith("creator.")) return "creators";
  return null;
}
export const groupPrefixes: Record<NotificationGroup, string[]> = {
  bookings: [
    "booking.%",
    "food_order.%",
    "pharmacy_order.%",
    "prescription.%",
    "consultation.%",
    "stay.%",
    "rental.%",
  ],
  messages: ["%message%"],
  trips: ["trip.%"],
  creators: ["creator.%"],
};
