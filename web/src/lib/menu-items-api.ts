import type { CreateMenuItemInput, MenuItem, MenuSettings, UpdateMenuItemInput, UpdateMenuSettingsInput } from './types';
import { apiRequest, authHeader } from './http';

// The full menu for one business — public (no auth) and identical to what
// the owner's own manage UI reads, since MenuItem has no draft/review
// state to hide (see MenuItemsService.findForBusiness's doc comment on the
// backend). Client-side fetch (not lib/api.ts's server apiFetch) so
// MenuItemsManager can call it directly and re-fetch after a mutation.
export function getMenuItems(businessId: string): Promise<MenuItem[]> {
  return apiRequest<MenuItem[]>(`/menu-items?businessId=${businessId}`);
}

export function createMenuItem(token: string, input: CreateMenuItemInput): Promise<MenuItem> {
  return apiRequest<MenuItem>('/menu-items', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export function updateMenuItem(token: string, id: string, input: UpdateMenuItemInput): Promise<MenuItem> {
  return apiRequest<MenuItem>(`/menu-items/${id}`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export function deleteMenuItem(token: string, id: string): Promise<void> {
  return apiRequest<void>(`/menu-items/${id}`, {
    method: 'DELETE',
    headers: authHeader(token),
  });
}

// Public — a business that never saved settings reads back the defaults.
export function getMenuSettings(businessId: string): Promise<MenuSettings> {
  return apiRequest<MenuSettings>(`/menu-settings/${businessId}`);
}

export function updateMenuSettings(
  token: string,
  businessId: string,
  input: UpdateMenuSettingsInput,
): Promise<MenuSettings> {
  return apiRequest<MenuSettings>(`/menu-settings/${businessId}`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}
