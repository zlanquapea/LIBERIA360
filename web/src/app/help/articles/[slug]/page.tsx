import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ApiError, getHelpCenterArticle } from '@/lib/api';
import { ArticleFeedback } from '@/components/ArticleFeedback';
import { StillNeedHelp } from '@/components/StillNeedHelpCard';
import { HelpContentNav } from '@/components/HelpContentNav';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await getHelpCenterArticle(slug).catch(() => null);
  return { title: result ? `${result.article.title} — Help Center — LIBERIA360` : 'Help Center — LIBERIA360' };
}

// A single Help Center article — the "Article listing by category" /
// "Individual article page" / "Related articles" pieces of the customer
// help-center feature all meet here.
export default async function HelpArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const result = await getHelpCenterArticle(slug).catch((error) => {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  });
  if (!result) notFound();
  const { article, related } = result;

  return (
    <main className="page-shell max-w-6xl">
      <nav className="flex flex-wrap items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
        <Link href="/help" className="hover:underline">
          Help Center
        </Link>
        <span aria-hidden>/</span>
        <Link href={`/help?category=${article.category.slug}`} className="hover:underline">
          {article.category.name}
        </Link>
      </nav>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <HelpContentNav />

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <article className="surface-card flex flex-col gap-4 p-5 sm:p-7">
            <header className="flex flex-col gap-1">
              <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-white sm:text-3xl">
                {article.title}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {article.author?.name && <>By {article.author.name} · </>}
                Updated {new Date(article.updatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </header>

            <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-slate-200">
              {article.content}
            </div>

            <ArticleFeedback articleId={article.id} />
          </article>

          {related.length > 0 && (
            <section aria-labelledby="related-articles-heading" className="flex flex-col gap-3">
              <h2 id="related-articles-heading" className="font-semibold text-slate-800 dark:text-slate-100">
                Related articles
              </h2>
              <ul className="flex flex-col gap-2">
                {related.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/help/articles/${item.slug}`}
                      className="surface-card block p-4 font-medium text-slate-900 transition-colors hover:border-brand-400 dark:text-slate-50 dark:hover:border-brand-600"
                    >
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <StillNeedHelp />
        </div>
      </div>
    </main>
  );
}
