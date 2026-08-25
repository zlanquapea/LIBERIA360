import type { ComponentType } from 'react';
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
import {
  MdAccountBalance,
  MdAnchor,
  MdBeachAccess,
  MdChurch,
  MdCoffee,
  MdDiamond,
  MdDirectionsBoat,
  MdDirectionsBus,
  MdFactory,
  MdFitnessCenter,
  MdFlight,
  MdForest,
  MdFort,
  MdHiking,
  MdHotel,
  MdLocalGasStation,
  MdLocalHospital,
  MdLocalPharmacy,
  MdLocalPolice,
  MdLocationCity,
  MdMedication,
  MdMosque,
  MdNature,
  MdNightlife,
  MdPark,
  MdPets,
  MdRestaurant,
  MdSailing,
  MdSchool,
  MdStadium,
  MdSurfing,
  MdTerrain,
  MdTheaterComedy,
  MdWaterDrop,
  MdWaves,
} from 'react-icons/md';

// The minimal prop contract every consumer below actually relies on — not
// the full SVGProps<SVGSVGElement> Heroicons happen to expose. Narrowing to
// this lets the registry hold components from more than one icon library:
// every Heroicon's props (all optional) structurally satisfy this narrower
// shape, and so does react-icons' IconType (also all-optional props off
// SVGAttributes), so both slot into the same Record without a cast.
type IconComponent = ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;

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
  // County symbols (product feedback, Aug 25, 2026): "I want you to use an
  // icon that represents the symbol of each county" — Nimba is its
  // mountains, Montserrado is the capital, etc. Heroicons has no thematic
  // pictograms for this (see the comment above), so these 15 come from
  // Material Design instead, via react-icons/md. See COUNTY_SEEDS in
  // api/src/database/seed-data.ts for which county uses which and why.
  MdAnchor,
  MdCoffee,
  MdDiamond,
  MdFactory,
  MdFlight,
  MdForest,
  MdFort,
  MdLocationCity,
  MdNature,
  MdPark,
  MdSailing,
  MdSchool,
  MdSurfing,
  MdTerrain,
  MdWaves,
  // Category symbols (product feedback, Aug 25, 2026 — "do the same icon
  // thing for the categories"): swap in more literal Material icons
  // wherever one exists — a fork-and-plate for dining, a bed for hotels,
  // a gas pump for fuel stations — rather than settling for the nearest
  // generic Heroicon. See CATEGORY_SEEDS in api/src/database/seed-data.ts
  // and CATEGORY_ICON_KEYS below for which category uses which and why.
  MdAccountBalance,
  MdBeachAccess,
  MdDirectionsBoat,
  MdHiking,
  MdHotel,
  MdLocalGasStation,
  MdLocalPharmacy,
  MdNightlife,
  MdPets,
  MdRestaurant,
  MdWaterDrop,
  // Icons for admin-created categories (Aug 25, 2026) — these aren't
  // founding categories (see CATEGORY_ICON_KEYS below), so they only exist
  // as ICON_OPTIONS entries for the admin picker rather than a code-level
  // override; each one still needs picking once in Admin > Content >
  // Categories for its icon to actually take effect.
  MdChurch,
  MdDirectionsBus,
  MdFitnessCenter,
  MdLocalHospital,
  MdLocalPolice,
  MdMedication,
  MdMosque,
  MdStadium,
  MdTheaterComedy,
};

// The admin Category icon picker (see admin/content/CategoriesTab.tsx)
// offers exactly this set — a free-text field inviting an admin to type
// another emoji is exactly the bug this migration fixes, so the picker is a
// closed list, not a text input. County icons aren't admin-editable at all
// (see UpdateCountyDto/CountySeed's comments) — they're seed-owned, the same
// as a county's name and slug, so they don't need an entry here.
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
  // Material additions (Aug 25, 2026) — offered alongside the Heroicons
  // above for any category an admin creates that isn't one of the 13
  // founding ones CATEGORY_ICON_KEYS already pins in code (see its comment
  // below).
  { key: 'MdBeachAccess', label: 'Beach umbrella' },
  { key: 'MdWaterDrop', label: 'Water drop — waterfall' },
  { key: 'MdHiking', label: 'Hiking' },
  { key: 'MdRestaurant', label: 'Restaurant — dining' },
  { key: 'MdNightlife', label: 'Cocktail — nightlife' },
  { key: 'MdPets', label: 'Paw print — wildlife' },
  { key: 'MdHotel', label: 'Bed — hotel' },
  { key: 'MdDirectionsBoat', label: 'Boat' },
  { key: 'MdLocalPharmacy', label: 'Pharmacy' },
  { key: 'MdAccountBalance', label: 'Bank' },
  { key: 'MdLocalGasStation', label: 'Gas pump — fuel' },
  // Admin-created categories (Aug 25, 2026) — see the ICON_REGISTRY comment
  // above these same imports for why these are options here rather than a
  // CATEGORY_ICON_KEYS entry.
  { key: 'MdChurch', label: 'Church' },
  { key: 'MdMosque', label: 'Mosque' },
  { key: 'MdDirectionsBus', label: 'Bus — bus/taxi station' },
  { key: 'MdLocalHospital', label: 'Hospital / clinic' },
  { key: 'MdMedication', label: 'Pill bottle — pharmacy' },
  { key: 'MdLocalPolice', label: 'Police' },
  { key: 'MdFitnessCenter', label: 'Dumbbell — recreation center' },
  { key: 'MdStadium', label: 'Stadium' },
  { key: 'MdTheaterComedy', label: 'Theater masks — music/arts venue' },
  { key: 'MdPark', label: 'Park / garden' },
];

