import type { MenuItem } from './types';

export const MAX_LINE_QUANTITY = 20;

export interface CartSelection {
  groupId: string;
  choiceIds: string[];
}

export interface CartLine {
  // Same item with different options is a different line ("Large" and
  // "Regular" jollof are two rows), so the key includes the selections.
  key: string;
  menuItemId: string;
  quantity: number;
  selections: CartSelection[];
}

function normalizedSelections(selections: CartSelection[]): CartSelection[] {
  return selections
    .filter((s) => s.choiceIds.length > 0)
    .map((s) => ({ groupId: s.groupId, choiceIds: [...s.choiceIds].sort() }))
    .sort((a, b) => a.groupId.localeCompare(b.groupId));
}

export function lineKey(menuItemId: string, selections: CartSelection[]): string {
  const signature = normalizedSelections(selections)
    .map((s) => `${s.groupId}:${s.choiceIds.join(',')}`)
    .join('|');
  return signature ? `${menuItemId}#${signature}` : menuItemId;
}

/** Mirrors the API's priceLine checks, returning the first problem as a
 * customer-facing message (null when the selections are complete). */
export function selectionError(item: MenuItem, selections: CartSelection[]): string | null {
  for (const selection of selections) {
    if (!item.optionGroups.some((g) => g.id === selection.groupId)) return 'These options are no longer available';
  }
  for (const group of item.optionGroups) {
    const chosen = selections.find((s) => s.groupId === group.id)?.choiceIds ?? [];
    if (group.required && chosen.length === 0) return `Choose ${group.name.toLowerCase()}`;
    if (chosen.length > group.maxSelections) return `Choose up to ${group.maxSelections} for ${group.name}`;
    if (chosen.some((id) => !group.choices.some((c) => c.id === id))) return 'These options are no longer available';
  }
  return null;
}

export function unitPriceFor(item: MenuItem, selections: CartSelection[]): number {
  let total = item.price;
  for (const group of item.optionGroups) {
    const chosen = selections.find((s) => s.groupId === group.id)?.choiceIds ?? [];
    for (const choice of group.choices) {
      if (chosen.includes(choice.id)) total += choice.priceDelta;
    }
  }
  return Math.round(total * 100) / 100;
}

/** "Large · Egg, Plantain" — chosen option names in menu order. */
export function describeSelections(item: MenuItem, selections: CartSelection[]): string {
  return item.optionGroups
    .map((group) => {
      const chosen = selections.find((s) => s.groupId === group.id)?.choiceIds ?? [];
      return group.choices
        .filter((c) => chosen.includes(c.id))
        .map((c) => c.name)
        .join(', ');
    })
    .filter(Boolean)
    .join(' · ');
}

export function addToCart(lines: CartLine[], menuItemId: string, selections: CartSelection[], quantity: number): CartLine[] {
  const normalized = normalizedSelections(selections);
  const key = lineKey(menuItemId, normalized);
  const existing = lines.find((l) => l.key === key);
  if (existing) {
    return lines.map((l) =>
      l.key === key ? { ...l, quantity: Math.min(MAX_LINE_QUANTITY, l.quantity + quantity) } : l,
    );
  }
  return [...lines, { key, menuItemId, quantity: Math.min(MAX_LINE_QUANTITY, quantity), selections: normalized }];
}

export function setLineQuantity(lines: CartLine[], key: string, quantity: number): CartLine[] {
  if (quantity <= 0) return lines.filter((l) => l.key !== key);
  return lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(MAX_LINE_QUANTITY, quantity) } : l));
}

/** Drops lines a menu edit has since invalidated (item removed, sold out,
 * options changed) — matters for a cart restored from storage. */
export function pruneCart(lines: CartLine[], items: MenuItem[]): CartLine[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  return lines.filter((line) => {
    const item = byId.get(line.menuItemId);
    return item?.isAvailable && selectionError(item, line.selections) === null;
  });
}

export function cartSummary(lines: CartLine[], items: MenuItem[]): { count: number; subtotal: number; hasAlcohol: boolean } {
  const byId = new Map(items.map((i) => [i.id, i]));
  let count = 0;
  let subtotal = 0;
  let hasAlcohol = false;
  for (const line of lines) {
    const item = byId.get(line.menuItemId);
    if (!item) continue;
    count += line.quantity;
    subtotal += unitPriceFor(item, line.selections) * line.quantity;
    if (item.containsAlcohol) hasAlcohol = true;
  }
  return { count, subtotal: Math.round(subtotal * 100) / 100, hasAlcohol };
}

const storageKey = (businessId: string) => `liberia360:menu-cart:${businessId}`;

export function loadCart(businessId: string): CartLine[] {
  try {
    const raw = window.localStorage.getItem(storageKey(businessId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCart(businessId: string, lines: CartLine[]): void {
  try {
    if (lines.length === 0) window.localStorage.removeItem(storageKey(businessId));
    else window.localStorage.setItem(storageKey(businessId), JSON.stringify(lines));
  } catch {
    // Private mode / storage blocked — the cart just won't survive a reload.
  }
}
