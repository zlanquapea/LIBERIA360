import { CategoryIcon } from '@/lib/icons';

// Every marker in this app renders as a centered circular "dot" rather than
// Google's default bottom-anchored teardrop pin — this pins these exactly on
// their coordinate the same way the app's previous Leaflet markers did
// (iconAnchor at the icon's center, not its bottom tip). Spread this onto
// every <AdvancedMarker> that uses one of the components below.
export const CENTERED_MARKER_ANCHOR = { anchorLeft: '-50%', anchorTop: '-50%' } as const;

// "You are here" — a pulsing blue dot, the same convention as every map app,
// distinct from every category pin so it's never mistaken for a place.
export function UserLocationDot() {
  return (
    <div className="relative flex h-5 w-5 items-center justify-center">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-60" />
      <span className="relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-white bg-sky-500 shadow-md" />
    </div>
  );
}

export function CategoryMapPin({
  color,
  icon,
  categorySlug,
  selected,
}: {
  color: string;
  icon: string | null;
  categorySlug: string;
  selected?: boolean;
}) {
  return (
    <div
      style={{ background: color }}
      className={`flex ${selected ? 'h-10 w-10' : 'h-8 w-8'} items-center justify-center rounded-full border-2 border-white shadow-md ${
        selected ? 'ring-2 ring-offset-1 ring-slate-900' : ''
      }`}
    >
      <CategoryIcon iconKey={icon} categorySlug={categorySlug} className="h-4 w-4 text-white" />
    </div>
  );
}

// The plain brand-colored dot used wherever there's no category or day
// number to show — event locations and the admin place-location picker.
export function BrandMapPin() {
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-brand-700 shadow-md">
      <div className="h-2.5 w-2.5 rounded-full bg-white" />
    </div>
  );
}

export function DayMapPin({ day, color }: { day: number; color: string }) {
  return (
    <div
      style={{ background: color }}
      className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow-md"
    >
      {day}
    </div>
  );
}
