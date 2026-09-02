import Link from 'next/link';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { getHelpCenterArticles, getHelpCenterCategories } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { StillNeedHelp } from '@/components/StillNeedHelpCard';

export const metadata = { title: 'Help Center — LIBERIA360' };

type SearchParams = { [key: string]: string | string[] | undefined };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Help Center homepage (Section 1 of the customer help-center feature) —
// browse by category or search across every published article. This is
// purely a self-serve reading surface: it has no relationship at all to
// the support ticket system (see api/src/support) beyond the "Still need
// help? Contact Support" link at the bottom, which just points at the
// existing /account/support flow.
export default async function HelpCenterPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const q = first(params.q);
  const categorySlug = first(params.category);

  const [categories, results] = await Promise.all([
    getHelpCenterCategories(),
    getHelpCenterArticles({ q, category: categorySlug, limit: q || categorySlug ? 20 : 8 }),
  ]);

  const activeCategory = categorySlug
    ? categories.find((c) => c.slug === categorySlug)
    : undefined;
  const browsing = Boolean(q || categorySlug);

  return (
    <main className="page-shell max-w-4xl">
      <PageHeader
        eyebrow="Customer help"
        title="Help Center"
        description="Search our guides or browse by topic — most questions are answered here faster than a support ticket."
      />

      <form
        action="/help"
        method="GET"
        className="flex overflow-hidden rounded-full border border-slate-300 bg-white shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-brand-400 dark:border-slate-700 dark:bg-slate-900"
      >
        {categorySlug && <input type="hidden" name="category" value={categorySlug} />}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search articles — e.g. 'cancel a booking'"
          className="w-full bg-transparent px-4 py-3 text-sm outline-none"
        />
        <button
          type="submit"
          className="flex items-center px-4 text-slate-600 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="Search"
        >
          <MagnifyingGlassIcon aria-hidden className="h-5 w-5" />
        </button>
      </form>

      {!browsing && (
        <section aria-labelledby="help-categories-heading" className="flex flex-col gap-3">
          <h2 id="help-categories-heading" className="font-semibold text-slate-800 dark:text-slate-100">
            Browse by topic
          </h2>
          {categories.length === 0 ? (
            <p className="empty-state">No help topics yet — check back soon.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/help?category=${category.slug}`}
                  className="surface-card flex flex-col gap-1 p-4 transition-colors hover:border-brand-400 dark:hover:border-brand-600"
                >
                  <span className="font-semibold text-slate-900 dark:text-slate-50">{category.name}</span>
                  {category.description && (
                    <span className="text-sm text-slate-500 dark:text-slate-400">{category.description}</span>
                  )}
                  <span className="mt-1 text-xs font-medium text-brand-700 dark:text-brand-300">
                    {category.publishedArticleCount} article{category.publishedArticleCount === 1 ? '' : 's'}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      <section aria-labelledby="help-articles-heading" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="help-articles-heading" className="font-semibold text-slate-800 dark:text-slate-100">
            {q
              ? `Results for "${q}"`
              : activeCategory
                ? activeCategory.name
                : 'Popular articles'}
          </h2>
          {browsing && (
            <Link href="/help" className="text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline">
              ← All topics
            </Link>
          )}
        </div>

        {results.data.length === 0 ? (
          <p className="empty-state">
            {q ? `No articles match "${q}".` : 'No articles in this topic yet.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {results.data.map((article) => (
              <li key={article.id}>
                <Link
                  href={`/help/articles/${article.slug}`}
                  className="surface-card flex items-center justify-between gap-3 p-4 transition-colors hover:border-brand-400 dark:hover:border-brand-600"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-900 dark:text-slate-50">
                      {article.title}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{article.category.name}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <StillNeedHelp />
    </main>
  );
}
