import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service — LIBERIA360',
  description: 'The terms that govern use of the LIBERIA360 platform.',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">{title}</h2>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{children}</div>
    </section>
  );
}

// Same caveat as the Privacy Policy: a draft scoped to what the platform
// actually does today, written by an engineer, not a lawyer. Needs real
// legal review — particularly the liability/disclaimer language and
// [bracketed placeholders] — before a public launch.
export default function TermsOfServicePage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6">
      <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
        <strong>Draft.</strong> This page hasn&apos;t been reviewed by a lawyer — have it reviewed, and fill in the
        bracketed placeholders, before relying on it for a public launch.
      </div>

      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Terms of Service</h1>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-400">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      <Section title="1. Acceptance">
        <p>By creating an account or otherwise using LIBERIA360, you agree to these terms. If you don&apos;t agree, please don&apos;t use the platform.</p>
      </Section>

      <Section title="2. What LIBERIA360 is">
        <p>LIBERIA360 is a discovery and connection platform for Liberia&apos;s tourism and hospitality sector — a catalog of places, trip-planning tools, and a way for travelers to connect with hotels, restaurants, tour operators, and local creators. Booking requests made through the platform are exactly that: requests. We don&apos;t currently process payments — any payment happens directly between you and the business, outside the platform, until that changes.</p>
      </Section>

      <Section title="3. Your account">
        <ul className="list-disc pl-5">
          <li>You&apos;re responsible for keeping your password (and, if enabled, your two-factor recovery codes) confidential, and for all activity under your account.</li>
          <li>You must provide accurate information when you register and when you claim or create a business listing.</li>
          <li>You must be able to form a binding contract to create an account — practically, this means you&apos;re old enough to do so where you live.</li>
        </ul>
      </Section>

      <Section title="4. Content you post">
        <p>Reviews, photos, event listings, business descriptions, and messages you post are your own — you keep ownership of them, but by posting you give LIBERIA360 a license to display and distribute that content as part of operating the platform (for example, showing your review on a destination&apos;s page).</p>
        <p>You&apos;re responsible for what you post. Content must be honest and must be yours to share — don&apos;t post anything that&apos;s false, infringing, harassing, or otherwise unlawful. Other users can report content they believe violates this, and we may remove content that does.</p>
      </Section>

      <Section title="5. Business listings">
        <p>If you claim or manage a business listing, you&apos;re representing that you&apos;re authorized to do so on that business&apos;s behalf, and that the information you provide (contact details, pricing, photos, availability) is accurate. Verification badges reflect an internal review process and aren&apos;t a guarantee of quality or a legal endorsement.</p>
      </Section>

      <Section title="6. Bookings">
        <p>A booking request is a coordination tool, not a contract we&apos;re a party to — the actual agreement (price, availability, cancellation terms) is between you and the business. Confirming a request doesn&apos;t guarantee a business will honor it, and we&apos;re not responsible for a business&apos;s conduct, quality of service, or failure to show up.</p>
      </Section>

      <Section title="7. Prohibited conduct">
        <ul className="list-disc pl-5">
          <li>Impersonating another person or business, or misrepresenting your affiliation with one.</li>
          <li>Posting spam, fake reviews, or content designed to manipulate ratings or search results.</li>
          <li>Attempting to access another user&apos;s account, or to circumvent rate limits, security measures, or access controls.</li>
          <li>Using the platform for anything unlawful, or to harm, harass, or defraud another user.</li>
        </ul>
      </Section>

      <Section title="8. Suspension and termination">
        <p>We may suspend or remove content, listings, or accounts that violate these terms. You can delete your own account at any time from account settings.</p>
      </Section>

      <Section title="9. Disclaimers">
        <p>LIBERIA360 is provided &quot;as is.&quot; We work to keep listing information accurate, but destinations, prices, hours, and availability can change without notice — verify anything time- or safety-sensitive directly with the business or destination before you travel. We&apos;re not responsible for the accuracy of user-submitted content (reviews, business descriptions) or for the conduct of businesses or other users on the platform.</p>
      </Section>

      <Section title="10. Limitation of liability">
        <p>To the fullest extent permitted by law, LIBERIA360 isn&apos;t liable for indirect, incidental, or consequential damages arising from your use of the platform, including losses connected to a booking, a business&apos;s conduct, or travel decisions made based on listing information. [Placeholder — a lawyer should confirm this language is appropriate and enforceable for the jurisdiction(s) LIBERIA360 operates in.]</p>
      </Section>

      <Section title="11. Governing law">
        <p>[Placeholder — governing law and dispute-resolution jurisdiction to be confirmed with legal counsel; expected to be the Republic of Liberia given the platform&apos;s focus, but this needs formal confirmation before publishing.]</p>
      </Section>

      <Section title="12. Changes to these terms">
        <p>If these terms change in a material way, we&apos;ll update the date at the top of this page. Continuing to use the platform after a change means you accept the updated terms.</p>
      </Section>

      <Section title="13. Contact">
        <p>Questions about these terms can be sent to the platform administrator through the contact details on the site.</p>
      </Section>
    </main>
  );
}
