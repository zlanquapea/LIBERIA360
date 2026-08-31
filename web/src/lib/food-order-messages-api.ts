import type { FoodOrderMessage } from './types';
import { apiRequest, authHeader } from './http';

export function getFoodOrderMessages(token: string, orderId: string): Promise<FoodOrderMessage[]> {
  return apiRequest<FoodOrderMessage[]>(`/food-orders/${orderId}/messages`, {
    headers: authHeader(token),
  });
}

export function sendFoodOrderMessage(
  token: string,
  orderId: string,
  body: string,
): Promise<FoodOrderMessage> {
  return apiRequest<FoodOrderMessage>(`/food-orders/${orderId}/messages`, {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify({ body }),
  });
}

// Marks every message the *other* participant sent on this order as read —
// call this once the current user has the thread open, so their
// counterpart's messages flip from "Delivered" to "Viewed" on their end.
// Mirrors markBookingMessagesRead.
export function markFoodOrderMessagesRead(token: string, orderId: string): Promise<{ success: true }> {
  return apiRequest<{ success: true }>(`/food-orders/${orderId}/messages/read`, {
    method: 'PATCH',
    headers: authHeader(token),
  });
}
