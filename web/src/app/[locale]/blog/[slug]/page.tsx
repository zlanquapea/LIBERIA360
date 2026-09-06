import Link from 'next/link';
import { notFound } from 'next/navigation';
import { NewspaperIcon } from '@heroicons/react/24/solid';
import { ApiError, getBlogPost } from '@/lib/api';
import { SafeImage } from '@/components/SafeImage';
import { HelpContentNav } from '@/components/HelpContentNav';
import { resolveImageUrl } from '@/lib/images';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getBlogPost(slug).catch(() => null);
  return { title: post ? `${post.title} — Blog — LIBERIA360` : 'Blog — LIBERIA360' };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const post = await getBlogPost(slug).catch((error) => {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  });
  if (!post) notFound();

  return (
    <main className="page-shell max-w-6xl">
      <Link href="/blog" className="text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline">
        ← Blog &amp; Updates
      </Link>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <HelpContentNav />

        <article className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="h-56 w-full overflow-hidden rounded-2xl">
            <SafeImage
              src={post.coverImage ? resolveImageUrl(post.coverImage) : null}
              alt=""
              className="h-full w-full object-cover"
              loading="eager"
              fallback={
                <div className="flex h-56 items-center justify-center bg-gradient-to-br from-brand-700 to-brand-900">
                  <NewspaperIcon className="h-12 w-12 text-white/80" />
                </div>
              }
            />
          </div>

          <header className="flex flex-col gap-1">
            <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-white sm:text-3xl">
              {post.title}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {post.author?.name && <>By {post.author.name} · </>}
              {post.publishedAt &&
                new Date(post.publishedAt).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
            </p>
          </header>

          <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-slate-200">
            {post.content}
          </div>
        </article>
      </div>
    </main>
  );
}
