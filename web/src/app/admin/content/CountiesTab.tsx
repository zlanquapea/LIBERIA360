'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { deleteCountyAdmin, updateCountyAdmin } from '@/lib/admin-api';
import { HttpError } from '@/lib/http';
import { CategoryIcon } from '@/lib/icons';
import type { County } from '@/lib/types';
import { BackToListLink, DeleteButton, inputClass } from './content-shared';

type View = { mode: 'list' } | { mode: 'edit'; county: County };

export function CountiesTab({
  token,
  counties,
  isSuperAdmin,
  onChanged,
}: {
  token: string;
  counties: County[];
  isSuperAdmin: boolean;
  onChanged: (counties: County[]) => void;
}) {
  const [view, setView] = useState<View>({ mode: 'list' });

  if (view.mode === 'edit') {
    return (
      <div className="flex flex-col gap-3">
        <BackToListLink label="Back to counties" onClick={() => setView({ mode: 'list' })} />
        <CountyEditForm
          token={token}
          county={view.county}
          isSuperAdmin={isSuperAdmin}
          onSaved={(updated) => {
            onChanged(counties.map((c) => (c.id === updated.id ? updated : c)));
            setView({ mode: 'edit', county: updated });
          }}
          onDeleted={() => {
            onChanged(counties.filter((c) => c.id !== view.county.id));
            setView({ mode: 'list' });
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
        Counties
        <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">{counties.length}</span>
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Liberia&apos;s 15 counties are fixed — no &quot;create&quot; here on purpose. Click one to set its safety/practical-info
        panel (shown as a &quot;Before you go&quot; panel on the county page).
      </p>
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-4 py-2">County</th>
              <th className="px-4 py-2">Rollout stage</th>
              <th className="px-4 py-2">Safety info set?</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {counties.map((county) => (
              <tr key={county.id} onClick={() => setView({ mode: 'edit', county })} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-50">
                  <span className="flex items-center gap-1.5">
                    <CategoryIcon iconKey={county.icon} className="h-4 w-4 shrink-0" />
                    {county.name}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{county.rolloutStage}</td>
                <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{county.emergencyNumber ? 'Yes' : 'Not yet'}</td>
                <td className="px-4 py-2.5 text-right text-xs font-medium text-brand-700 dark:text-brand-300">Edit →</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CountyEditForm({
  token,
  county,
  isSuperAdmin,
  onSaved,
  onDeleted,
}: {
  token: string;
  county: County;
  isSuperAdmin: boolean;
  onSaved: (county: County) => void;
  onDeleted: () => void;
}) {
  const [emergencyNumber, setEmergencyNumber] = useState(county.emergencyNumber ?? '');
  // One tip per line in the textarea — simplest editing UI for a string
  // array; split/filter on save and on load, same as photos elsewhere.
  const [safetyTipsText, setSafetyTipsText] = useState(county.safetyTips.join('\n'));
  const [localCustoms, setLocalCustoms] = useState(county.localCustoms ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setEmergencyNumber(county.emergencyNumber ?? '');
    setSafetyTipsText(county.safetyTips.join('\n'));
    setLocalCustoms(county.localCustoms ?? '');
    setSuccess(false);
    // Keyed on county.id — a save replaces this county with a new object
    // of the same id, which must not wipe the success message just set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [county.id]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      const updated = await updateCountyAdmin(token, county.id, {
        emergencyNumber: emergencyNumber.trim() || undefined,
        safetyTips: safetyTipsText
          .split('\n')
          .map((tip) => tip.trim())
          .filter(Boolean),
        localCustoms: localCustoms.trim() || undefined,
      });
      setSuccess(true);
      onSaved(updated);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <CategoryIcon iconKey={county.icon} className="h-4 w-4 shrink-0" />
          {county.name}
        </h3>
        {isSuperAdmin && (
          <DeleteButton label="Delete county" onDelete={() => deleteCountyAdmin(token, county.id)} onDeleted={onDeleted} />
        )}
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Emergency number
        <input
          maxLength={100}
          placeholder="e.g. 911"
          value={emergencyNumber}
          onChange={(e) => setEmergencyNumber(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Safety tips (one per line)
        <textarea rows={4} value={safetyTipsText} onChange={(e) => setSafetyTipsText(e.target.value)} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Local customs
        <textarea rows={3} value={localCustoms} onChange={(e) => setLocalCustoms(e.target.value)} className={inputClass} />
      </label>
      {error && (
        <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700 dark:text-flag-300">
          {error}
        </p>
      )}
      {success && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Saved.</p>}
      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
      >
        {submitting ? 'Saving…' : 'Save county info'}
      </button>
    </form>
  );
}
