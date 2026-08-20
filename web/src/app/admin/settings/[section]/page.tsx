'use client';

import { useParams } from 'next/navigation';
import { SuperAdminGate } from '@/components/SuperAdminGate';
import { AdminPageHeader, PlaceholderPage } from '@/components/admin-ui';

// Settings > General/Application/Notifications/Integrations/Localization
// — one dynamic route instead of 5 near-identical files, since every
// section is the same shape today: a real nav entry (matches the IA the
// spec asked for) with an honest "not built yet" body instead of fake
// toggles that don't save anywhere. See admin-ui.tsx's PlaceholderPage
// for why: faking a working settings form here would be worse than not
// having the page at all.
const SECTIONS: Record<string, { title: string; description: string; reason: string }> = {
  general: {
    title: 'General Settings',
    description: 'Site name, contact details, default currency/locale for the platform as a whole.',
    reason: 'No settings-storage backend exists yet — every current config lives in environment variables, set at deploy time, not editable from the app.',
  },
  application: {
    title: 'Application Settings',
    description: 'Feature flags, listing limits, moderation thresholds (like the flag/freshness-report counts used on Content Reports).',
    reason: 'Those thresholds are real, but currently hard-coded constants in the API, not a database-backed config an admin can change without a deploy.',
  },
  notifications: {
    title: 'Notifications',
    description: 'Which admin events (new flagged content, failed-login spikes) send an email or push notification, and to whom.',
    reason: 'Web push and email are both wired up for end users (see System Status for what’s configured) — routing alerts to admins themselves isn’t built yet.',
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
  const section = SECTIONS[params.section];

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
