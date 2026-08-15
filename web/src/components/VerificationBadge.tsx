import type { VerificationStatus } from '@/lib/types';

// Verification badges are how the catalog solves the "outdated directory"
// trust problem (Business Plan §5.1, Tech Spec §7). Unverified places
// intentionally render no badge at all, rather than a muted "unverified" one
// — a blank state reads more honestly than a badge that looks like a claim.
const BADGE_CONFIG: Partial<Record<VerificationStatus, { label: string; className: string }>> = {
  verified: { label: '✓ Verified', className: 'bg-brand-600 text-white' },
  recommended: { label: '★ Recommended', className: 'bg-amber-500 text-white' },
  official: { label: '🏛 Official', className: 'bg-slate-700 text-white' },
  eco_certified: { label: '🌿 Eco Certified', className: 'bg-emerald-600 text-white' },
  community_favorite: { label: '♥ Community Favorite', className: 'bg-rose-500 text-white' },
};

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const config = BADGE_CONFIG[status];
  if (!config) return null;

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}
