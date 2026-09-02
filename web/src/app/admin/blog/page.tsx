'use client';

import { useEffect, useState } from 'react';
import { PencilSquareIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { AdminGate } from '@/components/AdminGate';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { LoadingState } from '@/components/admin-ui';
import { SingleImageUploader } from '@/components/SingleImageUploader';
import { useAuth } from '@/hooks/useAuth';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { createBlogPost, deleteBlogPost, getAdminBlogPosts, updateBlogPost } from '@/lib/blog-api';
import type { BlogPost, BlogPostStatus } from '@/lib/types';

const statusBadge: Record<BlogPostStatus, string> = {
  draft: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
  published: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
};

// Admin authoring for Blog & Updates — deliberately the simplest of the
// three new content sections (no categories, no feedback): "Do not build
// a complicated CMS" per the product ask.
export default function AdminBlogPage() {
  return (
    <AdminGate>
      <BlogAdmin />
    </AdminGate>
  );
}

function BlogAdmin() {
  const { token } = useAuth();
  const [posts, setPosts] = useState<BlogPost[] | null>(null);
  const [editing, setEditing] = useState<BlogPost | 'new' | null>(null);
  const [pendingDelete, setPendingDelete] = useState<BlogPost | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function reload() {
    if (!token) return;
    getAdminBlogPosts(token).then((res) => setPosts(res.data));
  }

  useEffect(reload, [token]);

  async function confirmDelete() {
    if (!token || !pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteBlogPost(token, pendingDelete.id);
      setPendingDelete(null);
      reload();
    } catch (err) {
      setDeleteError(getFriendlyErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  if (!token) return null;

  if (editing) {
    return (
      <BlogPostForm
        token={token}
        post={editing === 'new' ? null : editing}
        onDone={() => {
          setEditing(null);
          reload();
        }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Blog &amp; Updates</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Product announcements, tips, and maintenance notices customers see on the public blog.
        </p>
      </div>

      <button
        type="button"
        onClick={() => setEditing('new')}
        className="self-start rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
      >
        <PlusIcon aria-hidden className="mr-1 inline h-4 w-4" />
        New post
      </button>

      {!posts ? (
        <LoadingState />
      ) : posts.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">No posts yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {posts.map((post) => (
            <li
              key={post.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900 dark:text-slate-50">{post.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Updated {new Date(post.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusBadge[post.status]}`}>
                  {post.status}
                </span>
                <button
                  type="button"
                  onClick={() => setEditing(post)}
                  aria-label={`Edit ${post.title}`}
                  className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  <PencilSquareIcon aria-hidden className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDelete(post)}
                  aria-label={`Delete ${post.title}`}
                  className="rounded-full p-2 text-slate-500 hover:bg-flag-500/10 hover:text-flag-700 dark:text-slate-400 dark:hover:text-flag-300"
                >
                  <TrashIcon aria-hidden className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete ? `Delete "${pendingDelete.title}"?` : 'Delete this post?'}
        description="This permanently removes the post from the public blog."
        confirmLabel="Delete post"
        loadingLabel="Deleting…"
        isLoading={deleting}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

function BlogPostForm({
  token,
  post,
  onDone,
  onCancel,
}: {
  token: string;
  post: BlogPost | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(post?.title ?? '');
  const [content, setContent] = useState(post?.content ?? '');
  const [coverImage, setCoverImage] = useState<string | null>(post?.coverImage ?? null);
  const [status, setStatus] = useState<BlogPostStatus>(post?.status ?? 'draft');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const input = { title, content, coverImage, status };
      if (post) await updateBlogPost(token, post.id, input);
      else await createBlogPost(token, input);
      onDone();
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800"
    >
      <h1 className="text-lg font-bold text-slate-900 dark:text-slate-50">
        {post ? 'Edit post' : 'New post'}
      </h1>

      <SingleImageUploader
        token={token}
        value={coverImage}
        onChange={setCoverImage}
        label="Cover image (optional)"
        className="h-32 w-56"
      />

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Title</span>
        <input
          type="text"
          required
          minLength={3}
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Content</span>
        <textarea
          required
          minLength={10}
          rows={10}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Status</span>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as BlogPostStatus)}
          className="w-fit rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
      </label>

      {error && <p className="text-sm text-flag-700 dark:text-flag-300">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {submitting ? 'Saving…' : post ? 'Save changes' : 'Create post'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
