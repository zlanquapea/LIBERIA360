import type { GuideSummary, ExperienceSummary } from "@/lib/api";

export function GuideDecisionCard({ guide, experiences }: { guide: GuideSummary; experiences: ExperienceSummary[] }) {
  const prices = experiences.map(item => Number(item.priceUsd)).filter(value => Number.isFinite(value) && value >= 0);
  const specialties = [...new Set(experiences.map(item => item.category))];
  return <section aria-label="Before you book" className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
    <h2 className="text-lg font-bold">Before you book</h2>
    <dl className="mt-4 grid gap-4 sm:grid-cols-3">
      <div><dt className="text-sm text-slate-500 dark:text-slate-400">Experience prices</dt><dd className="mt-1 font-semibold">{prices.length ? `From US$ ${Math.min(...prices).toFixed(2)}` : "Ask the guide for pricing"}</dd></div>
      <div><dt className="text-sm text-slate-500 dark:text-slate-400">Specialties</dt><dd className="mt-1 font-semibold capitalize">{specialties.join(" · ") || guide.guideType.replaceAll("_", " ")}</dd></div>
      <div><dt className="text-sm text-slate-500 dark:text-slate-400">Languages</dt><dd className="mt-1 font-semibold">{guide.languages.join(" · ") || "Ask the guide"}</dd></div>
    </dl>
    <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">Choose an experience to request your date. Availability is confirmed by the guide; sending a request does not confirm your booking.</p>
    {guide.verificationStatus === "verified" && <details className="mt-4 border-t border-slate-200 pt-4 text-sm dark:border-slate-700">
      <summary className="cursor-pointer font-semibold">What does “Verified” mean?</summary>
      <p className="mt-2 leading-6 text-slate-600 dark:text-slate-300">The guide’s application has been approved by a LIBERIA360 administrator. This badge does not guarantee availability or the quality of every experience. Reviews marked “Completed booking” are linked to a completed LIBERIA360 booking; other reviews are community feedback.</p>
    </details>}
  </section>;
}
