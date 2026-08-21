'use client';

import { usePushSubscription } from '@/hooks/usePushSubscription';

// Push notification opt-in (Tech Spec §3.2 "events nearby" alerts) — shown
// on /account since it's a per-device, per-account setting. Quietly renders
// nothing if the browser doesn't support Push, or the server has no VAPID
// keypair configured (see api/README.md) — this is a progressive
// enhancement, not something every user needs to see a broken control for.
export function PushNotificationToggle() {
  const { available, checking, subscribed, busy, error, enable, disable } = usePushSubscription();

  if (!available || checking) return null;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-900 dark:text-slate-50">Event notifications</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Get notified about new events in your home county.</p>
        </div>
        <button
          type="button"
          onClick={() => (subscribed ? disable() : enable())}
          disabled={busy}
          aria-pressed={subscribed}
          className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium disabled:opacity-60 ${
            subscribed
              ? 'border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-flag-500 hover:text-flag-700 dark:hover:text-flag-300'
              : 'bg-brand-700 text-white hover:bg-brand-800'
          }`}
        >
          {busy ? '…' : subscribed ? 'Turn off' : 'Turn on'}
        </button>
      </div>
      {error && <p className="text-xs text-flag-700 dark:text-flag-300">{error}</p>}
    </div>
  );
}
