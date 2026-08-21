import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — LIBERIA360',
  description: 'How LIBERIA360 collects, uses, and protects your information.',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">{title}</h2>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{children}</div>
    </section>
  );
}

// Reflects what the API actually collects and does today (see
// api/README.md's "Security" section) rather than boilerplate — but this
// is a draft written by an engineer, not a lawyer. Have it reviewed by
// counsel before relying on it for a real launch, especially once real
// payment processing (MTN Mobile Money) is wired up.
export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6">
      <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
        <strong>Draft.</strong> This page describes what the platform actually collects and does as of today. It
        hasn&apos;t been reviewed by a lawyer — have it reviewed before relying on it for a public launch.
      </div>

      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Privacy Policy</h1>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-400">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      <Section title="What we collect">
        <p>When you create an account: your name, email address, and password (we never store your actual password — only a one-way cryptographic hash of it). Phone number, home county, traveler type, and interests are optional.</p>
        <p>If you enable two-factor authentication, your authenticator secret is encrypted before it&apos;s stored.</p>
        <p>When you use the platform: reviews and ratings you post, photos you upload, booking requests and any messages you send through them, trip itineraries you create, and places you save.</p>
        <p>If you claim or run a business listing: your business&apos;s contact details, description, and photos.</p>
        <p>Catalog browsing activity (views, saves, contact clicks, booking-request clicks) is logged anonymously — these records aren&apos;t linked to your account or identity, and are used only in aggregate to help us understand which destinations get attention.</p>
      </Section>

      <Section title="What we don't do">
        <p>We don&apos;t sell your personal information. We don&apos;t use third-party advertising trackers or cookies to follow you across other websites. We don&apos;t use your location for anything beyond a search you explicitly run (like &quot;Near Me&quot;) — it isn&apos;t stored against your profile.</p>
      </Section>

      <Section title="How your information is used">
        <ul className="list-disc pl-5">
          <li>To create and secure your account, and to let you sign in.</li>
          <li>To operate features you use directly — reviews, bookings, saved places, trip planning, business listings.</li>
          <li>To send account-related email (password resets, email verification) and, if you opt in, push notifications about events in your area.</li>
          <li>To understand aggregate usage patterns and improve the catalog — never at the level of an individual visitor.</li>
        </ul>
      </Section>

      <Section title="Where your information is stored">
        <p>Your account session token is stored on your own device (in your browser&apos;s local storage), not in a cookie. Everything else lives in our database. If you upload a photo, it&apos;s stored with whichever storage provider is configured for the platform at the time.</p>
      </Section>

      <Section title="Sharing with third parties">
        <p>We use third-party services to operate the platform — for example, email delivery for account messages, and (optionally) error-tracking to help us catch bugs. These providers process data only as needed to provide that service, not for their own purposes.</p>
        <p>Business owners can see reviews, bookings, and messages related to their own listing. We don&apos;t otherwise share your personal information with other users beyond what you choose to make public (your name on a review, for instance).</p>
      </Section>

      <Section title="Your choices">
        <ul className="list-disc pl-5">
          <li>Update your profile information at any time from your account page.</li>
          <li>Change your password, or sign out of every other device, from account settings.</li>
          <li>Delete your account at any time. This removes your ability to sign in and clears your personal details; content you posted that other users rely on (like a review) is anonymized rather than deleted outright, so the record isn&apos;t left in a broken state for everyone else.</li>
        </ul>
      </Section>

      <Section title="Children">
        <p>LIBERIA360 isn&apos;t directed at children, and we don&apos;t knowingly collect information from anyone under 13.</p>
      </Section>

      <Section title="Changes to this policy">
        <p>If this policy changes in a material way, we&apos;ll update the date at the top of this page.</p>
      </Section>

      <Section title="Contact">
        <p>Questions about this policy or your data can be sent to the platform administrator through the contact details on the site.</p>
      </Section>
    </main>
  );
}
