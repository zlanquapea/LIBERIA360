import { getFaqs } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { StillNeedHelp } from '@/components/StillNeedHelpCard';

export const metadata = { title: 'FAQ — LIBERIA360' };

// Frequently Asked Questions — a native <details>/<summary> accordion
// (zero client JS needed for open/close state) grouped by each FAQ's
// free-text category, in the admin-chosen sortOrder within each group.
export default async function FaqPage() {
  const faqs = await getFaqs();
  const groups = new Map<string, typeof faqs>();
  for (const faq of faqs) {
    const key = faq.category ?? 'General';
    const group = groups.get(key) ?? [];
    group.push(faq);
    groups.set(key, group);
  }

  return (
    <main className="page-shell max-w-3xl">
      <PageHeader
        eyebrow="Quick answers"
        title="Frequently Asked Questions"
        description="The most common questions, answered — no ticket required."
      />

      {faqs.length === 0 ? (
        <p className="empty-state">No FAQs published yet.</p>
      ) : (
        [...groups.entries()].map(([category, items]) => (
          <section key={category} aria-labelledby={`faq-${category}`} className="flex flex-col gap-3">
            <h2 id={`faq-${category}`} className="font-semibold text-slate-800 dark:text-slate-100">
              {category}
            </h2>
            <div className="flex flex-col gap-2">
              {items.map((faq) => (
                <details
                  key={faq.id}
                  className="surface-card group open:border-brand-400 dark:open:border-brand-600 [&_summary::-webkit-details-marker]:hidden"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 font-medium text-slate-900 marker:content-none dark:text-slate-50">
                    {faq.question}
                    <span aria-hidden className="shrink-0 text-slate-400 transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="whitespace-pre-wrap px-4 pb-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {faq.answer}
                  </p>
                </details>
              ))}
            </div>
          </section>
        ))
      )}

      <StillNeedHelp />
    </main>
  );
}
