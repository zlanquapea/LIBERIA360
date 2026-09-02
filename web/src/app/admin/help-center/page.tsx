'use client';

import { useEffect, useState } from 'react';
import { PencilSquareIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { AdminGate } from '@/components/AdminGate';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { LoadingState } from '@/components/admin-ui';
import { useAuth } from '@/hooks/useAuth';
import { getFriendlyErrorMessage } from '@/lib/errors';
import {
  createHelpCenterArticle,
  createHelpCenterCategory,
  deleteHelpCenterArticle,
  deleteHelpCenterCategory,
  getAdminHelpCenterArticles,
  getAdminHelpCenterCategories,
  updateHelpCenterArticle,
  updateHelpCenterCategory,
} from '@/lib/help-center-api';
import type { ArticleStatus, KnowledgeArticle, KnowledgeCategory } from '@/lib/types';

// Admin authoring for the Help Center — Articles + Categories in one page,
// same "tabs switch a local state variable" pattern as Team & Access.
// This is purely additive content management: nothing here touches
// api/src/support or its endpoints.
export default function AdminHelpCenterPage() {
  return (
    <AdminGate>
      <HelpCenterAdmin />
    </AdminGate>
  );
}

function HelpCenterAdmin() {
  const { token } = useAuth();
  const [tab, setTab] = useState<'articles' | 'categories'>('articles');
  const [categories, setCategories] = useState<KnowledgeCategory[] | null>(null);
  const [articles, setArticles] = useState<KnowledgeArticle[] | null>(null);

  function reloadCategories() {
    if (!token) return;
    getAdminHelpCenterCategories(token).then(setCategories);
  }
  function reloadArticles() {
    if (!token) return;
    getAdminHelpCenterArticles(token).then((res) => setArticles(res.data));
  }

  useEffect(reloadCategories, [token]);
  useEffect(reloadArticles, [token]);

  if (!token) return null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Help Center</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Manage the articles and categories customers browse before opening a support ticket.
        </p>
      </div>

      <div className="flex gap-1 rounded-full bg-slate-100 p-1 text-sm dark:bg-slate-800" role="tablist">
        {(['articles', 'categories'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full px-3 py-1.5 font-medium capitalize transition-colors ${
              tab === t
                ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-brand-300'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'articles' ? (
        <ArticlesTab
          token={token}
          categories={categories}
          articles={articles}
          onChanged={reloadArticles}
        />
      ) : (
        <CategoriesTab
          token={token}
          categories={categories}
          articles={articles}
          onChanged={() => {
            reloadCategories();
            reloadArticles();
          }}
        />
      )}
    </div>
  );
}

const statusBadge: Record<ArticleStatus, string> = {
  draft: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
  published: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
};

function ArticlesTab({
  token,
  categories,
  articles,
  onChanged,
}: {
  token: string;
  categories: KnowledgeCategory[] | null;
  articles: KnowledgeArticle[] | null;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<KnowledgeArticle | 'new' | null>(null);
  const [pendingDelete, setPendingDelete] = useState<KnowledgeArticle | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteHelpCenterArticle(token, pendingDelete.id);
      setPendingDelete(null);
      onChanged();
    } catch (err) {
      setDeleteError(getFriendlyErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  if (editing) {
    return (
      <ArticleForm
        token={token}
        categories={categories ?? []}
        article={editing === 'new' ? null : editing}
        onDone={() => {
          setEditing(null);
          onChanged();
        }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setEditing('new')}
        disabled={!categories || categories.length === 0}
        className="self-start rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
        title={!categories?.length ? 'Create a category first' : undefined}
      >
        <PlusIcon aria-hidden className="mr-1 inline h-4 w-4" />
        New article
      </button>

      {!articles ? (
        <LoadingState />
      ) : articles.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">No articles yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {articles.map((article) => (
            <li
              key={article.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900 dark:text-slate-50">{article.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {article.category.name} · Updated{' '}
                  {new Date(article.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusBadge[article.status]}`}>
                  {article.status}
                </span>
                <button
                  type="button"
                  onClick={() => setEditing(article)}
                  aria-label={`Edit ${article.title}`}
                  className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  <PencilSquareIcon aria-hidden className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDelete(article)}
                  aria-label={`Delete ${article.title}`}
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
        title={pendingDelete ? `Delete "${pendingDelete.title}"?` : 'Delete this article?'}
        description="This permanently removes the article. Customers currently reading it will get a 404."
        confirmLabel="Delete article"
        loadingLabel="Deleting…"
        isLoading={deleting}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

function ArticleForm({
  token,
  categories,
  article,
  onDone,
  onCancel,
}: {
  token: string;
  categories: KnowledgeCategory[];
  article: KnowledgeArticle | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [categoryId, setCategoryId] = useState(article?.categoryId ?? categories[0]?.id ?? '');
  const [title, setTitle] = useState(article?.title ?? '');
  const [content, setContent] = useState(article?.content ?? '');
  const [status, setStatus] = useState<ArticleStatus>(article?.status ?? 'draft');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      if (article) {
        await updateHelpCenterArticle(token, article.id, { categoryId, title, content, status });
      } else {
        await createHelpCenterArticle(token, { categoryId, title, content, status });
      }
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
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Category</span>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          required
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
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
          onChange={(e) => setStatus(e.target.value as ArticleStatus)}
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
          {submitting ? 'Saving…' : article ? 'Save changes' : 'Create article'}
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

function CategoriesTab({
  token,
  categories,
  articles,
  onChanged,
}: {
  token: string;
  categories: KnowledgeCategory[] | null;
  articles: KnowledgeArticle[] | null;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<KnowledgeCategory | 'new' | null>(null);
  const [pendingDelete, setPendingDelete] = useState<KnowledgeCategory | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteHelpCenterCategory(token, pendingDelete.id);
      setPendingDelete(null);
      onChanged();
    } catch (err) {
      setDeleteError(getFriendlyErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  const articleCount = (categoryId: string) =>
    articles?.filter((a) => a.categoryId === categoryId).length ?? 0;

  if (editing) {
    return (
      <CategoryForm
        token={token}
        category={editing === 'new' ? null : editing}
        onDone={() => {
          setEditing(null);
          onChanged();
        }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setEditing('new')}
        className="self-start rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
      >
        <PlusIcon aria-hidden className="mr-1 inline h-4 w-4" />
        New category
      </button>

      {!categories ? (
        <LoadingState />
      ) : categories.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">No categories yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {categories.map((category) => (
            <li
              key={category.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900 dark:text-slate-50">{category.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {articleCount(category.id)} article{articleCount(category.id) === 1 ? '' : 's'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(category)}
                  aria-label={`Edit ${category.name}`}
                  className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  <PencilSquareIcon aria-hidden className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDelete(category)}
                  aria-label={`Delete ${category.name}`}
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
        title={pendingDelete ? `Delete "${pendingDelete.name}"?` : 'Delete this category?'}
        description="Categories with articles can't be deleted — move or delete those articles first."
        confirmLabel="Delete category"
        loadingLabel="Deleting…"
        isLoading={deleting}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

function CategoryForm({
  token,
  category,
  onDone,
  onCancel,
}: {
  token: string;
  category: KnowledgeCategory | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(category?.name ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      if (category) {
        await updateHelpCenterCategory(token, category.id, { name, description });
      } else {
        await createHelpCenterCategory(token, { name, description });
      }
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
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Name</span>
        <input
          type="text"
          required
          minLength={2}
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Description (optional)</span>
        <textarea
          rows={2}
          value={description ?? ''}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        />
      </label>

      {error && <p className="text-sm text-flag-700 dark:text-flag-300">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting || !name.trim()}
          className="rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {submitting ? 'Saving…' : category ? 'Save changes' : 'Create category'}
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
