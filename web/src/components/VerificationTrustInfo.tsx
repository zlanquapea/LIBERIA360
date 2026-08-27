import { InformationCircleIcon } from '@heroicons/react/24/outline';
import type { VerificationStatus } from '@/lib/types';

const TRUST_COPY: Partial<Record<VerificationStatus, string>> = {
  verified:
    'LIBERIA360 has reviewed this listing and marked it Verified. The badge reflects the current review status; it is not a guarantee of future availability, pricing, or service quality.',
  recommended:
    'LIBERIA360 has assigned this listing a Recommended badge based on its current catalog review. The badge is not a guarantee of future availability, pricing, or service quality.',
  official:
    'LIBERIA360 has marked this listing Official. The badge identifies the listing’s current catalog status and is not a guarantee of future availability, pricing, or service quality.',
  eco_certified:
    'LIBERIA360 has marked this listing Eco Certified. The badge reflects the current catalog status and is not a guarantee of future availability, pricing, or service quality.',
  community_favorite:
    'LIBERIA360 has marked this listing Community Favorite. The badge reflects the current catalog status and is not a guarantee of future availability, pricing, or service quality.',
};

function formatVerificationDate(verifiedAt?: string | null): string | null {
  if (!verifiedAt) return null;
  const date = new Date(verifiedAt);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function VerificationTrustInfo({
  status,
  verifiedAt,
}: {
  status: VerificationStatus;
  verifiedAt?: string | null;
}) {
  const body = TRUST_COPY[status];
  if (!body) return null;

  const date = formatVerificationDate(verifiedAt);

  return (
    <aside
      role="note"
      aria-label="Verification badge information"
      className="flex items-start gap-3 rounded-2xl border border-brand-100 bg-brand-50/70 px-3.5 py-3 text-sm dark:border-brand-400/30 dark:bg-brand-600/15"
    >
      <InformationCircleIcon aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-brand-600 dark:text-brand-300" />
      <div className="min-w-0">
        <h3 className="font-semibold text-brand-950 dark:text-white">What does this badge mean?</h3>
        <p className="mt-1 leading-5 text-brand-900/80 dark:text-brand-100">{body}</p>
        {date && <p className="mt-2 text-xs font-semibold text-brand-800 dark:text-brand-200">Verification date: {date}</p>}
      </div>
    </aside>
  );
}
