import type { BusinessType, MenuItem, MenuItemKind, MenuItemTag } from './types';

/** Mirrors the API's MENU_BUSINESS_TYPES. */
export const MENU_BUSINESS_TYPES: BusinessType[] = ['restaurant', 'bar'];

export function businessHasMenu(type: BusinessType): boolean {
  return MENU_BUSINESS_TYPES.includes(type);
}

export const MENU_KIND_LABELS: Record<MenuItemKind, string> = {
  food: 'Food',
  drink: 'Drinks',
  dessert: 'Desserts',
};

export const MENU_KIND_EMOJI: Record<MenuItemKind, string> = {
  food: '🍲',
  drink: '🍹',
  dessert: '🍰',
};

export const MENU_TAGS: MenuItemTag[] = ['popular', 'new', 'spicy', 'vegetarian', 'vegan', 'halal', 'gluten_free'];

export const MENU_TAG_LABELS: Record<MenuItemTag, string> = {
  popular: 'Popular',
  new: 'New',
  spicy: 'Spicy',
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  halal: 'Halal',
  gluten_free: 'Gluten-free',
};

export const MENU_TAG_STYLES: Record<MenuItemTag, string> = {
  popular: 'bg-gold-100 text-gold-800 dark:bg-gold-900/40 dark:text-gold-200',
  new: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
  spicy: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200',
  vegetarian: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  vegan: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  halal: 'bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200',
  gluten_free: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
};

/** Tabs in display order — bars lead with drinks. Only kinds that
 * actually have items are returned. */
export function menuKindsInOrder(items: MenuItem[], businessType: BusinessType): MenuItemKind[] {
  const order: MenuItemKind[] = businessType === 'bar' ? ['drink', 'food', 'dessert'] : ['food', 'drink', 'dessert'];
  return order.filter((kind) => items.some((item) => item.kind === kind));
}

/** Sections within one tab, in the order the API returns items
 * (category, then sortOrder); uncategorized items go last. */
export function groupBySection(items: MenuItem[], fallback: string): { section: string; items: MenuItem[] }[] {
  const groups: { section: string; items: MenuItem[] }[] = [];
  for (const item of items) {
    const section = item.category ?? fallback;
    const group = groups.find((g) => g.section === section);
    if (group) group.items.push(item);
    else groups.push({ section, items: [item] });
  }
  const uncategorized = groups.findIndex((g) => g.section === fallback);
  if (uncategorized >= 0 && uncategorized < groups.length - 1) {
    groups.push(...groups.splice(uncategorized, 1));
  }
  return groups;
}
