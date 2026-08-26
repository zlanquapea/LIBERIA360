import type { ComponentType } from 'react';
import {
  MdAcUnit,
  MdFreeBreakfast,
  MdLocalBar,
  MdLocalLaundryService,
  MdLocalParking,
  MdLocalTaxi,
  MdPets,
  MdPool,
  MdRestaurant,
  MdRoomService,
  MdTour,
  MdWifi,
} from 'react-icons/md';

type IconComponent = ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;

// Curated amenities a hotel/restaurant/tour operator can pick from when
// claiming or editing their listing, in place of typing "Wifi, Pool, ..."
// freehand into a text box (product feedback, Aug 2026: "create amenities
// like wifi, pool, etc."). The stored value (Business.servicesOffered) is
// still just a string[], so a user's own custom entry — via the picker's
// freeform "other" field — is stored the same way and simply falls back to
// GENERIC_AMENITY_ICON below when displayed, no schema change needed.
export const AMENITY_PRESETS: { label: string; icon: IconComponent }[] = [
  { label: 'WiFi', icon: MdWifi },
  { label: 'Swimming pool', icon: MdPool },
  { label: 'Parking', icon: MdLocalParking },
  { label: 'Air conditioning', icon: MdAcUnit },
  { label: 'Breakfast included', icon: MdFreeBreakfast },
  { label: 'Room service', icon: MdRoomService },
  { label: 'Airport pickup', icon: MdLocalTaxi },
  { label: 'Guided tours', icon: MdTour },
  { label: 'Pet friendly', icon: MdPets },
  { label: 'Bar', icon: MdLocalBar },
  { label: 'On-site restaurant', icon: MdRestaurant },
  { label: 'Laundry service', icon: MdLocalLaundryService },
];

const AMENITY_ICON_BY_LABEL: Record<string, IconComponent> = Object.fromEntries(
  AMENITY_PRESETS.map(({ label, icon }) => [label.toLowerCase(), icon]),
);

const GENERIC_AMENITY_ICON: IconComponent = MdRoomService;

// Case-insensitive lookup so a preset picked from AMENITY_PRESETS always
// resolves its own icon; any custom/legacy string (typed before this picker
// existed, or entered via the picker's "other" field) falls back to a
// generic icon rather than rendering nothing.
export function iconForAmenity(label: string): IconComponent {
  return AMENITY_ICON_BY_LABEL[label.trim().toLowerCase()] ?? GENERIC_AMENITY_ICON;
}
