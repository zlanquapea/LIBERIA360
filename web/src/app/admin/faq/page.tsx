'use client';

import { useEffect, useState } from 'react';
import { ArrowDownIcon, ArrowUpIcon, PencilSquareIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { AdminGate } from '@/components/AdminGate';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { LoadingState } from '@/components/admin-ui';
import { useAuth } from '@/hooks/useAuth';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { createFaq, deleteFaq, getAdminFaqs, reorderFaqs, updateFaq } from '@/lib/faq-api';
import type { Faq } from '@/lib/types';

// Admin FAQ management — create/edit/delete, publish toggle, and reorder
// (simple up/down move rather than full drag-and-drop, matching "keep the
// implementation simple" for this feature).
export default function AdminFaqPage() {
  return (
    <AdminGate>
      <FaqAdmin />
    </AdminGate>
  );
}

function FaqAdmin() {
  const { token } = useAuth();
  const [faqs, setFaqs] = useState<Faq[] | null>(null);
  const [editing, setEditing] = useState<Faq | 'new' | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Faq | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  function reload() {
    if (!token) return;
    getAdminFaqs(token).then(setFaqs);
  }

  useEffect(reload, [token]);

  async function move(index: number, direction: -1 | 1) {
    if (!token || !faqs) return;
    const target = index + direction;
    if (target < 0 || target >= faqs.length) return;
    const reordered = [...faqs];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setFaqs(reordered);
    setMoveError(null);
    try {
      await reorderFaqs(token, reordered.map((f) => f.id));
    } catch (err) {
      setMoveError(getFriendlyErrorMessage(err));
      reload();
    }
  }

  async function togglePublished(faq: Faq) {
    if (!token) return;
    await updateFaq(token, faq.id, { published: !faq.published });
    reload();
  }

  async function confirmDelete() {
    if (!token || !pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteFaq(token, pendingDelete.id);
      setPendingDelete(null);
      reload();
    } catch (err) {
      setDeleteError(getFriendlyErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  if (!token) return null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">FAQ</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Manage the questions customers see on the public FAQ page, grouped by category.
        </p>
      </div>

      {editing ? (
        <FaqForm
          token={token}
          faq={editing === 'new' ? null : editing}
          onDone={() => {
            setEditing(null);
            reload();
          }}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <>
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="self-start rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
          >
            <PlusIcon aria-hidden className="mr-1 inline h-4 w-4" />
            New FAQ
          </button>

          {moveError && <p className="text-sm text-flag-700 dark:text-flag-300">{moveError}</p>}

          {!faqs ? (
            <LoadingState />
          ) : faqs.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No FAQs yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {faqs.map((faq, index) => (
                <li
                  key={faq.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900 dark:text-slate-50">{faq.question}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {faq.category ?? 'General'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                      aria-label="Move up"
                      className="rounded-full p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:text-slate-400 dark:hover:bg-slate-800"
                    >
                      <ArrowUpIcon aria-hidden className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={index === faqs.length - 1}
                      onClick={() => move(index, 1)}
                      aria-label="Move down"
                      className="rounded-full p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:text-slate-400 dark:hover:bg-slate-800"
                    >
                      <ArrowDownIcon aria-hidden className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => togglePublished(faq)}
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        faq.published
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                          : 'bg-slate-500/10 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {faq.published ? 'Published' : 'Unpublished'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(faq)}
                      aria-label={`Edit ${faq.question}`}
                      className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                    >
                      <PencilSquareIcon aria-hidden className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(faq)}
                      aria-label={`Delete ${faq.question}`}
                      className="rounded-full p-2 text-slate-500 hover:bg-flag-500/10 hover:text-flag-700 dark:text-slate-400 dark:hover:text-flag-300"
                    >
                      <TrashIcon aria-hidden className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete ? `Delete this FAQ?` : 'Delete this FAQ?'}
        description={pendingDelete?.question}
        confirmLabel="Delete FAQ"
        loadingLabel="Deleting…"
        isLoading={deleting}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

function FaqForm({
  token,
  faq,
  onDone,
  onCancel,
}: {
  token: string;
  faq: Faq | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [question, setQuestion] = useState(faq?.question ?? '');
  const [answer, setAnswer] = useState(faq?.answer ?? '');
  const [category, setCategory] = useState(faq?.category ?? '');
  const [published, setPublished] = useState(faq?.published ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const input = { question, answer, category: category || undefined, published };
      if (faq) await updateFaq(token, faq.id, input);
      else await createFaq(token, input);
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
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Question</span>
        <input
          type="text"
          required
          minLength={3}
          maxLength={300}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Answer</span>
        <textarea
          required
          minLength={3}
          rows={5}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Category (optional)</span>
        <input
          type="text"
          maxLength={120}
          placeholder="e.g. Bookings"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
        Published
      </label>

      {error && <p className="text-sm text-flag-700 dark:text-flag-300">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {submitting ? 'Saving…' : faq ? 'Save changes' : 'Create FAQ'}
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
