'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { SuperAdminGate } from '@/components/SuperAdminGate';
import { useAuth } from '@/hooks/useAuth';
import { getApplicationSettings, updateApplicationSettings } from '@/lib/admin-api';
import { getFriendlyErrorMessage } from '@/lib/errors';
import type { ApplicationSettings } from '@/lib/types';
import { AdminPageHeader, ErrorState, LoadingState, Panel, PlaceholderPage } from '@/components/admin-ui';

// Settings > General/Application/Notifications/Integrations/Localization
// — one dynamic route instead of 5 near-identical files. Application is
// the one section backed by a real store (Settings > Application MVP —
// see api/src/settings/); the other four stay an honest "not built yet"
// body instead of fake toggles that don't save anywhere. See
// admin-ui.tsx's PlaceholderPage for why: faking a working form there
// would be worse than not having the page at all.
const PLACEHOLDER_SECTIONS: Record<string, { title: string; description: string; reason: string }> = {
  general: {
    title: 'General Settings',
    description: 'Site name, contact details, default currency/locale for the platform as a whole.',
    reason: 'No settings-storage backend exists yet — every current config lives in environment variables, set at deploy time, not editable from the app.',
  },
  notifications: {
    title: 'Notifications',
    description: 'Which admin events (new flagged content, failed-login spikes) send an email or push notification, and to whom.',
    reason: 'Failed-login spikes already email every super admin automatically (see Security > Security Alerts, and the two thresholds on Application) — a general settings UI to route other events to other people isn’t built yet.',
  },
  integrations: {
    title: 'Integrations',
    description: 'Manage the third-party services this app talks to — object storage, email, crash reporting.',
    reason: 'These are configured via environment variables today (see System Status for what’s currently on) rather than an in-app connection flow.',
  },
  localization: {
    title: 'Localization',
    description: 'Languages and regional formatting beyond the current English-only, USD/Liberian-dollar-aware default.',
    reason: 'No i18n framework is wired in yet — every string in this app is hard-coded English.',
  },
};

export default function SettingsSectionPage() {
  const params = useParams<{ section: string }>();

  if (params.section === 'application') {
    return (
      <SuperAdminGate>
        <ApplicationSettingsPanel />
      </SuperAdminGate>
    );
  }

  const section = PLACEHOLDER_SECTIONS[params.section];
  return (
    <SuperAdminGate>
      <div className="flex flex-col gap-6">
        <AdminPageHeader title={section?.title ?? 'Settings'} />
        <PlaceholderPage
          title="Not built yet"
          description={section?.description ?? 'This settings section doesn’t exist yet.'}
          reason={section?.reason ?? ''}
        />
      </div>
    </SuperAdminGate>
  );
}

// A field editor with a shared shape: label, help text, and a bounded
// number input — six of these instead of six one-off blocks, so adding a
// seventh threshold later is one array entry, not copy-pasted markup.
const FIELDS: {
  key: keyof ApplicationSettings & string;
  label: string;
  help: string;
  min: number;
  max: number;
}[] = [
  {
    key: 'freshnessFlagThreshold',
    label: 'Freshness report threshold',
    help: 'Independent "no longer here" reports before a place surfaces as possibly closed.',
    min: 1,
    max: 50,
  },
  {
    key: 'freshnessWindowDays',
    label: 'Freshness report window (days)',
    help: 'Only reports within this many days count toward the threshold above.',
    min: 1,
    max: 365,
  },
  {
    key: 'reportFlagThreshold',
    label: 'Content report threshold',
    help: 'Independent reports against the same review/event/business before it surfaces as flagged content.',
    min: 1,
    max: 50,
  },
  {
    key: 'reportWindowDays',
    label: 'Content report window (days)',
    help: 'Only reports within this many days count toward the threshold above.',
    min: 1,
    max: 365,
  },
  {
    key: 'failedLoginAlertThreshold1h',
    label: 'Failed-login alert threshold (1 hour)',
    help: 'Failed logins in the last hour before every super admin gets a security alert email.',
    min: 1,
    max: 1000,
  },
  {
    key: 'failedLoginAlertThreshold24h',
    label: 'Failed-login alert threshold (24 hours)',
    help: 'Failed logins in the last 24 hours before every super admin gets a security alert email.',
    min: 1,
    max: 10000,
  },
];

function ApplicationSettingsPanel() {
  const { token } = useAuth();
  const [settings, setSettings] = useState<ApplicationSettings | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!token) return;
    getApplicationSettings(token).then((s) => {
      setSettings(s);
      setDraft(Object.fromEntries(FIELDS.map((f) => [f.key, String(s[f.key])])));
    });
  }, [token]);

  function updateDraft(key: string, value: string) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function save() {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const input = Object.fromEntries(
        FIELDS.map((f) => [f.key, Number(draft[f.key])]),
      );
      const updated = await updateApplicationSettings(token, input);
      setSettings(updated);
      setSaved(true);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, { context: { action: 'update-application-settings' } }));
    } finally {
      setSaving(false);
    }
  }

  const dirty = settings !== null && FIELDS.some((f) => draft[f.key] !== String(settings[f.key]));

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Application Settings"
        description="Moderation and security-alert thresholds — editable here instead of a hardcoded constant that needed a deploy to change."
      />

      {!settings ? (
        <LoadingState />
      ) : (
        <Panel>
          <div className="grid gap-4 sm:grid-cols-2">
            {FIELDS.map((field) => (
              <label key={field.key} className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{field.label}</span>
                <input
                  type="number"
                  min={field.min}
                  max={field.max}
                  value={draft[field.key] ?? ''}
                  onChange={(e) => updateDraft(field.key, e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800"
                />
                <span className="text-xs text-slate-500 dark:text-slate-400">{field.help}</span>
              </label>
            ))}
          </div>

          {error && <ErrorState message={error} />}

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={saving || !dirty}
              onClick={save}
              className="self-start rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            {saved && !dirty && <span className="text-xs text-slate-500 dark:text-slate-400">Saved.</span>}
          </div>

          {settings.updatedByUserId && (
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Last changed {new Date(settings.updatedAt).toLocaleString()}.
            </p>
          )}
        </Panel>
      )}
    </div>
  );
}
