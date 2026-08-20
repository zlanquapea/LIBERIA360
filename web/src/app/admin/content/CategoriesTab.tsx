'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { createCategory, deleteCategory, updateCategory } from '@/lib/admin-api';
import { HttpError } from '@/lib/http';
import type { Category } from '@/lib/types';
import { BackToListLink, DeleteButton, TabListHeader, inputClass, slugify } from './content-shared';

type View = { mode: 'list' } | { mode: 'create' } | { mode: 'edit'; category: Category };

export function CategoriesTab({
  token,
  categories,
  isSuperAdmin,
  onChanged,
}: {
  token: string;
  categories: Category[];
  isSuperAdmin: boolean;
  onChanged: (categories: Category[]) => void;
}) {
  const [view, setView] = useState<View>({ mode: 'list' });

  if (view.mode === 'create') {
    return (
      <div className="flex flex-col gap-3">
        <BackToListLink label="Back to categories" onClick={() => setView({ mode: 'list' })} />
        <CreateCategoryForm
          token={token}
          onCreated={(category) => {
            onChanged([...categories, category]);
            setView({ mode: 'list' });
          }}
        />
      </div>
    );
  }

  if (view.mode === 'edit') {
    return (
      <div className="flex flex-col gap-3">
        <BackToListLink label="Back to categories" onClick={() => setView({ mode: 'list' })} />
        <CategoryEditForm
          token={token}
          category={view.category}
          isSuperAdmin={isSuperAdmin}
          onSaved={(updated) => {
            onChanged(categories.map((c) => (c.id === updated.id ? updated : c)));
            setView({ mode: 'edit', category: updated });
          }}
          onDeleted={() => {
            onChanged(categories.filter((c) => c.id !== view.category.id));
            setView({ mode: 'list' });
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <TabListHeader
        title="Categories"
        count={categories.length}
        createLabel="+ New category"
        onCreate={() => setView({ mode: 'create' })}
      />
      {categories.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
          No categories yet — add the first one.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Slug</th>
                <th className="px-4 py-2">Description</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {categories.map((category) => (
                <tr
                  key={category.id}
                  onClick={() => setView({ mode: 'edit', category })}
                  className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-50">
                    {category.icon ? `${category.icon} ` : ''}
                    {category.name}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{category.slug}</td>
                  <td className="max-w-xs truncate px-4 py-2.5 text-slate-500 dark:text-slate-400">{category.description ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right text-xs font-medium text-brand-700">Edit →</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CreateCategoryForm({ token, onCreated }: { token: string; onCreated: (category: Category) => void }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [icon, setIcon] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const category = await createCategory(token, {
        name,
        slug,
        icon: icon.trim() || undefined,
        description: description.trim() || undefined,
      });
      onCreated(category);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">New category</h3>
      <div className="grid grid-cols-3 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Name
          <input required maxLength={100} value={name} onChange={(e) => handleNameChange(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Slug
          <input
            required
            maxLength={100}
            placeholder="auto-generated from name"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugTouched(true);
            }}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Icon
          <input maxLength={50} placeholder="e.g. 🏖️ (an emoji)" value={icon} onChange={(e) => setIcon(e.target.value)} className={inputClass} />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Description
        <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
      </label>
      {error && (
        <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
      >
        {submitting ? 'Adding…' : 'Add category'}
      </button>
    </form>
  );
}

function CategoryEditForm({
  token,
  category,
  isSuperAdmin,
  onSaved,
  onDeleted,
}: {
  token: string;
  category: Category;
  isSuperAdmin: boolean;
  onSaved: (category: Category) => void;
  onDeleted: () => void;
}) {
  const [name, setName] = useState(category.name);
  const [icon, setIcon] = useState(category.icon ?? '');
  const [description, setDescription] = useState(category.description ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setName(category.name);
    setIcon(category.icon ?? '');
    setDescription(category.description ?? '');
    setSuccess(false);
    // Keyed on category.id — a save replaces this category with a new
    // object of the same id, which must not wipe the success message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category.id]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      const updated = await updateCategory(token, category.id, {
        name,
        icon: icon.trim() || undefined,
        description: description.trim() || undefined,
      });
      setSuccess(true);
      onSaved(updated);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Edit category</h3>
        {isSuperAdmin && (
          <DeleteButton
            label="Delete category"
            onDelete={() => deleteCategory(token, category.id)}
            onDeleted={onDeleted}
          />
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Name
          <input required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Icon
          <input maxLength={50} value={icon} onChange={(e) => setIcon(e.target.value)} className={inputClass} />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Description
        <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
      </label>
      {error && (
        <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700">
          {error}
        </p>
      )}
      {success && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Saved.</p>}
      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
      >
        {submitting ? 'Saving…' : 'Save category'}
      </button>
    </form>
  );
}
