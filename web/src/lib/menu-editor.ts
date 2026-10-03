import type { CreateMenuItemInput, MenuItem, MenuItemKind, MenuItemTag, MenuOptionGroupInput } from './types';

// Mirrors the API's MenuOptionGroupDto / CreateMenuItemDto bounds.
export const MAX_OPTION_GROUPS = 10;
export const MAX_CHOICES_PER_GROUP = 20;
export const MAX_MENU_PRICE = 100000;

export interface DraftChoice {
  key: string; // React key, stable across edits
  id?: string; // server id, kept so existing carts/orders keep matching
  name: string;
  priceDelta: string;
}

export interface DraftGroup {
  key: string;
  id?: string;
  name: string;
  required: boolean;
  maxSelections: number;
  choices: DraftChoice[];
}

export interface MenuItemDraft {
  name: string;
  description: string;
  price: string;
  category: string;
  image: string | null;
  kind: MenuItemKind;
  tags: MenuItemTag[];
  servingSize: string;
  containsAlcohol: boolean;
  isAvailable: boolean;
  groups: DraftGroup[];
}

let keySeq = 0;
export function draftKey(): string {
  keySeq += 1;
  return `k${keySeq}`;
}

export function emptyDraft(kind: MenuItemKind = 'food'): MenuItemDraft {
  return {
    name: '',
    description: '',
    price: '',
    category: '',
    image: null,
    kind,
    tags: [],
    servingSize: '',
    containsAlcohol: false,
    isAvailable: true,
    groups: [],
  };
}

export function draftFromItem(item: MenuItem): MenuItemDraft {
  return {
    name: item.name,
    description: item.description ?? '',
    price: String(item.price),
    category: item.category ?? '',
    image: item.image,
    kind: item.kind,
    tags: [...item.tags],
    servingSize: item.servingSize ?? '',
    containsAlcohol: item.containsAlcohol,
    isAvailable: item.isAvailable,
    groups: item.optionGroups.map((g) => ({
      key: draftKey(),
      id: g.id,
      name: g.name,
      required: g.required,
      maxSelections: g.maxSelections,
      choices: g.choices.map((c) => ({ key: draftKey(), id: c.id, name: c.name, priceDelta: String(c.priceDelta) })),
    })),
  };
}

export type OptionGroupPreset = 'size' | 'addons' | 'mixer' | 'blank';

export function presetGroup(preset: OptionGroupPreset): DraftGroup {
  const choice = (name: string, priceDelta = '0'): DraftChoice => ({ key: draftKey(), name, priceDelta });
  switch (preset) {
    case 'size':
      return {
        key: draftKey(),
        name: 'Size',
        required: true,
        maxSelections: 1,
        choices: [choice('Regular'), choice('Large', '2')],
      };
    case 'addons':
      return {
        key: draftKey(),
        name: 'Add-ons',
        required: false,
        maxSelections: 3,
        choices: [choice('Extra meat', '2'), choice('Fried plantain', '1')],
      };
    case 'mixer':
      return {
        key: draftKey(),
        name: 'Mixer',
        required: false,
        maxSelections: 1,
        choices: [choice('Coke'), choice('Sprite'), choice('Tonic water')],
      };
    default:
      return { key: draftKey(), name: '', required: false, maxSelections: 1, choices: [choice('')] };
  }
}

function parseMoney(value: string): number | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= MAX_MENU_PRICE ? n : null;
}

/** The first problem that would stop a save, in the order a person reads
 * the form, or null when the draft is ready. */
export function draftError(draft: MenuItemDraft): string | null {
  if (!draft.name.trim()) return 'Give the item a name';
  if (parseMoney(draft.price) === null) return 'Enter a valid price';
  for (const [i, group] of draft.groups.entries()) {
    const label = group.name.trim() || `Option group ${i + 1}`;
    if (!group.name.trim()) return `Name option group ${i + 1} (e.g. Size, Add-ons)`;
    if (group.choices.length === 0) return `Add at least one choice to ${label}`;
    if (group.choices.some((c) => !c.name.trim())) return `Every choice in ${label} needs a name`;
    if (group.choices.some((c) => parseMoney(c.priceDelta || '0') === null)) {
      return `Check the extra prices in ${label}`;
    }
  }
  return null;
}

function groupsToInput(groups: DraftGroup[]): MenuOptionGroupInput[] {
  return groups.map((g) => ({
    ...(g.id ? { id: g.id } : {}),
    name: g.name.trim(),
    required: g.required,
    maxSelections: Math.max(1, Math.min(g.maxSelections, g.choices.length)),
    choices: g.choices.map((c) => ({
      ...(c.id ? { id: c.id } : {}),
      name: c.name.trim(),
      priceDelta: parseMoney(c.priceDelta || '0') ?? 0,
    })),
  }));
}

/** Full payload for both create and update. Empty text fields go as "" so
 * an edit can clear them (the API stores those as null). Call only after
 * draftError() returns null. */
export function draftToInput(draft: MenuItemDraft): Omit<CreateMenuItemInput, 'businessId'> {
  return {
    name: draft.name.trim(),
    description: draft.description.trim(),
    price: parseMoney(draft.price) ?? 0,
    category: draft.category.trim(),
    image: draft.image ?? '',
    kind: draft.kind,
    tags: draft.tags,
    servingSize: draft.servingSize.trim(),
    containsAlcohol: draft.containsAlcohol,
    isAvailable: draft.isAvailable,
    optionGroups: groupsToInput(draft.groups),
  };
}
