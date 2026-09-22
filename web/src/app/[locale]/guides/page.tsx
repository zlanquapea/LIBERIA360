import Link from "next/link";
import { getGuides } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";

export const metadata = {
  title: "Trip Guides & Hosts — LIBERIA360",
  description: "Find verified local guides and hosts for memorable Liberia experiences.",
};

type SearchParams = { [key: string]: string | string[] | undefined };
function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function GuidesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const search = first(params.search);
  const category = first(params.category);
  const county = first(params.county);
  const language = first(params.language);
  const guides = await getGuides({ search, county, language });

  function href(nextCategory?: string) {
    const query = new URLSearchParams();
    if (search) query.set("search", search);
    if (nextCategory) query.set("category", nextCategory);
    if (county) query.set("county", county);
    if (language) query.set("language", language);
    const value = query.toString();
    return value ? `/guides?${value}` : "/guides";
  }

  return (
    <main className="page-shell max-w-5xl">
      <PageHeader
        eyebrow="Explore with a local"
        title="Trip Guides & Hosts"
        description="Meet verified local guides offering bookable city, culture, nature, food, and adventure experiences across Liberia."
        action={<Link href="/guides/apply" className="button-secondary">Become a guide</Link>}
      />
      <form className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <label htmlFor="guide-search" className="sr-only">Search guides or places</label>
        <div className="flex gap-2">
          <input id="guide-search" name="search" defaultValue={search} placeholder="Search guides or places" className="min-h-11 flex-1 rounded-2xl border border-slate-300 bg-transparent px-4 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700" />
          <button className="button-primary min-h-11">Search</button>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="Guide categories">
          <Link href={href()} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${!category ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}>All</Link>
          {(["city", "culture", "nature", "food"] as const).map((item) => (
            <Link key={item} href={href(item)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${category === item ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}>{label(item)}</Link>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input name="county" defaultValue={county} placeholder="Filter by county" className="min-h-11 rounded-2xl border border-slate-300 bg-transparent px-4 text-sm dark:border-slate-700" />
          <input name="language" defaultValue={language} placeholder="Filter by language" className="min-h-11 rounded-2xl border border-slate-300 bg-transparent px-4 text-sm dark:border-slate-700" />
        </div>
      </form>

      {guides.length === 0 ? (
        <p className="empty-state">No guides in this search yet. Try another county, language, or category.</p>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Verified trip guides">
          {guides.map((guide) => (
            <article key={guide.id} className="flex flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-100 text-xl font-bold text-brand-800 dark:bg-brand-950 dark:text-brand-200">
                  {guide.profileImageUrl ? <img src={guide.profileImageUrl} alt="" className="h-full w-full object-cover" /> : guide.slug.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate font-display text-lg font-bold">{guide.slug}</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{label(guide.guideType)}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{guide.city}{guide.county?.name ? ` · ${guide.county.name}` : ""}</p>
                </div>
              </div>
              <span className="mt-4 inline-flex w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">✓ Verified</span>
              <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{guide.bio}</p>
              <p className="mt-3 text-sm font-semibold text-accent-700 dark:text-accent-300">★ {guide.rating.toFixed(1)} · {guide.reviewCount} reviews</p>
              <Link href={`/guides/${guide.slug}`} className="button-secondary mt-5 min-h-11 w-full">View Guide</Link>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
