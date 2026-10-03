/** The top-level tab a menu item lives under on the public menu. */
export enum MenuItemKind {
  FOOD = "food",
  DRINK = "drink",
  DESSERT = "dessert",
}

/** Fixed allowlist rather than freeform — each one renders as a styled
 * badge on the public menu, so an unknown string would have nothing to
 * render as. */
export const MENU_ITEM_TAGS = [
  "popular",
  "new",
  "spicy",
  "vegetarian",
  "vegan",
  "halal",
  "gluten_free",
] as const;

export type MenuItemTag = (typeof MENU_ITEM_TAGS)[number];

export const MENU_CURRENCIES = ["USD", "LRD"] as const;
export type MenuCurrency = (typeof MENU_CURRENCIES)[number];

export interface MenuOptionChoice {
  id: string;
  name: string;
  /** Added to the item's base price when chosen; 0 for a free choice. */
  priceDelta: number;
}

/** A customization group on one item — "Size" (pick 1, required), "Extras"
 * (pick up to 3, optional). `maxSelections: 1` renders as radio buttons,
 * anything higher as checkboxes. */
export interface MenuOptionGroup {
  id: string;
  name: string;
  required: boolean;
  maxSelections: number;
  choices: MenuOptionChoice[];
}
