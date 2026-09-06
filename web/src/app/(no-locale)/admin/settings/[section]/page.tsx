'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { SuperAdminGate } from '@/components/SuperAdminGate';
import { useAuth } from '@/hooks/useAuth';
import {
  getAdminNotificationSettings,
  getApplicationSettings,
  getTeamRoster,
  updateAdminNotificationSettings,
  updateApplicationSettings,
} from '@/lib/admin-api';
import { getFriendlyErrorMessage } from '@/lib/errors';
import type { AdminNotificationSettings, ApplicationSettings, AuthUser } from '@/lib/types';
import { AdminPageHeader, ErrorState, LoadingState, Panel, PlaceholderPage } from '@/components/admin-ui';

// Settings > General/Application/Notifications/Integrations/Localization
// — one dynamic route instead of 5 near-identical files. Application and
// Notifications are backed by a real store (Settings > Application MVP,
// Settings > Notifications — see api/src/settings/); the other three stay
// an honest "not built yet" body instead of fake toggles that don't save
// anywhere. See admin-ui.tsx's PlaceholderPage for why: faking a working
// form there would be worse than not having the page at all.
const PLACEHOLDER_SECTIONS: Record<string, { title: string; description: string; reason: string }> = {
  general: {
    title: 'General Settings',
    description: 'Site name, contact details, default currency/locale for the platform as a whole.',
    reason: 'No settings-storage backend exists yet — every current config lives in environment variables, set at deploy time, not editable from the app.',
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

  if (params.section === 'notifications') {
    return (
      <SuperAdminGate>
        <NotificationsSettingsPanel />
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

// Settings > Notifications — the "which admin events send an email or
// push notification, and to whom" gap the placeholder body used to
// describe. Only one event is routable here today: new flagged content
// (see ReportsService.maybeNotifyContentFlagged) — failed-login alerts
// stay hardcoded to "every super admin" on purpose (Security > Security
// Alerts, see admin-notification-settings.entity.ts's doc comment for
// why that one isn't part of this page).
function NotificationsSettingsPanel() {
  const { token } = useAuth();
  const [settings, setSettings] = useState<AdminNotificationSettings | null>(null);
  const [roster, setRoster] = useState<AuthUser[] | null>(null);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [scope, setScope] = useState<'all' | 'specific'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!token) return;
    Promise.all([getAdminNotificationSettings(token), getTeamRoster(token)]).then(
      ([s, team]) => {
        setSettings(s);
        setRoster(team);
        setEmailEnabled(s.flaggedContentEmailEnabled);
        setPushEnabled(s.flaggedContentPushEnabled);
        setScope(s.flaggedContentRecipientUserIds.length > 0 ? 'specific' : 'all');
        setSelectedIds(new Set(s.flaggedContentRecipientUserIds));
      },
    );
  }, [token]);

  const filteredRoster = useMemo(() => {
    if (!roster) return [];
    const q = search.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter(
      (member) => member.name.toLowerCase().includes(q) || member.email.toLowerCase().includes(q),
    );
  }, [roster, search]);

  function toggleRecipient(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSaved(false);
  }

  const dirty =
    settings !== null &&
    (emailEnabled !== settings.flaggedContentEmailEnabled ||
      pushEnabled !== settings.flaggedContentPushEnabled ||
      scope !== (settings.flaggedContentRecipientUserIds.length > 0 ? 'specific' : 'all') ||
      (scope === 'specific' &&
        JSON.stringify([...selectedIds].sort()) !==
          JSON.stringify([...settings.flaggedContentRecipientUserIds].sort())));

  async function save() {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateAdminNotificationSettings(token, {
        flaggedContentEmailEnabled: emailEnabled,
        flaggedContentPushEnabled: pushEnabled,
        flaggedContentRecipientUserIds: scope === 'all' ? [] : [...selectedIds],
      });
      setSettings(updated);
      setSaved(true);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, { context: { action: 'update-admin-notification-settings' } }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Notifications"
        description="Which admin events send an email or push notification, and to whom."
      />

      {!settings || !roster ? (
        <LoadingState />
      ) : (
        <Panel>
          <div className="flex flex-col gap-1">
            <h2 className="font-semibold text-slate-900 dark:text-slate-50">New flagged content</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              A review or event that a super admin&apos;s report threshold (Settings &gt; Application) just flagged.
            </p>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={emailEnabled}
                onChange={(e) => {
                  setEmailEnabled(e.target.checked);
                  setSaved(false);
                }}
                className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
              />
              Email the recipients below
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={pushEnabled}
                onChange={(e) => {
                  setPushEnabled(e.target.checked);
                  setSaved(false);
                }}
                className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
              />
              Send a browser push notification to the recipients below
            </label>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Every recipient also gets an in-app notification (the bell icon) regardless of these two toggles.
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Who gets notified</h3>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="radio"
                  name="notification-scope"
                  checked={scope === 'all'}
                  onChange={() => {
                    setScope('all');
                    setSaved(false);
                  }}
                  className="h-4 w-4 border-slate-300 text-brand-700 focus:ring-brand-500"
                />
                All admins (default)
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="radio"
                  name="notification-scope"
                  checked={scope === 'specific'}
                  onChange={() => {
                    setScope('specific');
                    setSaved(false);
                  }}
                  className="h-4 w-4 border-slate-300 text-brand-700 focus:ring-brand-500"
                />
                Specific admins
              </label>
            </div>

            {scope === 'specific' && (
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or email…"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800"
                />
                <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
                  {filteredRoster.length === 0 ? (
                    <p className="p-3 text-sm text-slate-500 dark:text-slate-400">No admins match &quot;{search}&quot;.</p>
                  ) : (
                    filteredRoster.map((member) => (
                      <label
                        key={member.id}
                        className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(member.id)}
                          onChange={() => toggleRecipient(member.id)}
                          className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-slate-800 dark:text-slate-100">{member.name}</span>
                          <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{member.email}</span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500">{selectedIds.size} selected.</p>
              </div>
            )}
          </div>

          {error && <ErrorState message={error} />}

          <div className="mt-4 flex items-center gap-3">
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

          <p className="mt-4 border-t border-slate-100 pt-4 text-xs text-slate-400 dark:border-slate-800 dark:text-slate-500">
            Failed-login threshold alerts aren&apos;t configured here — they already go to every super admin
            automatically (see{' '}
            <a href="/admin/security/alerts" className="underline hover:text-slate-600 dark:hover:text-slate-300">
              Security &gt; Security Alerts
            </a>{' '}
            and the two thresholds on Application).
          </p>

          {settings.updatedByUserId && (
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
              Last changed {new Date(settings.updatedAt).toLocaleString()}.
            </p>
          )}
        </Panel>
      )}
    </div>
  );
}
