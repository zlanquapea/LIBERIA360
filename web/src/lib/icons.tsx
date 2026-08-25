import type { ComponentType, SVGProps } from 'react';
import {
  AcademicCapIcon,
  BanknotesIcon,
  BeakerIcon,
  BuildingLibraryIcon,
  BuildingOfficeIcon,
  BuildingOffice2Icon,
  BuildingStorefrontIcon,
  CakeIcon,
  CalendarDaysIcon,
  CreditCardIcon,
  FlagIcon,
  GlobeAltIcon,
  GlobeAmericasIcon,
  GlobeAsiaAustraliaIcon,
  GlobeEuropeAfricaIcon,
  HeartIcon,
  HomeModernIcon,
  LifebuoyIcon,
  MapIcon,
  MapPinIcon,
  MoonIcon,
  MusicalNoteIcon,
  PaperAirplaneIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  SparklesIcon,
  SunIcon,
  TicketIcon,
  TruckIcon,
} from '@heroicons/react/24/solid';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

// Real icon system (external consultant review, Aug 2026): `Category.icon`
// and `County.icon` used to store a literal emoji character, rendered
// as-is everywhere from map pins to admin tables. Emoji render
// inconsistently across iOS/Android/desktop (different glyph sets, some
// missing entirely), can't be recolored or reliably sized, and read as
// unpolished next to the rest of the UI, which already uses Heroicons
// throughout. Both fields now store one of the Heroicon component names
// below instead — resolved through this registry, with `MapPinIcon` as the
// fallback for anything unrecognized (including, harmlessly, any leftover
// emoji value that hasn't been migrated).
//
// Heroicons is a general UI icon set, not a thematic pictogram set — there
// is no dedicated "waterfall," "mountain," or "palm tree" icon, so a few
// mappings below (see seed-data.ts's CATEGORY_SEEDS/COUNTY_SEEDS) are the
// closest reasonable semantic fit rather than a literal picture. That's a
// real limitation, not an oversight.
export const ICON_REGISTRY: Record<string, IconComponent> = {
  AcademicCapIcon,
  BanknotesIcon,
  BeakerIcon,
  BuildingLibraryIcon,
  BuildingOfficeIcon,
  BuildingOffice2Icon,
  BuildingStorefrontIcon,
  CakeIcon,
  CalendarDaysIcon,
  CreditCardIcon,
  FlagIcon,
  GlobeAltIcon,
  GlobeAmericasIcon,
  GlobeAsiaAustraliaIcon,
  GlobeEuropeAfricaIcon,
  HeartIcon,
  HomeModernIcon,
  LifebuoyIcon,
  MapIcon,
  MapPinIcon,
  MoonIcon,
  MusicalNoteIcon,
  PaperAirplaneIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  SparklesIcon,
  SunIcon,
  TicketIcon,
  TruckIcon,
};

// The admin Category/County icon picker (see admin/content/CategoriesTab.tsx
// and CountiesTab.tsx) offers exactly this set — a free-text field inviting
// an admin to type another emoji is exactly the bug this migration fixes,
// so the picker is a closed list, not a text input.
export const ICON_OPTIONS: { key: string; label: string }[] = [
  { key: 'MapPinIcon', label: 'Pin (general/default)' },
  { key: 'SunIcon', label: 'Sun — beach/coast' },
  { key: 'GlobeAmericasIcon', label: 'Globe — nature' },
  { key: 'GlobeAsiaAustraliaIcon', label: 'Globe — wildlife/eco' },
  { key: 'GlobeEuropeAfricaIcon', label: 'Globe — forest' },
  { key: 'GlobeAltIcon', label: 'Globe — general' },
  { key: 'MapIcon', label: 'Trail map — hiking/adventure' },
  { key: 'BuildingLibraryIcon', label: 'Library — culture/heritage' },
  { key: 'BuildingOfficeIcon', label: 'Government building' },
  { key: 'BuildingOffice2Icon', label: 'Landmark building' },
  { key: 'BuildingStorefrontIcon', label: 'Storefront' },
  { key: 'HomeModernIcon', label: 'Hotel / lodging' },
  { key: 'CakeIcon', label: 'Food & dining' },
  { key: 'MoonIcon', label: 'Moon — nightlife' },
  { key: 'MusicalNoteIcon', label: 'Music' },
  { key: 'ShoppingBagIcon', label: 'Shopping' },
  { key: 'LifebuoyIcon', label: 'Lifebuoy — boat/island/coastal' },
  { key: 'TicketIcon', label: 'Ticket — events' },
  { key: 'CalendarDaysIcon', label: 'Calendar' },
  { key: 'AcademicCapIcon', label: 'Education' },
  { key: 'PaperAirplaneIcon', label: 'Airport / travel' },
  { key: 'TruckIcon', label: 'Transport / fuel' },
  { key: 'FlagIcon', label: 'Landmark / peak' },
  { key: 'BeakerIcon', label: 'Mining / industry' },
  { key: 'SparklesIcon', label: 'Gems / sparkle' },
  { key: 'HeartIcon', label: 'Health / pharmacy' },
  { key: 'BanknotesIcon', label: 'Cash / ATM' },
  { key: 'CreditCardIcon', label: 'Finance / payments' },
  { key: 'ShieldCheckIcon', label: 'Safety / verified' },
];

export function getIcon(key: string | null | undefined): IconComponent {
  return (key && ICON_REGISTRY[key]) || MapPinIcon;
}

// For an admin edit form's <select> — the stored value has to be one of
// ICON_OPTIONS' keys or the browser just leaves the control on whatever
// its first <option> happens to be, silently out of sync with the actual
// saved value. Falls back the same way getIcon does, for the same reason
// (an unmigrated legacy emoji value, most likely).
export function normalizeIconKey(key: string | null | undefined): string {
  return key && ICON_REGISTRY[key] ? key : 'MapPinIcon';
}

// Drop-in replacement for every `{category.icon}` / `{county.icon}` text
// render across the app.
export function CategoryIcon({ iconKey, className }: { iconKey?: string | null; className?: string }) {
  const Icon = getIcon(iconKey);
  return <Icon aria-hidden className={className} />;
}

// Leaflet's divIcon (ExploreMapClient, PlaceMiniMapClient) renders a raw
// HTML string, not JSX, so a <CategoryIcon /> can't be dropped in directly
// there the way it is everywhere else — this serializes the same Heroicon
// to static markup once, at marker-build time. `react-dom/server.browser`
// is required lazily, inside the function, rather than imported at module
// scope: it references browser globals (MessageChannel, TextEncoder) that
// every real browser and `next build` have but Jest's jsdom test
// environment doesn't, and every other export from this file (CategoryIcon
// itself, used throughout the app) has to stay usable in a unit test
// without pulling that in.
export function iconSvgMarkup(key: string | null | undefined, className = 'h-4 w-4'): string {
  const Icon = getIcon(key);
  const { renderToStaticMarkup } = require('react-dom/server.browser');
  return renderToStaticMarkup(<Icon className={className} />);
}
