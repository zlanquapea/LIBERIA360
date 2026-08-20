import type { County } from '@/lib/types';

// "Before you go" panel for the international-visitor/diaspora audience —
// the one thing missing from a plain catalog-directory experience.
// Renders nothing if an admin hasn't set any of this content yet (see
// PATCH /admin/counties/:id) — no placeholder/guessed content shown to
// visitors, consistent with the API never seeding a guessed
// emergencyNumber.
export function CountySafetyPanel({ county }: { county: County }) {
  const hasContent = Boolean(county.emergencyNumber) || county.safetyTips.length > 0 || Boolean(county.localCustoms);
  if (!hasContent) return null;

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 p-4">
      <h2 className="font-semibold text-slate-900 dark:text-slate-50">Before you go</h2>

      {county.emergencyNumber && (
        <p className="text-sm text-slate-700 dark:text-slate-200">
          <span className="font-medium">Emergency number:</span> {county.emergencyNumber}
        </p>
      )}

      {county.safetyTips.length > 0 && (
        <div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Safety tips</p>
          <ul className="mt-1 list-inside list-disc space-y-1 text-sm text-slate-600 dark:text-slate-300">
            {county.safetyTips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>
      )}

      {county.localCustoms && (
        <div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Local customs</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{county.localCustoms}</p>
        </div>
      )}
    </section>
  );
}