// The 13 founding categories (see CATEGORY_SEEDS in
// api/src/database/seed-data.ts) — pinned by slug for the same reason as
// COUNTY_ICON_KEYS above: a code change to one of these has no way to reach
// a row that already exists in a live database without a manual reseed,
// which isn't something to trigger casually (see COUNTY_ICON_KEYS's
// comment). Unlike counties, admins genuinely can create *more* categories
// through the admin panel, each with its own icon chosen from ICON_OPTIONS
// above — this map only overrides these 13 founding slugs, so that ability
// is untouched for anything else. One consequence worth knowing: changing
// one of these 13 categories' icon via the admin picker now has no visible
// effect, the same trade CountyIcon already made — if one of these needs a
// different icon, change it here instead of in the admin UI.
const CATEGORY_ICON_KEYS: Record<string, string> = {
  beaches: 'MdBeachAccess',
  'waterfalls-nature': 'MdWaterDrop',
  'hiking-adventure': 'MdHiking',
  'culture-heritage': 'BuildingLibraryIcon',
  'food-dining': 'MdRestaurant',
  nightlife: 'MdNightlife',
  'wildlife-eco-tourism': 'MdPets',
  'hotels-lodges': 'MdHotel',
  'city-shopping': 'ShoppingBagIcon',
  'islands-boat-trips': 'MdDirectionsBoat',
  'health-pharmacies': 'MdLocalPharmacy',
  'banks-atms': 'MdAccountBalance',
  'fuel-stations': 'MdLocalGasStation',
};

export function getIcon(key: string | null | undefined): IconComponent {
  return (key && ICON_REGISTRY[key]) || MapPinIcon;
}

// There are, and will only ever be, these 15 counties (Business Plan §9.1) —
// pinned here by slug rather than trusted from `County.icon` in the
// database. `County.icon` is seed-owned (see CountySeed/UpdateCountyDto's
// comments), and a deploy only ever runs migrations, never the seed script
// (render.yaml) — so a code change to a county's icon has no way to reach
// a row that already exists in a live database without someone manually
// re-running the seed, which also re-upserts the placeholder demo places
// and isn't something to do casually against production. Keying off the
// slug instead means the icon shown is whatever this file says, on every
// deploy, with zero database dependency — the fix ships the moment this
// code does. Keep this in sync with COUNTY_SEEDS in
// api/src/database/seed-data.ts (which remains the source of truth for a
// fresh/dev database and for any non-web consumer of the API).
const COUNTY_ICON_KEYS: Record<string, string> = {
  montserrado: 'MdLocationCity', // the capital — Monrovia's skyline
  margibi: 'MdFlight', // Roberts International Airport
  bong: 'MdSchool', // Cuttington University
  'grand-bassa': 'MdAnchor', // Buchanan — Liberia's 2nd-largest port
  'grand-cape-mount': 'MdSurfing', // Robertsport — internationally known surf spot
  nimba: 'MdTerrain', // Mount Nimba, Liberia's highest peak; iron ore
  sinoe: 'MdForest', // Sapo National Park — largest rainforest reserve
  maryland: 'MdFort', // Cape Palmas Lighthouse, historic Harper
  'grand-kru': 'MdSailing', // Kru people — historically famed West African seafarers
  bomi: 'MdFactory', // Tubmanburg / Bomi Hills — early iron-ore mining
  gbarpolu: 'MdDiamond', // artisanal gold/diamond mining
  'grand-gedeh': 'MdPark', // dense forest, Zwedru
  lofa: 'MdCoffee', // coffee/cocoa, Liberia's agricultural heartland
  'river-cess': 'MdWaves', // palm oil, rural rainforest
  'river-gee': 'MdNature', // newest county, coastal/forest border area
};

// Drop-in replacement for every `{county.icon}` render site — resolves by
// slug first (see COUNTY_ICON_KEYS above), falling back to whatever the
// database has for `icon` for any county not in that fixed list (there
// shouldn't be one, but a stray/future row shouldn't render blank), and
// from there to the same MapPinIcon default as everything else.
export function CountyIcon({
  county,
  className,
}: {
  county: { slug: string; icon?: string | null };
  className?: string;
}) {
  const Icon = getIcon(COUNTY_ICON_KEYS[county.slug] ?? county.icon);
  return <Icon aria-hidden className={className} />;
}

// For an admin edit form's <select> — the stored value has to be one of
// ICON_OPTIONS' keys or the browser just leaves the control on whatever
// its first <option> happens to be, silently out of sync with the actual
// saved value. Falls back the same way getIcon does, for the same reason
// (an unmigrated legacy emoji value, most likely).
export function normalizeIconKey(key: string | null | undefined): string {
  return key && ICON_REGISTRY[key] ? key : 'MapPinIcon';
}

// Drop-in replacement for every `{category.icon}` text render across the
// app. Pass `categorySlug` (the category's slug, when the caller has the
// full Category on hand) alongside `iconKey` so a founding category
// resolves through CATEGORY_ICON_KEYS first — see its comment for why that
// takes priority over whatever's in the database. `categorySlug` is
// optional and safe to omit: a category slug not in that fixed list, or no
// slug at all, just falls through to `iconKey` exactly as before.
export function CategoryIcon({
  iconKey,
  categorySlug,
  className,
}: {
  iconKey?: string | null;
  categorySlug?: string | null;
  className?: string;
}) {
  const Icon = getIcon((categorySlug && CATEGORY_ICON_KEYS[categorySlug]) || iconKey);
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
export function iconSvgMarkup(
  key: string | null | undefined,
  className = 'h-4 w-4',
  categorySlug?: string | null,
): string {
  const Icon = getIcon((categorySlug && CATEGORY_ICON_KEYS[categorySlug]) || key);
  const { renderToStaticMarkup } = require('react-dom/server.browser');
  return renderToStaticMarkup(<Icon className={className} />);
}
