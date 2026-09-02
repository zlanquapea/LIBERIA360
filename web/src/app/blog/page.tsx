import Link from 'next/link';
import { NewspaperIcon } from '@heroicons/react/24/solid';
import { getBlogPosts } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { SafeImage } from '@/components/SafeImage';
import { resolveImageUrl } from '@/lib/images';

export const metadata = { title: 'Blog & Updates — LIBERIA360' };

type SearchParams = { [key: string]: string | string[] | undefined };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Blog / Updates — product announcements, maintenance notices, tips.
// Deliberately simple: a title, an optional cover image, and the content
// itself, same "not a CMS" scope as the backend module.
export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const q = first(params.q);
  const page = Number(first(params.page) ?? '1') || 1;
  const result = await getBlogPosts({ q, page, limit: 12 });

  return (
    <main className="page-shell max-w-4xl">
      <PageHeader
        eyebrow="What's new"
        title="Blog & Updates"
        description="Product announcements, tips, and the occasional heads-up about maintenance."
      />

      <form action="/blog" method="GET" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search posts…"
          className="w-full rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900"
        />
        <button type="submit" className="button-secondary shrink-0">
          Search
        </button>
      </form>

      {result.data.length === 0 ? (
        <p className="empty-state">{q ? `No posts match "${q}".` : 'No posts published yet.'}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {result.data.map((post) => (
            <li key={post.id}>
              <Link
                href={`/blog/${post.slug}`}
                className="surface-card flex flex-col gap-3 overflow-hidden transition-colors hover:border-brand-400 sm:flex-row dark:hover:border-brand-600"
              >
                <div className="h-40 w-full shrink-0 overflow-hidden sm:h-auto sm:w-56">
                  <SafeImage
                    src={post.coverImage ? resolveImageUrl(post.coverImage) : null}
                    alt=""
                    className="h-full w-full object-cover"
                    fallback={
                      <div
                        aria-hidden
                        className="flex h-full min-h-40 items-center justify-center bg-gradient-to-br from-brand-700 to-brand-900"
                      >
                        <NewspaperIcon className="h-9 w-9 text-white/80" />
                      </div>
                    }
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-1 p-4">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {post.publishedAt &&
                      new Date(post.publishedAt).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                  </p>
                  <h2 className="font-semibold text-slate-900 dark:text-slate-50">{post.title}</h2>
                  <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{post.content}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {result.meta.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Link
            href={`/blog?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page - 1) })}`}
            aria-disabled={page <= 1}
            className={`text-sm font-medium ${page <= 1 ? 'pointer-events-none text-slate-300 dark:text-slate-700' : 'text-brand-700 dark:text-brand-300 hover:underline'}`}
          >
            ← Previous
          </Link>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            Page {result.meta.page} of {result.meta.totalPages}
          </span>
          <Link
            href={`/blog?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page + 1) })}`}
            aria-disabled={page >= result.meta.totalPages}
            className={`text-sm font-medium ${page >= result.meta.totalPages ? 'pointer-events-none text-slate-300 dark:text-slate-700' : 'text-brand-700 dark:text-brand-300 hover:underline'}`}
          >
            Next →
          </Link>
        </div>
      )}
    </main>
  );
}
