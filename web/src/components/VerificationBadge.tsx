import type { ComponentType, SVGProps } from 'react';
import { CheckBadgeIcon, StarIcon, BuildingLibraryIcon, SparklesIcon, HeartIcon } from '@heroicons/react/24/solid';
import type { VerificationStatus } from '@/lib/types';

// Verification badges are how the catalog solves the "outdated directory"
// trust problem (Business Plan §5.1, Tech Spec §7). Unverified places
// intentionally render no badge at all, rather than a muted "unverified" one
// — a blank state reads more honestly than a badge that looks like a claim.
const BADGE_CONFIG: Partial<
  Record<VerificationStatus, { label: string; icon: ComponentType<SVGProps<SVGSVGElement>>; className: string }>
> = {
  verified: { label: 'Verified', icon: CheckBadgeIcon, className: 'bg-brand-600 text-white' },
  recommended: { label: 'Recommended', icon: StarIcon, className: 'bg-amber-500 text-white' },
  official: { label: 'Official', icon: BuildingLibraryIcon, className: 'bg-slate-700 text-white' },
  eco_certified: { label: 'Eco Certified', icon: SparklesIcon, className: 'bg-emerald-600 text-white' },
  community_favorite: { label: 'Community Favorite', icon: HeartIcon, className: 'bg-rose-500 text-white' },
};

export function VerificationBadge({ status, compact = false }: { status: VerificationStatus; compact?: boolean }) {
  const config = BADGE_CONFIG[status];
  if (!config) return null;
  const Icon = config.icon;

  if (compact) {
    return (
      <span className="inline-flex shrink-0 items-center" title={config.label} aria-label={config.label}>
        <Icon aria-hidden className="h-5 w-5 text-brand-600 dark:text-brand-400" />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${config.className}`}
    >
      <Icon aria-hidden className="h-3 w-3" />
      {config.label}
    </span>
  );
}
