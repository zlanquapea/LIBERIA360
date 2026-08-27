import Link from 'next/link';
import {
  ClockIcon,
  MapPinIcon,
  SparklesIcon,
  StarIcon,
  TagIcon,
} from '@heroicons/react/24/outline';

type FilterChip = {
  label: string;
  href: string;
  icon: typeof MapPinIcon;
  active?: boolean;
};

type QuickFilterChipsProps = {
  surface?: 'hero' | 'light';
};

const FILTERS: FilterChip[] = [
  { label: 'Near me', href: '/near-me', icon: MapPinIcon, active: true },
  { label: 'Open now', href: '/search?openNow=true', icon: ClockIcon },
  { label: 'Free', href: '/search?priceMax=0', icon: TagIcon },
  { label: 'Highly reviewed', href: '/search?sort=rating', icon: StarIcon },
  { label: 'Explore all', href: '/search', icon: SparklesIcon },
];

/**
 * Compact, touch-friendly search shortcuts. Each chip maps to an existing
 * route/query parameter; there are no dead buttons or invented catalog facts.
 */
export function QuickFilterChips({ surface = 'hero' }: QuickFilterChipsProps) {
  const isLight = surface === 'light';

  return (
    <nav aria-label="Quick discovery filters" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0">
      {FILTERS.map(({ label, href, icon: Icon, active }) => (
        <Link
          key={label}
          href={href}
          className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2 sm:text-sm ${
            active
              ? 'border-brand-600 bg-brand-600 text-white hover:bg-brand-500'
              : isLight
                ? 'border-slate-300 bg-white text-brand-900 hover:border-brand-400 hover:bg-brand-50'
                : 'border-white/40 bg-white/10 text-white hover:border-white hover:bg-white/20'
          }`}
        >
          <Icon aria-hidden className="h-4 w-4" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
