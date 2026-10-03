import type { FoodFulfillment, FoodOrder, FoodPaymentMethod } from './types';
import { apiRequest, authHeader } from './http';

export interface FoodOrderItemInput {
  menuItemId: string;
  quantity: number;
  selections?: { groupId: string; choiceIds: string[] }[];
}

export interface CreateFoodOrderInput {
  items: FoodOrderItemInput[];
  notes?: string;
  // Required when any item contains alcohol.
  ageConfirmed?: boolean;
  fulfillment?: FoodFulfillment;
  // Both required for delivery.
  deliveryAddress?: string;
  contactPhone?: string;
  paymentMethod?: FoodPaymentMethod;
  // Mobile money transaction ID.
  paymentReference?: string;
}

export function createFoodOrder(
  token: string,
  businessId: string,
  input: CreateFoodOrderInput,
): Promise<FoodOrder> {
  return apiRequest<FoodOrder>(`/businesses/${businessId}/food-orders`, {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

// The signed-in buyer's own order history, across every restaurant —
// what "My Orders" renders.
export function getMyFoodOrders(token: string): Promise<FoodOrder[]> {
  return apiRequest<FoodOrder[]>('/food-orders/mine', { headers: authHeader(token) });
}

// A restaurant owner's incoming orders — mirrors getBusinessBookings.
export function getBusinessFoodOrders(token: string, businessId: string): Promise<FoodOrder[]> {
  return apiRequest<FoodOrder[]>(`/businesses/${businessId}/food-orders`, {
    headers: authHeader(token),
  });
}

export function respondToFoodOrder(
  token: string,
  orderId: string,
  action: 'confirm' | 'decline',
  message?: string,
  // Declining a mobile money order because the payment couldn't be found.
  paymentNotReceived?: boolean,
): Promise<FoodOrder> {
  return apiRequest<FoodOrder>(`/food-orders/${orderId}/respond`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify({ action, message, paymentNotReceived }),
  });
}

export type FoodOrderProgressStatus = 'preparing' | 'ready' | 'out_for_delivery' | 'completed';

export function updateFoodOrderStatus(
  token: string,
  orderId: string,
  status: FoodOrderProgressStatus,
): Promise<FoodOrder> {
  return apiRequest<FoodOrder>(`/food-orders/${orderId}/status`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify({ status }),
  });
}

export function markFoodOrderRefunded(token: string, orderId: string): Promise<FoodOrder> {
  return apiRequest<FoodOrder>(`/food-orders/${orderId}/refunded`, {
    method: 'PATCH',
    headers: authHeader(token),
  });
}

export function cancelFoodOrder(token: string, orderId: string): Promise<FoodOrder> {
  return apiRequest<FoodOrder>(`/food-orders/${orderId}/cancel`, {
    method: 'PATCH',
    headers: authHeader(token),
  });
}
