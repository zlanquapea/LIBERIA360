import type { FoodOrder } from './types';
import { apiRequest, authHeader } from './http';

export interface FoodOrderItemInput {
  menuItemId: string;
  quantity: number;
}

export interface CreateFoodOrderInput {
  items: FoodOrderItemInput[];
  notes?: string;
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
): Promise<FoodOrder> {
  return apiRequest<FoodOrder>(`/food-orders/${orderId}/respond`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify({ action, message }),
  });
}

export function cancelFoodOrder(token: string, orderId: string): Promise<FoodOrder> {
  return apiRequest<FoodOrder>(`/food-orders/${orderId}/cancel`, {
    method: 'PATCH',
    headers: authHeader(token),
  });
}
